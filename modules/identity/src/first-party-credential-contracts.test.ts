import assert from "node:assert/strict";
import test from "node:test";
import { assertFirstPartyCredentialEvidence, assertFirstPartyCredentialConfigRef, validLoginIdentifier } from "./first-party-credential-contracts.js";

test("login identifiers are opaque exact values with malformed input rejected", () => {
  for (const value of ["User01", "user01", "user@example.com", "USER@example.com", "é", "e\u0301", "printable internal space"]) assert.equal(validLoginIdentifier(value), true);
  for (const value of ["", " user01", "user01 ", "user\t01", "user\n01", "user\u000001", "user\u007f01", "x".repeat(513)]) assert.equal(validLoginIdentifier(value), false);
  const evidence = { schemaVersion: 1, loginIdentifier: "User01", password: "synthetic password" };
  assertFirstPartyCredentialEvidence(evidence);
  assert.equal(evidence.loginIdentifier, "User01");
  assert.throws(() => assertFirstPartyCredentialEvidence({ ...evidence, tenantId: "override" }), /Authentication failed/);
  assert.throws(() => assertFirstPartyCredentialEvidence({ ...evidence, loginIdentifier: " User01 " }), /Authentication failed/);
  assert.throws(() => assertFirstPartyCredentialEvidence({ ...evidence, schemaVersion: 2 }), /Authentication failed/);
});

test("first-party configuration is exact, secret-free and versioned", () => {
  const reference = { schemaVersion: 1, adapterId: "ai-mls.identity.first-party-credential.v1", algorithmProfile: "ARGON2ID_V1" };
  assertFirstPartyCredentialConfigRef(reference);
  for (const invalid of [null, "default", { ...reference, schemaVersion: 2 }, { ...reference, adapterId: "staging" }, { ...reference, algorithmProfile: "downgrade" }, { ...reference, secret: "synthetic" }]) assert.throws(() => assertFirstPartyCredentialConfigRef(invalid), /Authentication unavailable/);
});
