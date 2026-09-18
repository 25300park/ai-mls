import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import { ConnectorApplicationHost } from "../../../modules/source/src/connector-application-host.js";
import { CONNECTOR_API_HTTP_OPERATIONS, type ConnectorApiRequestKind } from "../../../modules/source/src/connector-api-contracts.js";
import { DurableConnectorExecutionUnitOfWork } from "../../../modules/source/src/connector-durable-persistence.js";
import { ConnectorExecutionCoordinator } from "../../../modules/source/src/connector-execution-coordinator.js";
import type { ConnectorInvocationPort } from "../../../modules/source/src/connector-invocation-port.js";
import { ConnectorRuntimeApplication, type ConnectorTrustedRuntimeContext } from "../../../modules/source/src/connector-runtime-application.js";
import { ConnectorRuntime } from "../../../modules/source/src/connector-runtime.js";
import { createConnectorApi018HttpRequestHandler } from "./connector-api-http-adapter.js";
import { createProductionConnectorApi018Composition } from "./connector-production-composition.js";

const now = "2026-09-01T00:00:00.000Z";
const validBodies: Readonly<Record<string, Readonly<Record<string, unknown>>>> = Object.freeze({
  RegisterConnectorInstance: { operation: "RegisterConnectorInstance", connectorId: "connector-1", instanceId: "instance-1", expectedVersion: 0, idempotencyKey: "test-1" },
  SubmitCaptureBatch: { operation: "SubmitCaptureBatch", connectorId: "connector-1", sourceId: "source-1", batchId: "batch-1", invocationId: "invocation-1", expectedVersion: 0, idempotencyKey: "test-2", captureItemEvidenceRefs: ["evidence:item:1"] },
  LeaseApprovedDelivery: { operation: "LeaseApprovedDelivery", connectorId: "connector-1", sourceId: "source-1", deliveryAttemptId: "delivery-1", expectedVersion: 0, idempotencyKey: "test-3" },
  ReportDeliveryAttempt: { operation: "ReportDeliveryAttempt", connectorId: "connector-1", sourceId: "source-1", deliveryAttemptId: "delivery-1", leaseId: "delivery-1:lease", invocationId: "delivery-invocation-1", outcome: "FAILED", reasonCode: "TECHNICAL_FAILURE", expectedVersion: 1, idempotencyKey: "test-4" },
  SubmitExternalObservation: { operation: "SubmitExternalObservation", integrationContractId: "contract-1", connectorId: "connector-1", sourceId: "source-1", observationId: "observation-1", providerNamespace: "provider-1", externalObjectId: "external-1", observationType: "STATUS", normalizedFields: { active: true }, observedAt: now, expectedVersion: 0, idempotencyKey: "test-5" },
  ReportHealth: { operation: "ReportHealth", connectorId: "connector-1", instanceId: "instance-1", observedAt: now, healthStatus: "HEALTHY", reasonCodes: ["CONNECTOR_READY"], expectedVersion: 0, idempotencyKey: "test-6" },
  ReadBatchStatus: { operation: "ReadBatchStatus", batchId: "batch-1", connectorId: "connector-1", sourceId: "source-1" },
});

function http(body: unknown, path = "/api/connectors/commands", sessionId = "session-trusted") {
  return { method: "POST", path, headers: sessionId.length === 0 ? {} : { "x-session-id": sessionId }, query: {}, pathParameters: {}, body, requestId: "request-1" };
}

function restartableComposition(databasePath: string, connector: ConnectorInvocationPort, admissionStatus: "ELIGIBLE" | "BLOCKED") {
  const session: SessionContext = Object.freeze({ id: "session-trusted", principalId: "service-1", principalType: "SERVICE", roles: Object.freeze(["SVC"] as const), teamId: "team-1", state: "ACTIVE", assurance: "WORKLOAD", isMfaVerified: false, authenticatedAt: now, expiresAt: "2026-09-01T01:00:00.000Z", absoluteExpiresAt: "2026-09-01T02:00:00.000Z", familyId: "family-1", refreshReference: "non-sensitive-reference" });
  const context: ConnectorTrustedRuntimeContext = Object.freeze({ session, tenantId: "tenant-1", scope: Object.freeze({ scopeType: "TEAM", scopeId: "team-1" }), sourceId: "source-1", connectorId: "connector-1", purpose: "LISTING_DISCOVERY", sourcePolicyVersion: 3, connectorVersion: 5, correlationId: "correlation-1" });
  const persistence = new DurableConnectorExecutionUnitOfWork({ databasePath });
  const admission = { evaluate: () => admissionStatus === "BLOCKED" ? Object.freeze({ status: "BLOCKED" as const, reasonCode: "ADMISSION_DENIED" as const }) : Object.freeze({ status: "ELIGIBLE" as const, tenantId: context.tenantId, scope: context.scope, sourceId: context.sourceId, sourcePolicyVersion: context.sourcePolicyVersion, connectorId: context.connectorId, connectorVersion: context.connectorVersion, method: "CONNECTOR", purpose: context.purpose }) };
  const coordinator = new ConnectorExecutionCoordinator({ persistence, connector, admission });
  const application = new ConnectorRuntimeApplication({ persistence, contextResolver: { resolve: () => context }, authorizer: { authorize: () => true }, coordinator, clock: () => now, externalObservationSink: { submit: () => Object.freeze({ ok: true as const, operation: "SubmitProviderObservation" as const, data: Object.freeze({ evidenceRef: "evidence:observation:1", mappingState: "ACTIVE" }) }) } });
  const host = new ConnectorApplicationHost(() => new ConnectorRuntime(application));
  host.start();
  return Object.freeze({ http: createConnectorApi018HttpRequestHandler(host), persistence, close: () => { host.stop(); persistence.close(); } });
}

