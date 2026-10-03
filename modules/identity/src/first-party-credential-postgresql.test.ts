import assert from "node:assert/strict";
import test from "node:test";
import type { PostgreSqlClientPort, PostgreSqlQueryResult } from "./postgresql-pool.js";
import { PostgreSqlHumanCredentialReader } from "./first-party-credential-postgresql.js";

const principal = { principal_id: "principal", user_id: "user", tenant_id: "tenant-a", login_identifier: "User01", status: "ACTIVE", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" };
const credential = { credential_id: "credential", principal_id: "principal", credential_version: "1", credential_type: "PASSWORD", algorithm: "ARGON2ID", algorithm_profile: "ARGON2ID_V1", salt: Buffer.alloc(16, 1), derived_key: Buffer.alloc(32, 2), status: "ACTIVE", created_at: "2026-01-01T00:00:00.000Z", rotated_at: null, revoked_at: null };
function fixture(principals: readonly Record<string, unknown>[] = [principal], credentials: readonly Record<string, unknown>[] = [credential]) {
  const calls: { sql: string; values: readonly unknown[] | undefined }[] = [];
  const releases: (boolean | undefined)[] = [];
  const client: PostgreSqlClientPort = {
    query<Row extends Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<PostgreSqlQueryResult<Row>> {
      calls.push({ sql, values });
      const rows = sql.includes("identity_human_principals") ? principals : credentials;
      return Promise.resolve({ rows: rows as readonly Row[], rowCount: rows.length });
    },
    release(discard) { releases.push(discard); },
  };
  const reader = new PostgreSqlHumanCredentialReader({ connect: () => Promise.resolve(client), close: () => Promise.resolve() });
  return { reader, calls, releases, client };
}
test("credential lookup is exact tenant-scoped and read-only", async () => {
  const f = fixture();
  const result = await f.reader.capture("tenant-a", "User01");
  assert.equal(result?.principal.loginIdentifier, "User01");
  assert.deepEqual(f.calls[0]?.values, ["tenant-a", "User01"]);
  assert.match(f.calls[0].sql, /tenant_id = \$1.*login_identifier = \$2/);
  assert.equal(f.calls.every(({ sql }) => sql.startsWith("SELECT") && !sql.includes("FOR UPDATE")), true);
  assert.deepEqual(f.releases, [false]);
  assert.equal(await fixture().reader.capture("tenant-b", "User01"), null);
  assert.equal(await fixture().reader.capture("tenant-a", "user01"), null);
  assert.equal(await fixture().reader.capture("tenant-a", " User01"), null);
});
test("unknown, ambiguous, disabled and unsupported credentials fail closed", async () => {
  for (const principals of [[], [principal, principal], [{ ...principal, status: "DISABLED" }]]) assert.equal(await fixture(principals).reader.capture("tenant-a", "User01"), null);
  for (const rows of [[], [credential, credential], [{ ...credential, status: "REVOKED" }], [{ ...credential, algorithm: "SCRYPT" }], [{ ...credential, algorithm_profile: "OTHER" }], [{ ...credential, credential_version: "0" }], [{ ...credential, salt: Buffer.alloc(15) }]]) assert.equal(await fixture([principal], rows).reader.capture("tenant-a", "User01"), null);
});
test("capture owns independent immutable material and client errors are redacted", async () => {
  const f = fixture();
  const captured = await f.reader.capture("tenant-a", "User01");
  assert.notEqual(captured?.credential.salt, credential.salt);
  const reader = new PostgreSqlHumanCredentialReader({ connect: () => Promise.reject(new Error("private driver detail")), close: () => Promise.resolve() });
  await assert.rejects(reader.capture("tenant-a", "User01"), { message: "Authentication unavailable." });
});
