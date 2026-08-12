import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { FixedClock } from "./publication-clock.js";
import { createTestPublicationAuthorizationConfiguration } from "./publication-authorization-test-support.test.js";
import {
  createPublicationTransportRequestEnvelope,
  type PublicationTransportRequestEnvelope,
} from "./publication-transport-contracts.js";
import { PublicationTransportDispatcher } from "./publication-transport-dispatcher.js";
import { DeterministicPublicationTransportErrorMapper } from "./publication-transport-error-mapper.js";
import { createInProcessPublicationTransport } from "./publication-in-process-transport.js";
import { DefaultPublicationTransportRequestMapper } from "./publication-transport-request-mapper.js";
import { DeterministicPublicationTransportResponseMapper } from "./publication-transport-response-mapper.js";
import { PublicationRuntimeTransportAdapter } from "./publication-transport-runtime-adapter.js";
import { StructuralPublicationTransportValidator } from "./publication-transport-validation.js";
import { PublicationRuntimeError } from "./publication-runtime-contracts.js";
import { bootstrapPublicationRuntime, type PublicationRuntime } from "./publication-runtime.js";

const timestamp = "2026-07-28T01:00:00.000Z";
const identity = { publicationId: "publication-transport-1", tenantScopeId: "team-a" } as const;
const context = {
  actorId: "actor-transport",
  sessionId: "actor-transport",
  correlationId: "correlation-transport",
  idempotencyKey: "idempotency-transport-create",
  intentFingerprint: "sha256:transport-create",
} as const;
const command = {
  actorId: context.actorId,
  authorityContext: "PUBLICATION_EXECUTION",
  reason: "Approved in-process transport request",
  correlationId: context.correlationId,
  occurredAt: timestamp,
} as const;
const binding = {
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
} as const;

function createEnvelope(
  requestId = "transport-request-1",
  overrides: Partial<PublicationTransportRequestEnvelope> = {},
): PublicationTransportRequestEnvelope {
  return createPublicationTransportRequestEnvelope({
    requestId,
    operation: "CREATE_PUBLICATION",
    payload: {
      context,
      input: {
        identity,
        binding,
        prerequisites: {
          immutableSnapshot: true,
          effectiveApproval: true,
          exactTargetChannel: true,
          provenancePresent: true,
        },
        classification: "CONFIDENTIAL_BUSINESS",
        command,
      },
    },
    metadata: { source: "in-process-test", sequence: 1 },
    ...overrides,
  });
}

function readyRuntime(): PublicationRuntime {
  const result = bootstrapPublicationRuntime({
    infrastructureConfiguration: createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)),
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Runtime bootstrap unexpectedly failed.");
  return result.runtime;
}

test("PHASE13-8 creates an immutable serialisable transport request envelope", () => {
  const envelope = createEnvelope();

  assert.equal(Object.isFrozen(envelope), true);
  assert.equal(Object.isFrozen(envelope.payload), true);
  assert.equal(Object.isFrozen(envelope.metadata), true);
  assert.deepEqual(JSON.parse(JSON.stringify(envelope)), envelope);
  assert.throws(() => {
    (envelope.metadata as { source: string }).source = "changed";
  }, TypeError);
});

test("PHASE13-8 transport validation accepts a valid envelope and rejects malformed structure", () => {
  const validator = new StructuralPublicationTransportValidator();

  assert.deepEqual(validator.validate(createEnvelope()), { valid: true });
  assert.deepEqual(validator.validate({
    requestId: "transport-request-invalid",
    operation: "CREATE_PUBLICATION",
    metadata: {},
  }), { valid: false, failureCode: "TRANSPORT_REQUEST_INVALID" });
  assert.deepEqual(validator.validate({
    requestId: "transport-request-invalid",
    operation: "CREATE_PUBLICATION",
    payload: {},
    metadata: { nested: { forbidden: true } },
  }), { valid: false, failureCode: "TRANSPORT_REQUEST_INVALID" });
});