test("F18-D HTTP exposes exactly seven closed operations and derives Session from the header", async () => {
  const seen: unknown[] = [];
  const handler = createConnectorApi018HttpRequestHandler({ execute: (kind: ConnectorApiRequestKind, request: unknown) => { seen.push({ kind, request }); return Object.freeze({ ok: true as const, operation: (request as { operation: typeof CONNECTOR_API_HTTP_OPERATIONS[number] }).operation, data: Object.freeze({ status: "ACCEPTED" }) }); } });
  for (const operation of CONNECTOR_API_HTTP_OPERATIONS) {
    const path = operation === "ReadBatchStatus" ? "/api/connectors/queries" : "/api/connectors/commands";
    const response = await handler.handle(http({ ...validBodies[operation], sessionId: "body-session" }, path));
    assert.equal(response.statusCode, 200, operation);
  }
  assert.equal(seen.length, 7);
  for (const item of seen as readonly { request: Record<string, unknown> }[]) assert.equal(item.request["sessionId"], "session-trusted");
});

test("F18-D HTTP rejects AdvanceCheckpoint, missing Session, authority fields, unknown fields, and oversized bodies", async () => {
  let calls = 0;
  const handler = createConnectorApi018HttpRequestHandler({ execute: () => { calls += 1; return Object.freeze({ ok: true as const, operation: "ReportHealth", data: Object.freeze({}) }); } });
  const advance = { operation: "AdvanceCheckpoint", connectorId: "connector-1", sourceId: "source-1", invocationId: "invocation-1", priorCheckpointVersion: 0, checkpointCandidate: "checkpoint:1", evidenceReference: "evidence:checkpoint:1" };
  assert.equal((await handler.handle(http(advance))).statusCode, 400);
  assert.equal((await handler.handle(http(validBodies["ReportHealth"], "/api/connectors/commands", ""))).statusCode, 401);
  assert.equal((await handler.handle(http({ ...validBodies["ReportHealth"], actorId: "forged" }))).statusCode, 400);
  assert.equal((await handler.handle(http({ ...validBodies["ReportHealth"], unknown: "value" }))).statusCode, 400);
  assert.equal((await handler.handle(http({ ...validBodies["ReportHealth"], padding: "x".repeat(70_000) }))).statusCode, 413);
  assert.equal(calls, 0);
});

test("F18-D HTTP reconstructs safe errors without stack, path, secret, or raw evidence leakage", async () => {
  const unsafe = "Bearer unsafe-value C:\\private\\source.ts raw-provider-response";
  const handler = createConnectorApi018HttpRequestHandler({ execute: () => Object.freeze({ ok: false as const, error: Object.freeze({ code: "INTERNAL_ERROR" as const, message: unsafe }) }) });
  const response = await handler.handle(http(validBodies["ReportHealth"]));
  assert.equal(response.statusCode, 500);
  assert.doesNotMatch(JSON.stringify(response.body), /Bearer|private|source\.ts|raw-provider/iu);
});

