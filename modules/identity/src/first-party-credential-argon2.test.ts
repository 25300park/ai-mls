import assert from "node:assert/strict";
import test from "node:test";

import { Argon2idV1Verifier, ARGON2ID_V1 } from "./first-party-credential-argon2.js";
test("ARGON2ID_V1 native async wrapper uses the approved profile and verifies exact password bytes", async () => {
  assert.deepEqual(ARGON2ID_V1, { memory: 19456, passes: 2, parallelism: 1, tagLength: 32, saltLength: 16 });
  const verifier = new Argon2idV1Verifier();
  verifier.assertAvailable();
  const salt = verifier.generateSalt();
  assert.equal(salt.length, 16);
  const derived = await verifier.derive("fixture-password-only", salt);
  assert.equal(derived.length, 32);
  assert.equal(await verifier.verify("fixture-password-only", salt, derived), true);
  assert.equal(await verifier.verify("wrong-fixture-password", salt, derived), false);
  assert.notDeepEqual(salt, verifier.generateSalt());
});
test("Argon2 runtime absence and native errors fail closed without secret/error metadata", async () => {
  const unavailable = new Argon2idV1Verifier({});
  assert.throws(() => unavailable.assertAvailable(), /Authentication unavailable/u);
  await assert.rejects(unavailable.derive("private-fixture", Buffer.alloc(16)), /Authentication unavailable/u);
  const failing = new Argon2idV1Verifier({ argon2: () => { throw new Error("private native details"); } });
  await assert.rejects(failing.derive("private-fixture", Buffer.alloc(16)), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, "Authentication unavailable.");
    assert.equal(JSON.stringify(error).includes("private"), false);
    return true;
  });
});
