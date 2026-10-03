import assert from "node:assert/strict";
import test from "node:test";
import { Argon2idV1Verifier } from "./first-party-credential-argon2.js";
import { FirstPartyCredentialAuthenticationAdapter } from "./first-party-credential-adapter.js";
import type { HumanCredentialCapture } from "./first-party-credential-postgresql.js";
import type { PostgreSqlClientPort } from "./postgresql-pool.js";

async function fixture() {
  const crypto = new Argon2idV1Verifier();
  const salt = crypto.generateSalt();
  const initial: HumanCredentialCapture = {
    principal: { principalId: "principal", userId: "user", tenantId: "tenant", loginIdentifier: "User01", status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    credential: { credentialId: "credential", principalId: "principal", credentialVersion: 1, credentialType: "PASSWORD", algorithm: "ARGON2ID", algorithmProfile: "ARGON2ID_V1", salt, derivedKey: await crypto.derive("synthetic password", salt), status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z", rotatedAt: null, revokedAt: null },
  };
  let current: HumanCredentialCapture | null = initial;
  let seenClient: PostgreSqlClientPort | undefined;
  const adapter = new FirstPartyCredentialAuthenticationAdapter("tenant", {
    capture(tenant, login, client) {
      seenClient = client;
      return Promise.resolve(tenant === "tenant" && login === "User01" ? current : null);
    },
  }, crypto);
  return { adapter, initial, change: (value: HumanCredentialCapture | null) => { current = value; }, client: () => seenClient };
}
const evidence = { schemaVersion: 1 as const, loginIdentifier: "User01", password: "synthetic password" };
const client: PostgreSqlClientPort = { query: () => Promise.resolve({ rows: [], rowCount: 0 }), release() { /* transaction owner releases this client */ } };
test("native async authentication returns only bounded identity and revalidates once on the owned client", async () => {
  const f = await fixture();
  assert.equal(await f.adapter.verify({ ...evidence, password: "wrong" }), null);
  assert.equal(await f.adapter.verify({ ...evidence, loginIdentifier: "user01" }), null);
  const identity = await f.adapter.verify(evidence);
  assert.ok(identity);
  assert.equal(identity.isMfaVerified, false);
  assert.equal(/password|salt|derivedKey|credentialVersion/.test(JSON.stringify(identity)), false);
  await f.adapter.revalidate(identity, client);
  assert.equal(f.client(), client);
  await assert.rejects(f.adapter.revalidate(identity, client), /Authentication failed/);
});
test("any captured principal or credential change rejects stale verification", async () => {
  const f = await fixture();
  const changes: (HumanCredentialCapture | null)[] = [null,
    { ...f.initial, principal: { ...f.initial.principal, status: "DISABLED" } },
    { ...f.initial, principal: { ...f.initial.principal, tenantId: "other" } },
    { ...f.initial, credential: { ...f.initial.credential, credentialVersion: 2 } },
    { ...f.initial, credential: { ...f.initial.credential, status: "REVOKED" } },
    { ...f.initial, credential: { ...f.initial.credential, derivedKey: Buffer.alloc(32) } },
  ];
  for (const change of changes) {
    f.change(f.initial);
    const identity = await f.adapter.verify(evidence);
    assert.ok(identity);
    f.change(change);
    await assert.rejects(f.adapter.revalidate(identity, client), /Authentication failed/);
  }
});