test("PHASE13-8 non-plain and hostile envelopes always produce deterministic safe failures", () => {
  const transport = createInProcessPublicationTransport(readyRuntime());
  const withDateMetadata = {
    ...createEnvelope("transport-date-metadata"),
    metadata: new Date(timestamp),
  };
  const customPrototype = Object.assign(Object.create({ inherited: true }) as object, {
    ...createEnvelope("transport-custom-prototype"),
  });
  const hostile = new Proxy({}, {
    ownKeys(): never {
      throw new Error("hostile getter detail");
    },
  });

  assert.deepEqual(transport.execute(withDateMetadata), {
    requestId: "transport-date-metadata",
    success: false,
    status: "VALIDATION_ERROR",
    error: { code: "TRANSPORT_REQUEST_INVALID", message: "Transport request is invalid." },
    metadata: {},
  });
  assert.deepEqual(transport.execute(customPrototype), {
    requestId: "UNKNOWN_REQUEST",
    success: false,
    status: "VALIDATION_ERROR",
    error: { code: "TRANSPORT_REQUEST_INVALID", message: "Transport request is invalid." },
    metadata: {},
  });
  assert.deepEqual(transport.execute(hostile), {
    requestId: "UNKNOWN_REQUEST",
    success: false,
    status: "INTERNAL_ERROR",
    error: { code: "TRANSPORT_INTERNAL_ERROR", message: "Transport request could not be completed." },
    metadata: {},
  });
});

test("PHASE13-8 request mapper converts transport payload to the approved Interface request", () => {
  const envelope = createEnvelope();
  const mapped = new DefaultPublicationTransportRequestMapper().map(envelope);

  assert.deepEqual(mapped, {
    operation: envelope.operation,
    ...(envelope.payload as Readonly<Record<string, unknown>>),
  });
  assert.equal(Object.isFrozen(mapped), true);
  assert.equal(Object.isFrozen(mapped.input), true);
});

test("PHASE13-8 dispatcher routes a known operation through the ready Runtime", () => {
  const transport = createInProcessPublicationTransport(readyRuntime());
  const response = transport.execute(createEnvelope());

  assert.deepEqual(response, {
    requestId: "transport-request-1",
    success: true,
    status: "SUCCESS",
    data: { publicationId: identity.publicationId, version: 1, replayed: false },
    metadata: { source: "in-process-test", sequence: 1 },
  });
});

test("PHASE13-8 dispatcher rejects an unknown operation deterministically", () => {
  const transport = createInProcessPublicationTransport(readyRuntime());
  const envelope = createEnvelope("transport-request-unknown", { operation: "DELETE_PUBLICATION" });

  assert.deepEqual(transport.execute(envelope), {
    requestId: "transport-request-unknown",
    success: false,
    status: "OPERATION_NOT_FOUND",
    error: { code: "TRANSPORT_OPERATION_NOT_FOUND", message: "Transport operation is not supported." },
    metadata: { source: "in-process-test", sequence: 1 },
  });
});

test("PHASE13-8 malformed transport input fails before Runtime invocation", () => {
  let executions = 0;
  const runtime = {
    context: { status: "READY" },
    execute() {
      executions += 1;
      throw new Error("must not execute");
    },
  } as unknown as PublicationRuntime;
  const transport = createInProcessPublicationTransport(runtime);

  assert.deepEqual(transport.execute({ requestId: "transport-invalid", operation: "CREATE_PUBLICATION", metadata: {} }), {
    requestId: "transport-invalid",
    success: false,
    status: "VALIDATION_ERROR",
    error: { code: "TRANSPORT_REQUEST_INVALID", message: "Transport request is invalid." },
    metadata: {},
  });
  assert.equal(executions, 0);
});

test("PHASE13-8 Interface validation failures map to a transport validation error", () => {
  const transport = createInProcessPublicationTransport(readyRuntime());
  const envelope = createEnvelope("transport-interface-invalid", { payload: { context } });

  assert.deepEqual(transport.execute(envelope), {
    requestId: "transport-interface-invalid",
    success: false,
    status: "VALIDATION_ERROR",
    error: { code: "TRANSPORT_REQUEST_INVALID", message: "Transport request is invalid." },
    metadata: { source: "in-process-test", sequence: 1 },
  });
});

test("PHASE13-8 response mapper preserves safe success data without internal references", () => {
  const response = new DeterministicPublicationTransportResponseMapper().map(
    createEnvelope(),
    { operationResult: "SUCCEEDED", publicationId: "publication-1", version: 7, replayed: true },
  );

  assert.equal(response.success, true);
  if (!response.success) throw new Error("Success response expected.");
  assert.deepEqual(response.data, { publicationId: "publication-1", version: 7, replayed: true });
  assert.equal("resultReference" in (response.data as object), false);
  assert.equal("aggregate" in (response.data as object), false);
  assert.equal("runtime" in response, false);
  assert.equal(Object.isFrozen(response), true);
  assert.equal(Object.isFrozen(response.data), true);
});

