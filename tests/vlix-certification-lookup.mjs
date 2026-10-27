import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role;
  create schema auth;
  create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
  create table public.courses(id uuid primary key, category text);
  create table public.certifications(user_id uuid, course_id uuid, issued_at timestamptz);
  insert into auth.users values
    ('00000000-0000-4000-8000-000000000001', 'certified@example.test', now()),
    ('00000000-0000-4000-8000-000000000002', 'unconfirmed@example.test', null),
    ('00000000-0000-4000-8000-000000000003', 'other@example.test', now());
  insert into public.courses values
    ('00000000-0000-4000-8000-000000000010', 'hair-system'),
    ('00000000-0000-4000-8000-000000000011', 'marketing');
  insert into public.certifications values
    ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', now()),
    ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000010', now()),
    ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000011', now());
`);
await db.exec(fs.readFileSync("supabase/migrations/20261027222301_vlix_certification_lookup.sql", "utf8"));
const lookup = async (email) => (await db.query("select public.vlix_has_issued_hair_system_certificate($1) as certified", [email])).rows[0].certified;
assert.equal(await lookup("CERTIFIED@example.test"), true);
assert.equal(await lookup("unconfirmed@example.test"), false);
assert.equal(await lookup("other@example.test"), false);
assert.equal(await lookup("absent@example.test"), false);
for (const role of ["anon", "authenticated"]) {
  assert.equal((await db.query("select has_function_privilege($1, $2, 'EXECUTE') as allowed", [role, "public.vlix_has_issued_hair_system_certificate(text)"])).rows[0].allowed, false);
}
assert.equal((await db.query("select has_function_privilege('service_role', 'public.vlix_has_issued_hair_system_certificate(text)', 'EXECUTE') as allowed")).rows[0].allowed, true);
await db.close();
console.log("PASS: confirmed auth email and issued hair-system certificate required; client roles denied lookup");
