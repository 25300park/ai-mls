import assert from "node:assert/strict";
import test from "node:test";
import type { AsyncRegisteredServiceWorkloadAuthorityLease } from "../../../modules/identity/src/index.js";
import type { PostgreSqlPoolPort } from "../../../modules/identity/src/postgresql-pool.js";
import { Argon2idV1Verifier } from "../../../modules/identity/src/first-party-credential-argon2.js";
import { FirstPartyCredentialAuthenticationAdapter } from "../../../modules/identity/src/first-party-credential-adapter.js";
import { assertFirstPartyCredentialConfigRef } from "../../../modules/identity/src/first-party-credential-contracts.js";
import { createFirstPartyAuthenticationRegistration } from "./first-party-authentication-composition.js";
import { ProductionTrustedBindingResolver } from "./production-trusted-binding.js";
import { validateProductionHumanIdentityReadiness, type ProductionHumanReadinessComponents } from "./production-human-identity-readiness.js";
import { ProductionBootstrapError, type ProductionRuntimeConfiguration } from "./production-bootstrap.js";
import { executeProductionPreListenerStartupChain, type ProductionPreListenerGateDependencies } from "./production-bootstrap-engine.js";
import { CURRENT_PRODUCTION_REQUIRED_SECRETS_MANIFEST, CURRENT_PRODUCTION_REQUIRED_SECRET_COMPOSITION, validateRequiredSecretsManifest } from "./production-required-secrets.js";

const configuration: ProductionRuntimeConfiguration = Object.freeze({
  runtimeEnvironment: "PRODUCTION", configurationReference: "config:production:v1",
  requiredServiceRegistrations: Object.freeze(["registration-api-014"]),
  providerExecutionAuthorized: false, identityPersistenceEngine: "POSTGRESQL",
});
const binding = Object.freeze({ adapterId: "ai-mls.identity.first-party-credential.v1", adapterKind: "FIRST_PARTY_CREDENTIAL",
  configurationRef: Object.freeze({ schemaVersion: 1, adapterId: "ai-mls.identity.first-party-credential.v1", algorithmProfile: "ARGON2ID_V1" }) });
const environment = Object.freeze({ AI_MLS_HUMAN_IDLE_TIMEOUT_MILLISECONDS: "60000",
  AI_MLS_HUMAN_ABSOLUTE_LIFETIME_MILLISECONDS: "120000", AI_MLS_HUMAN_MFA_FRESHNESS_MILLISECONDS: "30000" });

function fixture(failAt?: "SERVICE" | "HUMAN" | "SECRETS") {
  const events: string[] = [];
  const counters = { clients: 0, releases: 0, live: 0, poolCloses: 0, authorityCloses: 0, authorizationDecisions: 0 };
  const pool: PostgreSqlPoolPort = {
    connect: () => {
      counters.clients += 1; counters.live += 1;
      let released = false;
      return Promise.resolve({ query: () => Promise.resolve({ rows: [], rowCount: 0 }), release: () => {
        assert.equal(released, false); released = true; counters.live -= 1; counters.releases += 1;
      } });
    },
    close: () => { counters.poolCloses += 1; assert.equal(counters.live, 0); return Promise.resolve(); },
  };
  const read = async (stage: string): Promise<void> => {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      if ((stage === "service" && failAt === "SERVICE") || (stage === "principal" && failAt === "HUMAN")) {
        throw new Error("private fixture details must not escape");
      }
    } finally { client.release(); }
  };
  const authority: AsyncRegisteredServiceWorkloadAuthorityLease = {
    assertSchemaReady: () => Promise.resolve("NATIVE_MIGRATION_LEDGER_VERIFIED"),
    findByRegistrationId: () => Promise.resolve(undefined),
    close: () => { counters.authorityCloses += 1; return Promise.resolve(); },
  };
  const components: ProductionHumanReadinessComponents = {
    registrations: [{ adapterId: binding.adapterId, adapterKind: binding.adapterKind, environment: "PRODUCTION",
      implementation: FirstPartyCredentialAuthenticationAdapter, factory: createFirstPartyAuthenticationRegistration,
      validateConfigurationReference: assertFirstPartyCredentialConfigRef }],
    crypto: new Argon2idV1Verifier(), trustedBindingFactory: ProductionTrustedBindingResolver,
    assertPrincipalCredentialReady: () => read("principal"), assertSessionReady: () => read("session"), assertTrustedBindingReady: () => read("trusted"),
    authorization: { evaluate: () => { counters.authorizationDecisions += 1; throw new Error("No synthetic actor"); },
      evaluateWorkload: () => { counters.authorizationDecisions += 1; throw new Error("No synthetic actor"); } },
  };
  const dependencies: ProductionPreListenerGateDependencies = {
    resolveRequiredServiceIdentities: async (borrowedAuthority, config) => {
      assert.equal(borrowedAuthority, authority); assert.equal(config, configuration);
      events.push("service"); await read("service");
      return Object.freeze([Object.freeze({ registrationId: "registration-api-014", tenantId: "tenant-a", principalId: "service-a",
        principalType: "SERVICE" as const, assurance: "WORKLOAD" as const, environment: "PRODUCTION" as const,
        workloadPurpose: "PUBLICATION_RUNTIME", audience: "API-014", registrationVersion: 1,
        identityEvidenceRef: "identity:registration-api-014", auditEvidenceRef: "audit:registration-api-014" })]);
    },
    validateStartupGate: () => { events.push("service-ready"); return "sha256:validation-fingerprint"; },
    validateHumanIdentityAuthority: async () => {
      events.push("human"); await validateProductionHumanIdentityReadiness(environment, [binding], components); events.push("human-ready");
    },
    resolveRequiredSecrets: () => Promise.resolve().then(() => {
      events.push("secrets"); if (failAt === "SECRETS") throw new Error("private fixture details must not escape");
      validateRequiredSecretsManifest(CURRENT_PRODUCTION_REQUIRED_SECRETS_MANIFEST, CURRENT_PRODUCTION_REQUIRED_SECRET_COMPOSITION);
      events.push("secrets-ready");
    }),
  };
  return { events, counters, pool, authority, dependencies };
}