test("PHASE13-8 response mapper rejects malformed Runtime result shapes", () => {
  const mapper = new DeterministicPublicationTransportResponseMapper();
  const envelope = createEnvelope();
  const malformed = [
    { operationResult: "SUCCEEDED", publicationId: 123, version: "bad", replayed: "no" },
    { operationResult: "FAILED" },
    { operationResult: "FAILED", failureCode: 500 },
    { operationResult: "UNKNOWN", internal: "secret" },
  ];

  for (const response of malformed) {
    assert.deepEqual(mapper.map(envelope, response as never), {
      requestId: envelope.requestId,
      success: false,
      status: "INTERNAL_ERROR",
      error: { code: "TRANSPORT_INTERNAL_ERROR", message: "Transport request could not be completed." },
      metadata: envelope.metadata,
    });
  }
});

test("PHASE13-8 maps not-found and conflict Interface failures to closed transport categories", () => {
  const mapper = new DeterministicPublicationTransportResponseMapper();
  const envelope = createEnvelope();

  assert.deepEqual(mapper.map(envelope, { operationResult: "FAILED", failureCode: "PUBLICATION_NOT_FOUND" }), {
    requestId: envelope.requestId,
    success: false,
    status: "NOT_FOUND",
    error: { code: "PUBLICATION_NOT_FOUND", message: "Requested publication was not found." },
    metadata: envelope.metadata,
  });
  assert.deepEqual(mapper.map(envelope, { operationResult: "FAILED", failureCode: "PUBLICATION_VERSION_CONFLICT" }).status, "CONFLICT");
  assert.deepEqual(mapper.map(envelope, { operationResult: "FAILED", failureCode: "IDEMPOTENCY_CONFLICT" }).status, "CONFLICT");
});

test("PHASE13-8 maps approved domain rejection codes without changing application semantics", () => {
  const response = new DeterministicPublicationTransportResponseMapper().map(
    createEnvelope(),
    { operationResult: "FAILED", failureCode: "PUBLICATION_TRANSITION_INVALID" },
  );

  assert.deepEqual(response, {
    requestId: "transport-request-1",
    success: false,
    status: "APPLICATION_REJECTED",
    error: { code: "PUBLICATION_TRANSITION_INVALID", message: "Publication operation was rejected." },
    metadata: { source: "in-process-test", sequence: 1 },
  });
});

test("F15-TASK-005 preserves approved safe authorization rejection codes through Transport", () => {
  const mapper = new DeterministicPublicationTransportResponseMapper();
  for (const failureCode of [
    "AUTHENTICATION_REQUIRED",
    "AUTHORIZATION_DENIED",
    "PURPOSE_SCOPE_DENIED",
    "MFA_REQUIRED",
    "REASON_REQUIRED",
    "SEPARATION_OF_DUTIES_DENIED",
    "APPROVAL_NOT_EFFECTIVE",
    "VERIFICATION_NOT_EFFECTIVE",
    "PERMISSION_NOT_EFFECTIVE",
    "BINDING_MISMATCH",
    "POLICY_VERSION_STALE",
  ]) {
    const response = mapper.map(createEnvelope(), { operationResult: "FAILED", failureCode });
    assert.equal(response.success, false);
    assert.equal(!response.success && response.status, "APPLICATION_REJECTED");
    assert.equal(!response.success && response.error.code, failureCode);
    assert.equal(!response.success && response.error.message, "Publication operation was rejected.");
  }
});

test("PHASE13-8 unknown Interface failure codes are sanitised", () => {
  const response = new DeterministicPublicationTransportResponseMapper().map(
    createEnvelope(),
    { operationResult: "FAILED", failureCode: "SECRET_DATABASE_DETAIL" },
  );

  assert.deepEqual(response, {
    requestId: "transport-request-1",
    success: false,
    status: "INTERNAL_ERROR",
    error: { code: "TRANSPORT_INTERNAL_ERROR", message: "Transport request could not be completed." },
    metadata: { source: "in-process-test", sequence: 1 },
  });
});

