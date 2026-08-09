import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { FixedClock } from "./publication-clock.js";
import { createTestPublicationAuthorizationConfiguration } from "./publication-authorization-test-support.test.js";
import {
  createPublicationInfrastructure,
  type PublicationInfrastructure,
} from "./publication-infrastructure.js";
import { createPublicationInterfaceRequest } from "./publication-interface-models.js";
import { PublicationRuntimeError } from "./publication-runtime-contracts.js";
import { createPublicationRuntimeServiceRegistry } from "./publication-runtime-registry.js";
import { PublicationRuntime, bootstrapPublicationRuntime } from "./publication-runtime.js";

const timestamp = "2026-07-27T17:00:00.000Z";
const serviceNames = ["inputPort", "unitOfWork", "repository", "idempotency", "audit", "clock", "authorization", "authorizationEvidence", "coordination", "lifecycle", "reconciliation", "connectorDispatcher", "eventJournal", "eventCoordinator", "eventReplay", "eventGovernanceContextStore", "eventSourceContextResolver"] as const;
const identity = { publicationId: "publication-runtime-1", tenantScopeId: "team-a" } as const;

function createRequest() {
  return createPublicationInterfaceRequest({
    operation: "CREATE_PUBLICATION",
    context: {
      actorId: "actor-runtime",
      sessionId: "actor-runtime",
      correlationId: "correlation-runtime",
      idempotencyKey: "idempotency-runtime",
      intentFingerprint: "sha256:runtime-intent",
    },
    input: {
      identity,
      binding: {
        subjectId: "listing-1",
        subjectRevision: 3,
        representationId: "representation-1",
        representationVersion: 2,
        representationChecksum: "sha256:representation-1-v2",
        approvalId: "approval-1",
        approvalVersion: 4,
        targetId: "target-1",
        targetVersion: 5,
        channelId: "channel-1",
        channelPolicyVersion: "channel-policy-v3",
      },
      prerequisites: {
        immutableSnapshot: true,
        effectiveApproval: true,
        exactTargetChannel: true,
        provenancePresent: true,
      },
      classification: "CONFIDENTIAL_BUSINESS",
      command: {
        actorId: "actor-runtime",
        authorityContext: "PUBLICATION_EXECUTION",
        reason: "Approved in-process runtime request",
        correlationId: "correlation-runtime",
        occurredAt: timestamp,
      },
    },
  });
}

function assertRuntimeError(code: string): (error: unknown) => boolean {
  return (error) => error instanceof PublicationRuntimeError && error.code === code;
}

test("PHASE13-7 bootstrap reports a deterministic ready runtime", () => {
  const result = bootstrapPublicationRuntime({
    infrastructureConfiguration: createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)),
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Runtime bootstrap unexpectedly failed.");
  assert.deepEqual(result.runtime.context, {
    startupTime: timestamp,
    status: "READY",
    registeredServices: serviceNames,
  });
  assert.deepEqual(result.runtime.health, {
    healthy: true,
    compositionCompleted: true,
    requiredServicesRegistered: true,
    applicationEntryPointAvailable: true,
    runtimeStatus: "READY",
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.runtime.context), true);
  assert.equal(Object.isFrozen(result.runtime.health), true);
});

test("PHASE13-7 lifecycle requires initialize, start and ready ordering", () => {
  const infrastructure = createPublicationInfrastructure({ clock: new FixedClock(timestamp) });
  const runtime = new PublicationRuntime(createPublicationRuntimeServiceRegistry(infrastructure));

  assert.equal(runtime.context.status, "CREATED");
  assert.throws(() => runtime.start(), assertRuntimeError("RUNTIME_LIFECYCLE_INVALID"));
  assert.equal(runtime.initialize().status, "INITIALIZED");
  assert.equal(runtime.start().status, "STARTED");
  assert.equal(runtime.ready().status, "READY");
  assert.equal(runtime.entryPoint, infrastructure.inputPort);
});

