import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../supabase/functions/impersonate-user/index.ts', import.meta.url), 'utf8');
const file = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);

test('every console argument is static or approved noncredential method/status/version metadata', () => {
  let count = 0;
  const safeExpression = (node) => ['VERSION', 'req.method', 'verifyResponse.status'].includes(node.getText(file));
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && node.expression.expression.getText(file) === 'console') {
      count++;
      for (const arg of node.arguments) {
        const safe = ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)
          || safeExpression(arg)
          || (ts.isTemplateExpression(arg) && arg.templateSpans.every((span) => safeExpression(span.expression)));
        assert.ok(safe, 'Console arguments must not include credentials or raw error/response objects');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.equal(count, 6);
});

for (const scenario of ['success', 'link-failure', 'verify-failure', 'exception']) {
  test(`${scenario}: credential-bearing fixtures never reach logs`, async () => {
    const marker = 'PRIVATE_CREDENTIAL_FIXTURE';
    const logs = [];
    let handler;
    const client = {
      auth: {
        getUser: async () => ({ data: { user: { id: 'admin', email: 'admin@example.test' } } }),
        admin: {
          getUserById: async () => ({ data: { user: { email: 'target@example.test' } } }),
          generateLink: async () => {
            if (scenario === 'exception') throw new Error(marker);
            return {
              data: { properties: { action_link: `https://example.test/verify?token=${marker}` } },
              error: scenario === 'link-failure' ? { message: marker } : null,
            };
          },
        },
      },
      rpc: async () => ({ data: true }),
    };
    const script = ts.transpileModule(source.replace(/^import .*;\n/, ''), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
    vm.runInNewContext(script, {
      Deno: { env: { get: () => 'fixture' }, serve: (callback) => { handler = callback; } },
      createClient: () => client,
      console: Object.fromEntries(['log', 'error', 'warn', 'info', 'debug'].map((name) => [name, (...args) => logs.push(args)])),
      URL, Response,
      fetch: async () => new Response(JSON.stringify({
        access_token: marker, refresh_token: marker, token_hash: marker,
        error_description: marker,
      }), { status: scenario === 'verify-failure' ? 400 : 200 }),
    });
    assert.equal(typeof handler, 'function');
    const response = await handler(new Request('https://example.test', {
      method: 'POST', headers: { Authorization: `Bearer ${marker}` },
      body: JSON.stringify({ target_user_id: 'target' }),
    }));
    assert.equal(response.status, scenario === 'success' ? 200 : 500);
    assert.ok(logs.length > 0);
    assert.equal(JSON.stringify(logs).includes(marker), false);
    if (scenario === 'success') {
      assert.deepEqual(await response.json(), { success: true, access_token: marker, refresh_token: marker });
    }
  });
}