test("PHASE13-8 unknown exceptions are sanitised to a generic internal error", () => {
  const response = new DeterministicPublicationTransportErrorMapper().map(
    createEnvelope(),
    new Error("database password and internal stack"),
  );

  assert.deepEqual(response, {
    requestId: "transport-request-1",
    success: false,
    status: "INTERNAL_ERROR",
    error: { code: "TRANSPORT_INTERNAL_ERROR", message: "Transport request could not be completed." },
    metadata: { source: "in-process-test", sequence: 1 },
  });
  assert.equal(JSON.stringify(response).includes("password"), false);
  assert.equal("stack" in response.error, false);
});

test("PHASE13-8 stopped Runtime rejects transport execution with a safe response", () => {
  const runtime = readyRuntime();
  runtime.stop();
  const transport = createInProcessPublicationTransport(runtime);

  assert.deepEqual(transport.execute(createEnvelope("transport-runtime-stopped")), {
    requestId: "transport-runtime-stopped",
    success: false,
    status: "APPLICATION_REJECTED",
    error: { code: "TRANSPORT_RUNTIME_NOT_READY", message: "Runtime is not ready for transport execution." },
    metadata: { source: "in-process-test", sequence: 1 },
  });
});

test("PHASE13-8 runtime adapter delegates only through PublicationRuntime.execute", () => {
  let executions = 0;
  const expected = { operationResult: "FAILED", failureCode: "PUBLICATION_NOT_FOUND" } as const;
  const runtime = {
    context: { status: "READY" },
    execute() {
      executions += 1;
      return expected;
    },
  } as unknown as PublicationRuntime;

  assert.equal(new PublicationRuntimeTransportAdapter(runtime).execute(
    new DefaultPublicationTransportRequestMapper().map(createEnvelope()),
  ), expected);
  assert.equal(executions, 1);
});

test("PHASE13-8 repeated dispatch returns deterministic isolated response envelopes", () => {
  const runtime = {
    context: { status: "READY" },
    execute() {
      return { operationResult: "FAILED", failureCode: "PUBLICATION_NOT_FOUND" } as const;
    },
  } as unknown as PublicationRuntime;
  const dispatcher = new PublicationTransportDispatcher(new PublicationRuntimeTransportAdapter(runtime));
  const request = createEnvelope();
  const first = dispatcher.dispatch(request);
  const second = dispatcher.dispatch(request);

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(first.success, false);
  if (first.success) throw new Error("Failure response expected.");
  assert.equal(Object.isFrozen(first.error), true);
});

test("FCR-001 Transport rejects caller-authored execution confirmation without false success evidence", () => {
  const runtime = readyRuntime();
  const transport = createInProcessPublicationTransport(runtime);
  const createResult = transport.execute(createEnvelope("workflow-create"));
  const beginResult = transport.execute(createPublicationTransportRequestEnvelope({
    requestId: "workflow-begin",
    operation: "MODIFY_PUBLICATION",
    payload: {
      context: { ...context, idempotencyKey: "idempotency-transport-begin", intentFingerprint: "sha256:transport-begin" },
      identity,
      input: {
        type: "BEGIN_INITIAL_EXECUTION",
        expectedAggregateVersion: 1,
        command,
        attempt: {
          id: "attempt-transport-1",
          commandId: "command-transport-1",
          operation: "INITIAL_PUBLISH",
          occurredAt: timestamp,
          evidenceRefs: ["evidence-1"],
        },
      },
    },
    metadata: {},
  }));
  const auditBefore = runtime.services.audit.list(identity).length;
  const eventCountBefore = runtime.services.eventJournal.listByAggregate(identity.tenantScopeId, identity.publicationId).length;
  const resolveResult = transport.execute(createPublicationTransportRequestEnvelope({
    requestId: "workflow-resolve",
    operation: "MODIFY_PUBLICATION",
    payload: {
      context: { ...context, idempotencyKey: "idempotency-transport-resolve", intentFingerprint: "sha256:transport-resolve" },
      identity,
      input: {
        type: "RESOLVE_EXECUTION",
        expectedAggregateVersion: 2,
        command,
        outcome: "EFFECT_CONFIRMED",
        evidenceRefs: ["evidence-confirmed"],
        externalObjectReference: "external-publication-1",
      },
    },
    metadata: {},
  }));

  assert.deepEqual([createResult.status, beginResult.status, resolveResult.status], ["SUCCESS", "SUCCESS", "VALIDATION_ERROR"]);
  assert.equal(resolveResult.success, false);
  assert.equal(runtime.services.repository.find(identity)?.lifecycleState, "EXECUTION_PENDING");
  assert.equal(runtime.services.repository.find(identity)?.aggregateVersion, 2);
  assert.equal(runtime.services.audit.list(identity).length, auditBefore);
  assert.equal(runtime.services.eventJournal.listByAggregate(identity.tenantScopeId, identity.publicationId).length, eventCountBefore);
  assert.equal(runtime.services.idempotency.find({ tenantScopeId: identity.tenantScopeId, aggregateId: identity.publicationId, commandKey: "idempotency-transport-resolve" }), undefined);
});

