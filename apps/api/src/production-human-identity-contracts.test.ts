import assert from "node:assert/strict";
import test from "node:test";

import { resolveProductionAuthenticationBinding, validateConfigurationReference, parseProductionHumanFreshnessPolicy } from "./production-human-identity-contracts.js";
import type { AuthenticationAdapterRegistration } from "./production-human-identity-contracts.js";
test("B1 binding remains fail-closed without an approved Production registration", () => {
  const binding = { adapterId: "not-configured", adapterKind: "UNRESOLVED", configurationRef: "config:production:v1" };
  assert.throws(() => resolveProductionAuthenticationBinding([], []), /BLOCKED_UNCONFIGURED/);
  assert.throws(() => resolveProductionAuthenticationBinding([binding, binding], []), /BINDING_INVALID/);
  assert.throws(() => resolveProductionAuthenticationBinding([binding], []), /BINDING_INVALID/);
});

test("binding contract forbids Staging, mismatched kinds, duplicate registry entries and rejected config without invoking verify", () => {
  const binding = { adapterId: "contract-test", adapterKind: "test-kind", configurationRef: "config:test:v1" };
  let verifyCalls = 0;
  // Contract fixture only; this entry is never registered in Production composition.
  const entry: AuthenticationAdapterRegistration = {
    ...binding, environment: "STAGING",
    adapter: { verify: () => { verifyCalls++; throw new Error("must not authenticate"); } },
    validateConfigurationReference: () => { throw new Error("selected-schema-rejected"); },
  };
  assert.throws(() => resolveProductionAuthenticationBinding([binding], [entry]), /BINDING_INVALID/);
  assert.throws(() => resolveProductionAuthenticationBinding([binding], [{ ...entry, environment: "PRODUCTION", adapterKind: "different" }]), /BINDING_INVALID/);
  assert.throws(() => resolveProductionAuthenticationBinding([binding], [entry, entry]), /BINDING_INVALID/);
  assert.throws(() => resolveProductionAuthenticationBinding([binding], [{ ...entry, environment: "PRODUCTION" }]), /selected-schema-rejected/);
  assert.equal(verifyCalls, 0);
});

test("B1 opaque configuration references reject missing values and detectable embedded secrets", () => {
  assert.equal(validateConfigurationReference("config:production:v1"), "config:production:v1");
  for (const value of [undefined, "", " config:v1", "https://user:password@example.com", "secret=value", "-----BEGIN PRIVATE KEY-----", { clientSecret: "value" }]) {
    assert.throws(() => validateConfigurationReference(value), /CONFIGURATION_REFERENCE_INVALID/);
  }
});

test("B1 freshness requires each explicit Production millisecond value without defaults", () => {
  const env = {
    AI_MLS_HUMAN_IDLE_TIMEOUT_MILLISECONDS: "1000",
    AI_MLS_HUMAN_ABSOLUTE_LIFETIME_MILLISECONDS: "5000",
    AI_MLS_HUMAN_MFA_FRESHNESS_MILLISECONDS: "2000",
  };
  assert.deepEqual(parseProductionHumanFreshnessPolicy(env), {
    IDLE_TIMEOUT_MILLISECONDS: 1000, ABSOLUTE_LIFETIME_MILLISECONDS: 5000, MFA_FRESHNESS_MILLISECONDS: 2000,
  });
  for (const key of Object.keys(env)) {
    const missing: Record<string, string> = { ...env }; delete missing[key];
    assert.throws(() => parseProductionHumanFreshnessPolicy(missing), /FRESHNESS_POLICY_INVALID/);
    for (const value of ["0", "-1", "1.5", "1e3", " 1000", "9007199254740992", "Infinity"]) {
      assert.throws(() => parseProductionHumanFreshnessPolicy({ ...env, [key]: value }), /FRESHNESS_POLICY_INVALID/);
    }
  }
});