test("PHASE13-7 immutable registry preserves explicit deterministic service ordering", () => {
  const infrastructure = createPublicationInfrastructure({ clock: new FixedClock(timestamp) });
  const registry = createPublicationRuntimeServiceRegistry(infrastructure);

  assert.deepEqual(registry.serviceNames, serviceNames);
  assert.equal(registry.inputPort, infrastructure.inputPort);
  assert.equal(registry.repository, infrastructure.repository);
  assert.equal(registry.unitOfWork, infrastructure.unitOfWork);
  assert.equal(registry.idempotency, infrastructure.idempotency);
  assert.equal(registry.audit, infrastructure.audit);
  assert.equal(registry.clock, infrastructure.clock);
  assert.equal(registry.coordination, infrastructure.coordination);
  assert.equal(registry.reconciliation, infrastructure.reconciliation);
  assert.equal(registry.connectorDispatcher, infrastructure.connectorDispatcher);
  assert.equal(registry.eventJournal, infrastructure.eventJournal);
  assert.equal(registry.eventCoordinator, infrastructure.eventCoordinator);
  assert.equal(registry.eventReplay, infrastructure.eventReplay);
  assert.equal(registry.eventGovernanceContextStore, infrastructure.eventGovernanceContextStore);
  assert.equal(registry.eventSourceContextResolver, infrastructure.eventSourceContextResolver);
  assert.equal(Object.isFrozen(registry), true);
  assert.equal(Object.isFrozen(registry.serviceNames), true);
  assert.throws(() => {
    (registry as unknown as { clock: unknown }).clock = new FixedClock("2026-07-27T18:00:00.000Z");
  }, TypeError);
});

test("PHASE13-7 startup validation reports a missing mandatory dependency", () => {
  const result = bootstrapPublicationRuntime({
    infrastructureFactory(configuration) {
      const infrastructure = createPublicationInfrastructure(configuration);
      return { ...infrastructure, audit: undefined } as unknown as PublicationInfrastructure;
    },
    infrastructureConfiguration: createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)),
  });

  assert.deepEqual(result, {
    ok: false,
    error: { code: "RUNTIME_DEPENDENCY_MISSING" },
  });
});

test("PHASE13-7 startup validation reports inconsistent infrastructure configuration", () => {
  const result = bootstrapPublicationRuntime({
    infrastructureFactory(configuration) {
      const infrastructure = createPublicationInfrastructure(configuration);
      return {
        ...infrastructure,
        clock: new FixedClock("2026-07-27T18:00:00.000Z"),
      };
    },
    infrastructureConfiguration: createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)),
  });

  assert.deepEqual(result, {
    ok: false,
    error: { code: "RUNTIME_CONFIGURATION_INCONSISTENT" },
  });
});

test("PHASE13-7 startup validation rejects structurally unusable mandatory adapters", () => {
  const cases = [
    {
      name: "clock",
      corrupt(infrastructure: PublicationInfrastructure): PublicationInfrastructure {
        const clock = {};
        return {
          ...infrastructure,
          configuration: Object.freeze({ clock }),
          clock,
        } as unknown as PublicationInfrastructure;
      },
    },
    {
      name: "unitOfWork",
      corrupt(infrastructure: PublicationInfrastructure): PublicationInfrastructure {
        const unitOfWork = {
          repository: infrastructure.repository,
          idempotency: infrastructure.idempotency,
          audit: infrastructure.audit,
        };
        return { ...infrastructure, unitOfWork } as unknown as PublicationInfrastructure;
      },
    },
    {
      name: "repository",
      corrupt(infrastructure: PublicationInfrastructure): PublicationInfrastructure {
        const repository = {};
        const unitOfWork = {
          begin: infrastructure.unitOfWork.begin.bind(infrastructure.unitOfWork),
          repository,
          idempotency: infrastructure.idempotency,
          audit: infrastructure.audit,
        };
        return { ...infrastructure, unitOfWork, repository } as unknown as PublicationInfrastructure;
      },
    },
    {
      name: "idempotency",
      corrupt(infrastructure: PublicationInfrastructure): PublicationInfrastructure {
        const idempotency = {};
        const unitOfWork = {
          begin: infrastructure.unitOfWork.begin.bind(infrastructure.unitOfWork),
          repository: infrastructure.repository,
          idempotency,
          audit: infrastructure.audit,
        };
        return { ...infrastructure, unitOfWork, idempotency } as unknown as PublicationInfrastructure;
      },
    },
    {
      name: "audit",
      corrupt(infrastructure: PublicationInfrastructure): PublicationInfrastructure {
        const audit = {};
        const unitOfWork = {
          begin: infrastructure.unitOfWork.begin.bind(infrastructure.unitOfWork),
          repository: infrastructure.repository,
          idempotency: infrastructure.idempotency,
          audit,
        };
        return { ...infrastructure, unitOfWork, audit } as unknown as PublicationInfrastructure;
      },
    },
  ] as const;

  for (const scenario of cases) {
    const result = bootstrapPublicationRuntime({
      infrastructureFactory(configuration) {
        return scenario.corrupt(createPublicationInfrastructure(configuration));
      },
      infrastructureConfiguration: { clock: new FixedClock(timestamp) },
    });
    assert.deepEqual(result, {
      ok: false,
      error: { code: "RUNTIME_DEPENDENCY_MISSING" },
    }, scenario.name);
  }
});