test("PHASE13-8 Transport production modules preserve dependency direction and forbidden framework absence", () => {
  const sourceDirectory = join(process.cwd(), "modules", "publication", "src");
  const productionFiles = readdirSync(sourceDirectory)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && file !== "index.ts");
  const transportFiles = productionFiles.filter((file) => file.startsWith("publication-transport-")
    || file === "publication-in-process-transport.ts");
  const forbidden = [
    /\b(express|fastify|nestjs|koa|hapi|http|rest|graphql|websocket|socket|tcp|ipc)\b/,
    /\b(router|decorator|middleware|cors|cookie|session|authentication|authorization|jwt|oauth)\b/,
    /\b(api[-_ ]?key|rate[-_ ]?limit|database|orm|sql|migration|prisma|typeorm|sequelize)\b/,
    /\b(redis|queue|kafka|rabbitmq|logging|monitoring|dotenv|docker|kubernetes|vercel|supabase)\b/,
    /\b(cloud|deployment|repository|aggregate)\b/,
    /process\.env/,
  ];

  for (const file of transportFiles) {
    const source = readFileSync(join(sourceDirectory, file), "utf8").toLowerCase();
    assert.equal(forbidden.some((pattern) => pattern.test(source)), false, `${file} contains a forbidden dependency or capability`);
  }

  assert.deepEqual(transportFiles.sort(), [
    "publication-in-process-transport.ts",
    "publication-transport-contracts.ts",
    "publication-transport-dispatcher.ts",
    "publication-transport-error-mapper.ts",
    "publication-transport-request-mapper.ts",
    "publication-transport-response-mapper.ts",
    "publication-transport-runtime-adapter.ts",
    "publication-transport-validation.ts",
  ]);
  const transportSpecifiers = new Set(transportFiles.map((file) => `./${file.slice(0, -3)}.js`));
  const innerFiles = productionFiles.filter((file) => !transportFiles.includes(file)
    && !file.startsWith("publication-presentation-")
    && !file.startsWith("publication-composition-"));
  for (const file of innerFiles) {
    const source = readFileSync(join(sourceDirectory, file), "utf8");
    const imports = extractModuleSpecifiers(source);
    assert.equal(imports.some((specifier) => transportSpecifiers.has(specifier)), false, `${file} imports Transport`);
  }

  assert.deepEqual(extractModuleSpecifiers([
    'import type { A } from "./publication-transport-contracts.js";',
    'import "./publication-in-process-transport.js";',
    'const lazy = import("./publication-transport-dispatcher.js");',
  ].join("\n")), [
    "./publication-transport-contracts.js",
    "./publication-in-process-transport.js",
    "./publication-transport-dispatcher.js",
  ]);
});

test("PHASE13-8 runtime errors are categorised without exposing Runtime internals", () => {
  const mapper = new DeterministicPublicationTransportErrorMapper();
  const response = mapper.map(createEnvelope(), new PublicationRuntimeError("RUNTIME_NOT_READY", "internal runtime detail"));

  assert.equal(response.status, "APPLICATION_REJECTED");
  assert.equal(response.error.code, "TRANSPORT_RUNTIME_NOT_READY");
  assert.equal(JSON.stringify(response).includes("internal runtime detail"), false);
});

function extractModuleSpecifiers(source: string): string[] {
  const patterns = [
    /from\s+"([^"]+)"/g,
    /import\s+"([^"]+)"/g,
    /import\(\s*"([^"]+)"\s*\)/g,
  ];
  return patterns
    .flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1]))
    .filter((specifier): specifier is string => specifier !== undefined);
}