test("F18-D production composition requires durable configuration, rejects connector injection, and fails unavailable before execution mutation", async () => {
  const directory = mkdtempSync(join(tmpdir(), "f18-d-production-"));
  const session: SessionContext = Object.freeze({ id: "session-trusted", principalId: "service-1", principalType: "SERVICE", roles: Object.freeze(["SVC"] as const), teamId: "team-1", state: "ACTIVE", assurance: "WORKLOAD", isMfaVerified: false, authenticatedAt: now, expiresAt: "2026-09-01T01:00:00.000Z", absoluteExpiresAt: "2026-09-01T02:00:00.000Z", familyId: "family-1", refreshReference: "non-sensitive-reference" });
  const context: ConnectorTrustedRuntimeContext = Object.freeze({ session, tenantId: "tenant-1", scope: Object.freeze({ scopeType: "TEAM", scopeId: "team-1" }), sourceId: "source-1", connectorId: "connector-1", purpose: "LISTING_DISCOVERY", sourcePolicyVersion: 3, connectorVersion: 5, correlationId: "correlation-1" });
  const base = { databasePath: join(directory, "connector.sqlite"), runtimeEnvironment: "TEST" as const, contextResolver: { resolve: () => context }, authorizer: { authorize: () => true }, admission: { evaluate: () => Object.freeze({ status: "BLOCKED" as const, reasonCode: "ADMISSION_DENIED" as const }) }, clock: () => now, externalObservationSink: { submit: () => Object.freeze({ ok: true as const, operation: "SubmitProviderObservation" as const, data: Object.freeze({ evidenceRef: "evidence:observation:1", mappingState: "ACTIVE" }) }) } };
  try {
    assert.throws(() => createProductionConnectorApi018Composition(base), /ambiguity.*writer/i);
    const configured = { ...base, ambiguityCaseWriter: { linkAmbiguousInvocation(): void { void 0; } } };
    assert.throws(() => createProductionConnectorApi018Composition({ ...configured, databasePath: "" }), /configuration/iu);
    assert.throws(() => createProductionConnectorApi018Composition({ ...configured, connector: { invoke: () => ({}) } } as never), /not approved/iu);
    const composition = createProductionConnectorApi018Composition(configured);
    const response = await composition.http.handle(http(validBodies["SubmitCaptureBatch"]));
    assert.equal(response.statusCode, 503);
    assert.equal(composition.persistence.findTechnicalState({ tenantId: "tenant-1", scopeType: "TEAM", scopeId: "team-1", sourceId: "source-1", connectorId: "connector-1" }, "CAPTURE_BATCH", "batch-1"), undefined);
    composition.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("F18-F API-018 exact replay survives restart before blocked live admission and rejects conflicting input", async () => {
  const directory = mkdtempSync(join(tmpdir(), "f18-f-api018-replay-"));
  const databasePath = join(directory, "connector.sqlite");
  let firstCalls = 0;
  let replayCalls = 0;
  try {
    const first = restartableComposition(databasePath, { invoke: () => { firstCalls += 1; return Object.freeze({ outcome: "SUCCEEDED" as const, reasonCode: "CONFIRMED", safeEvidenceReference: "evidence:connector:1", checkpointReference: "checkpoint:1" }); } }, "ELIGIBLE");
    const firstResponse = await first.http.handle(http(validBodies["SubmitCaptureBatch"]));
    assert.equal(firstResponse.statusCode, 200);
    first.close();

    const replay = restartableComposition(databasePath, { invoke: () => { replayCalls += 1; throw new Error("must not run"); } }, "BLOCKED");
    const replayResponse = await replay.http.handle(http(validBodies["SubmitCaptureBatch"]));
    assert.deepEqual(replayResponse.body, firstResponse.body);
    assert.equal(replayCalls, 0);
    assert.equal(replay.persistence.findCheckpoint({ tenantId: "tenant-1", scopeType: "TEAM", scopeId: "team-1", sourceId: "source-1", connectorId: "connector-1" })?.version, 1);
    const conflict = await replay.http.handle(http({ ...validBodies["SubmitCaptureBatch"], captureItemEvidenceRefs: ["evidence:item:conflict"] }));
    assert.equal(conflict.statusCode, 409);
    assert.equal(replayCalls, 0);
    replay.close();
    assert.equal(firstCalls, 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("F18-F API-018 ambiguous replay survives restart with zero blind rerun", async () => {
  const directory = mkdtempSync(join(tmpdir(), "f18-f-api018-ambiguous-"));
  const databasePath = join(directory, "connector.sqlite");
  let replayCalls = 0;
  try {
    const first = restartableComposition(databasePath, { invoke: () => { throw new Error("outcome unproven"); } }, "ELIGIBLE");
    const firstResponse = await first.http.handle(http(validBodies["SubmitCaptureBatch"]));
    assert.equal(firstResponse.statusCode, 200);
    first.close();

    const replay = restartableComposition(databasePath, { invoke: () => { replayCalls += 1; throw new Error("must not run"); } }, "BLOCKED");
    const replayResponse = await replay.http.handle(http(validBodies["SubmitCaptureBatch"]));
    assert.deepEqual(replayResponse.body, firstResponse.body);
    assert.match(JSON.stringify(replayResponse.body), /AMBIGUOUS|RECONCILIATION_REQUIRED/u);
    assert.equal(replayCalls, 0);
    assert.equal(replay.persistence.findCheckpoint({ tenantId: "tenant-1", scopeType: "TEAM", scopeId: "team-1", sourceId: "source-1", connectorId: "connector-1" }), undefined);
    replay.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