test("PHASE13-7 bootstrap redacts unexpected startup failures", () => {
  const result = bootstrapPublicationRuntime({
    infrastructureFactory() {
      throw new Error("internal startup stack and secret detail");
    },
  });

  assert.deepEqual(result, {
    ok: false,
    error: { code: "RUNTIME_STARTUP_FAILED" },
  });
});

test("PHASE13-7 complete publication command executes through the ready runtime", () => {
  const result = bootstrapPublicationRuntime({
    infrastructureConfiguration: createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)),
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Runtime bootstrap unexpectedly failed.");

  const response = result.runtime.execute(createRequest());

  assert.deepEqual(response, {
    operationResult: "SUCCEEDED",
    publicationId: identity.publicationId,
    version: 1,
    replayed: false,
  });
  assert.equal(result.runtime.services.repository.find(identity)?.lifecycleState, "READY");
  assert.deepEqual(result.runtime.services.audit.list(identity).map((entry) => entry.timestamp), [timestamp]);
});

test("PHASE13-7 graceful shutdown prevents duplicate shutdown and preserves in-memory business data", () => {
  const result = bootstrapPublicationRuntime({
    infrastructureConfiguration: createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)),
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Runtime bootstrap unexpectedly failed.");
  assert.equal(result.runtime.execute(createRequest()).operationResult, "SUCCEEDED");

  assert.equal(result.runtime.stop().status, "STOPPED");
  assert.equal(result.runtime.health.healthy, false);
  assert.throws(() => result.runtime.execute(createRequest()), assertRuntimeError("RUNTIME_NOT_READY"));
  assert.throws(() => result.runtime.stop(), assertRuntimeError("RUNTIME_ALREADY_STOPPED"));
  assert.equal(result.runtime.dispose().status, "DISPOSED");
  assert.equal(result.runtime.services.repository.find(identity)?.lifecycleState, "READY");
});

test("PHASE13-7 repeated bootstrap with the same clock produces equal runtime state and isolated services", () => {
  const options = { infrastructureConfiguration: createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)) } as const;
  const first = bootstrapPublicationRuntime(options);
  const second = bootstrapPublicationRuntime(options);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) throw new Error("Runtime bootstrap unexpectedly failed.");

  assert.deepEqual(first.runtime.context, second.runtime.context);
  assert.deepEqual(first.runtime.health, second.runtime.health);
  assert.notEqual(first.runtime.services, second.runtime.services);
  assert.notEqual(first.runtime.services.repository, second.runtime.services.repository);
});

test("PHASE13-7 runtime source depends only on Infrastructure and Interface boundary contracts", () => {
  const allowedImports = new Set([
    "./publication-infrastructure-configuration.js",
    "./publication-infrastructure.js",
    "./publication-runtime-contracts.js",
    "./publication-runtime-registry.js",
  ]);
  const files = [
    "publication-runtime-contracts.ts",
    "publication-runtime-registry.ts",
    "publication-runtime.ts",
  ];

  for (const file of files) {
    const source = readFileSync(join(process.cwd(), "modules", "publication", "src", file), "utf8");
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)]
      .map((match) => match[1])
      .filter((specifier): specifier is string => specifier !== undefined);
    assert.equal(imports.every((specifier) => allowedImports.has(specifier)), true, `${file} has a forbidden dependency`);
    assert.equal(source.includes("process.env"), false, `${file} reads environment configuration`);
  }
});