function blocked(error: unknown): boolean {
  assert.ok(error instanceof ProductionBootstrapError);
  assert.equal(Reflect.get(error, "preListenerStartupChain"), "BLOCKED");
  assert.equal(JSON.stringify(error).includes("private"), false);
  return true;
}

test("all three gates yield one immutable READY result in exact order without activation", async () => {
  const f = fixture();
  const result = await executeProductionPreListenerStartupChain(configuration, f.authority, f.dependencies);
  assert.equal(result.status, "READY"); assert.equal(Object.isFrozen(result), true); assert.equal(Object.isFrozen(result.identities), true);
  assert.equal(result.validationFingerprint, "sha256:validation-fingerprint");
  assert.deepEqual(f.events, ["service", "service-ready", "human", "human-ready", "secrets", "secrets-ready"]);
  assert.equal(f.counters.clients, 4); assert.equal(f.counters.releases, 4); assert.equal(f.counters.live, 0);
  assert.equal(f.counters.poolCloses, 0); assert.equal(f.counters.authorityCloses, 0);
  assert.equal(f.counters.authorizationDecisions, 0);
  await f.pool.close(); assert.equal(f.counters.poolCloses, 1);
});

for (const gate of ["SERVICE", "HUMAN", "SECRETS"] as const) {
  test(`${gate} failure returns BLOCKED, short-circuits and releases every borrowed client`, async () => {
    const f = fixture(gate);
    await assert.rejects(executeProductionPreListenerStartupChain(configuration, f.authority, f.dependencies), blocked);
    if (gate === "SERVICE") assert.deepEqual(f.events, ["service"]);
    if (gate === "HUMAN") assert.deepEqual(f.events, ["service", "service-ready", "human"]);
    if (gate === "SECRETS") assert.deepEqual(f.events, ["service", "service-ready", "human", "human-ready", "secrets"]);
    assert.equal(f.counters.live, 0); assert.equal(f.counters.releases, f.counters.clients);
    assert.equal(f.counters.poolCloses, 0); assert.equal(f.counters.authorityCloses, 0);
    assert.equal(f.counters.authorizationDecisions, 0);
    await f.pool.close(); assert.equal(f.counters.poolCloses, 1);
  });
}

test("async Human readiness is awaited and no READY result or secrets exist while it is pending", async () => {
  const f = fixture(); let release!: () => void; let ready = false;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const chain = executeProductionPreListenerStartupChain(configuration, f.authority, { ...f.dependencies,
    validateHumanIdentityAuthority: async (config) => { await pending; await f.dependencies.validateHumanIdentityAuthority(config); },
  }).then((result) => { ready = true; return result; });
  await new Promise<void>((resolve) => { setImmediate(resolve); });
  assert.equal(ready, false); assert.deepEqual(f.events, ["service", "service-ready"]);
  release(); assert.equal((await chain).status, "READY");
  assert.equal(f.counters.live, 0); assert.equal(f.counters.poolCloses, 0);
});

test("missing or malformed manifest blocks the composed chain after Human readiness", async () => {
  for (const manifest of [undefined, null, { schemaVersion: 1 }, { schemaVersion: 2, entries: [] }]) {
    const f = fixture();
    await assert.rejects(executeProductionPreListenerStartupChain(configuration, f.authority, { ...f.dependencies,
      resolveRequiredSecrets: () => Promise.resolve().then(() => { validateRequiredSecretsManifest(manifest, CURRENT_PRODUCTION_REQUIRED_SECRET_COMPOSITION); }),
    }), blocked);
    assert.equal(f.events.at(-1), "human-ready"); assert.equal(f.counters.live, 0); assert.equal(f.counters.poolCloses, 0);
  }
});

test("invalid service identity set or fingerprint skips both downstream gates", async () => {
  for (const override of [
    { resolveRequiredServiceIdentities: () => Promise.resolve([]) },
    { validateStartupGate: () => "" },
  ]) {
    const f = fixture();
    await assert.rejects(executeProductionPreListenerStartupChain(configuration, f.authority, { ...f.dependencies, ...override }), blocked);
    assert.equal(f.events.includes("human"), false); assert.equal(f.events.includes("secrets"), false); assert.equal(f.counters.live, 0);
  }
});
