import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/hooks/useWebsiteEditor.ts', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('const localKey ='), source.indexOf('/** Cloud drafts'));
const storage = new Map();
const context = vm.createContext({
  exports: {},
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
});
vm.runInContext(ts.transpile(helpers, { module: ts.ModuleKind.CommonJS }), context);
const { readLocalDraft, writeLocalDraft } = context.exports;
writeLocalDraft('nikkole', 'stay-faded', { home: { story: 'Nikkole draft' } });
assert.equal(readLocalDraft('other-member', 'stay-faded'), null);
assert.equal(readLocalDraft('nikkole', 'stay-faded').home.story, 'Nikkole draft');
storage.set('website-editor-draft:stay-faded', JSON.stringify({ home: { story: 'Legacy shared draft' } }));
assert.equal(readLocalDraft('other-member', 'stay-faded'), null);
assert.equal(readLocalDraft(undefined, 'stay-faded'), null);
writeLocalDraft(undefined, 'stay-faded', { home: {} });
assert.equal(storage.size, 2);
console.log('PASS: drafts isolated by account; legacy shared drafts and signed-out reads ignored.');
