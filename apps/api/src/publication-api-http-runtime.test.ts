import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { request as httpRequestNode } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { PublicationApplicationHost } from "../../../modules/publication/src/publication-application-host.js";
import { PublicationAggregate } from "../../../modules/publication/src/publication-aggregate.js";
import { createTestPublicationAuthorizationConfiguration, createTestPublicationSession } from "../../../modules/publication/src/publication-authorization-test-support.test.js";
import { FixedClock } from "../../../modules/publication/src/publication-clock.js";
import { composePublicationHostApplication } from "../../../modules/publication/src/publication-composition-root.js";
import { DurablePublicationUnitOfWork } from "../../../modules/publication/src/publication-durable-persistence.js";
import { createPublicationHttpRequest } from "../../../modules/publication/src/publication-http-contracts.js";
import { createPublicationInfrastructure } from "../../../modules/publication/src/publication-infrastructure.js";
import type { PublicationInfrastructureConfigurationInput } from "../../../modules/publication/src/publication-infrastructure-configuration.js";
import {
  PUBLICATION_API_COMMAND_OPERATIONS,
  PUBLICATION_API_QUERY_OPERATIONS,
  type PublicationCommandRequest,
  type PublicationCommandResponse,
  type PublicationQueryRequest,
  type PublicationQueryResponse,
} from "./publication-api-contracts.js";
import { createPublicationApi014HttpRequestHandler } from "./publication-api-http-adapter.js";
import { PublicationApiRuntimeAdapter } from "./publication-api-runtime-adapter.js";
import { composeProductionPublicationApi014NodeHttpServer } from "./composition.js";
import { PublicationApi } from "./publication-api.js";

const operations = [...PUBLICATION_API_COMMAND_OPERATIONS, ...PUBLICATION_API_QUERY_OPERATIONS];

test("F17-D runtime adapter registers exactly the closed API-014 12 commands and 6 queries", () => {
  const calls: string[] = [];
  const adapter = new PublicationApiRuntimeAdapter({
    executeCommand(request: PublicationCommandRequest) {
      calls.push(`COMMAND:${request.operation}`);
      return Object.freeze({ requestId: request.requestId, success: false as const, operation: request.operation,
        error: Object.freeze({ code: "VALIDATION_ERROR" as const, message: "The request is invalid." }),
        metadata: Object.freeze({ correlationId: request.correlationId }) });
    },
    executeQuery(request: PublicationQueryRequest) {
      calls.push(`QUERY:${request.operation}`);
      return Object.freeze({ requestId: request.requestId, success: false as const, operation: request.operation,
        error: Object.freeze({ code: "NOT_FOUND" as const, message: "The resource was not found." }),
        metadata: Object.freeze({ correlationId: request.correlationId }) });
    },
  });

  assert.deepEqual(adapter.operations, operations);
  adapter.execute({ kind: "COMMAND", request: commandRequest("CREATE_PUBLICATION") });
  adapter.execute({ kind: "QUERY", request: queryRequest("GET_PUBLICATION") });
  assert.deepEqual(calls, ["COMMAND:CREATE_PUBLICATION", "QUERY:GET_PUBLICATION"]);
  assert.throws(() => adapter.execute({ kind: "COMMAND", request: { ...commandRequest("CREATE_PUBLICATION"), operation: "UNKNOWN" } }));
});

test("F17-D HTTP handler derives Session only from the header and traverses the Host canonical API method", async () => {
  const received: unknown[] = [];
  const handler = createPublicationApi014HttpRequestHandler({
    executeCanonicalApi(request: unknown): unknown {
      received.push(request);
      return Object.freeze({
        requestId: "request-http-command",
        success: false,
        operation: "CREATE_PUBLICATION",
        error: Object.freeze({ code: "AUTHENTICATION_REQUIRED", message: "Authentication is required." }),
        metadata: Object.freeze({ correlationId: "correlation-http" }),
      });
    },
  });
  const response = await handler.handle(createPublicationHttpRequest({
    method: "POST",
    path: "/api/publication/commands",
    headers: { "x-session-id": "session-trusted" },
    query: {},
    pathParameters: {},
    requestId: "request-http-command",
    body: { ...commandRequest("CREATE_PUBLICATION"), sessionId: "session-body", actorId: "actor-body" },
  }));

  assert.equal(response.statusCode, 401);
  assert.deepEqual(received, [{
    kind: "COMMAND",
    request: { ...commandRequest("CREATE_PUBLICATION"), sessionId: "session-trusted", actorId: "actor-body" },
  }]);
});

test("F17-D HTTP handler separates command/query routes and rejects unknown routes and operations", async () => {
  let executions = 0;
  const handler = createPublicationApi014HttpRequestHandler({
    executeCanonicalApi(): unknown {
      executions += 1;
      return Object.freeze({ requestId: "unused", success: false, error: { code: "VALIDATION_ERROR", message: "The request is invalid." }, metadata: { correlationId: "safe" } });
    },
  });
  const unknownRoute = await handler.handle(httpRequest("/api/publication/unknown", queryRequest("GET_PUBLICATION")));
  const wrongFamily = await handler.handle(httpRequest("/api/publication/queries", commandRequest("CREATE_PUBLICATION")));
  const unknownOperation = await handler.handle(httpRequest("/api/publication/commands", { ...commandRequest("CREATE_PUBLICATION"), operation: "UNKNOWN" }));

  assert.equal(unknownRoute.statusCode, 404);
  assert.equal(wrongFamily.statusCode, 400);
  assert.equal(unknownOperation.statusCode, 400);
  assert.equal(executions, 0);
});

test("F17-D production composition requires durable configuration and serves API-014 through Node HTTP", async () => {
  assert.throws(() => composeProductionPublicationApi014NodeHttpServer({
    runtimeEnvironment: "TEST",
    databasePath: "",
  }));

  const directory = mkdtempSync(join(tmpdir(), "f17-d-production-"));
  const databasePath = join(directory, "publication.sqlite");
  const composition = composeProductionPublicationApi014NodeHttpServer({
    runtimeEnvironment: "TEST",
    databasePath,
    configuration: { host: "127.0.0.1", port: 0, maximumBodyBytes: 65_536, shutdownTimeout: 250 },
  });
  try {
    await composition.server.start();
    const port = composition.server.diagnostics.boundPort;
    assert.notEqual(port, null);
    const response = await send(port!, "/api/publication/queries", queryRequest("GET_PUBLICATION"));

    assert.equal(response.statusCode, 401);
    assert.equal((JSON.parse(response.body) as { error: { code: string } }).error.code, "AUTHENTICATION_REQUIRED");
    assert.equal(readFileSync(databasePath).subarray(0, 15).toString("utf8"), "SQLite format 3");
  } finally {
    await composition.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("F17-D HTTP Host Runtime matrix dispatches exactly all 12 commands and 6 queries", async () => {
  const calls: string[] = [];
  const runtimeAdapter = new PublicationApiRuntimeAdapter({
    executeCommand(request: PublicationCommandRequest) {
      calls.push(`COMMAND:${request.operation}`);
      return commandFailure(request);
    },
    executeQuery(request: PublicationQueryRequest) {
      calls.push(`QUERY:${request.operation}`);
      return queryFailure(request);
    },
  });
  const host = canonicalHost(runtimeAdapter);
  host.start();
  try {
    assert.deepEqual(host.canonicalApiOperations, operations);
    const handler = createPublicationApi014HttpRequestHandler(host);
    for (const operation of PUBLICATION_API_COMMAND_OPERATIONS) {
      const response = await handler.handle(httpRequest("/api/publication/commands", commandRequest(operation)));
      assert.notEqual(response.statusCode, 500, operation);
    }
    for (const operation of PUBLICATION_API_QUERY_OPERATIONS) {
      const response = await handler.handle(httpRequest("/api/publication/queries", queryRequest(operation)));
      assert.notEqual(response.statusCode, 500, operation);
    }
    assert.deepEqual(calls, [
      ...PUBLICATION_API_COMMAND_OPERATIONS.map((operation) => `COMMAND:${operation}`),
      ...PUBLICATION_API_QUERY_OPERATIONS.map((operation) => `QUERY:${operation}`),
    ]);
  } finally {
    host.stop();
  }
});

test("F17-D composed API-014 path uses the Session Actor, persists one command, and keeps queries read-only", async () => {
  const infrastructure = authorizedInfrastructure();
  const host = canonicalHost(new PublicationApiRuntimeAdapter(new PublicationApi(infrastructure)));
  host.start();
  try {
    const handler = createPublicationApi014HttpRequestHandler(host);
    const create = commandRequest("CREATE_PUBLICATION", "publication-http-authorized");
    const created = await handler.handle(httpRequest("/api/publication/commands", {
      ...create,
      actorId: "actor-body-non-authoritative",
      payload: createPayload,
    }));
    assert.equal(created.statusCode, 200, JSON.stringify(created.body));
    assert.equal(infrastructure.repository.find({ tenantScopeId: "team-a", publicationId: "publication-http-authorized" })?.aggregateVersion, 1);
    assert.equal(infrastructure.audit.list({ tenantScopeId: "team-a", publicationId: "publication-http-authorized" }).at(-1)?.actorId, "executor-independent");

    const before = infrastructure.audit.list({ tenantScopeId: "team-a", publicationId: "publication-http-authorized" }).length;
    const read = await handler.handle(httpRequest("/api/publication/queries", queryRequest("GET_PUBLICATION", "publication-http-authorized")));
    assert.equal(read.statusCode, 200, JSON.stringify(read.body));
    assert.equal(infrastructure.audit.list({ tenantScopeId: "team-a", publicationId: "publication-http-authorized" }).length, before);
  } finally {
    host.stop();
  }
});

test("F17-D body Session roles and capabilities cannot elevate authority and inaccessible queries are concealed", async () => {
  const infrastructure = authorizedInfrastructure();
  const host = canonicalHost(new PublicationApiRuntimeAdapter(new PublicationApi(infrastructure)));
  host.start();
  try {
    const handler = createPublicationApi014HttpRequestHandler(host);
    const forged = commandRequest("CREATE_PUBLICATION", "publication-http-forged");
    const denied = await handler.handle(createPublicationHttpRequest({
      method: "POST", path: "/api/publication/commands", headers: {}, query: {}, pathParameters: {}, requestId: "request-forged",
      body: { ...forged, sessionId: "session-body", roles: ["ADMIN"], capabilities: ["publication.create"], isMfaVerified: true, payload: createPayload },
    }));
    assert.equal(denied.statusCode, 400);
    assert.equal(infrastructure.repository.find({ tenantScopeId: "team-a", publicationId: "publication-http-forged" }), undefined);

    const concealed = await handler.handle(httpRequest("/api/publication/queries", {
      ...queryRequest("GET_PUBLICATION", "publication-http-authorized"),
      tenantId: "tenant-other",
      teamId: "team-other",
    }));
    assert.equal(concealed.statusCode, 404);
    assert.equal(JSON.stringify(concealed.body).includes("publication-http-authorized"), false);
  } finally {
    host.stop();
  }
});

test("F17-D HTTP boundary sanitizes malformed and backend-authored error evidence", async () => {
  const request = httpRequest("/api/publication/commands", commandRequest("CREATE_PUBLICATION"));
  const unknown = await createPublicationApi014HttpRequestHandler({
    executeCanonicalApi: () => ({ success: false, error: { code: "C:\\internal\\secret", message: "token=unsafe" } }),
  }).handle(request);
  assert.equal(unknown.statusCode, 500);
  assert.deepEqual(unknown.body, { success: false, error: { code: "INTERNAL_API_ERROR", message: "The request could not be completed." } });

  const known = await createPublicationApi014HttpRequestHandler({
    executeCanonicalApi: () => ({ success: false, error: { code: "AUTHORIZATION_DENIED", message: "stack and policy internals" } }),
  }).handle(request);
  assert.equal(known.statusCode, 403);
  assert.deepEqual(known.body, { success: false, error: { code: "AUTHORIZATION_DENIED", message: "The request could not be completed." } });
});

test("F17-D durable HTTP restart contains DISPATCH_STARTED ambiguity and has zero blind provider resend", async () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-d-ambiguous-"));
  const databasePath = join(directory, "publication.sqlite");
  const publicationId = "publication-http-ambiguous";
  const identity = Object.freeze({ tenantScopeId: "team-a", publicationId });
  const attempt = Object.freeze({
    id: "attempt-http-ambiguous",
    commandId: "command-http-ambiguous",
    operation: "INITIAL_PUBLISH" as const,
    occurredAt: "2026-08-31T00:00:00.000Z",
    evidenceRefs: Object.freeze([]),
  });
  const infrastructureConfiguration = { ...authorizedConfiguration() };
  delete infrastructureConfiguration.connectorDispatcher;
  let composition = composeProductionPublicationApi014NodeHttpServer({ runtimeEnvironment: "TEST",
    databasePath,
    infrastructureConfiguration,
    configuration: serverConfiguration,
  });
  try {
    await composition.server.start();
    const port = composition.server.diagnostics.boundPort!;
    const create = await send(port, "/api/publication/commands", {
      ...commandRequest("CREATE_PUBLICATION", publicationId),
      payload: createPayload,
    }, "session-trusted");
    assert.equal(create.statusCode, 200, create.body);
    await composition.close();

    const unitOfWork = new DurablePublicationUnitOfWork({ databasePath });
    const transaction = unitOfWork.begin(identity);
    const ready = transaction.repository.find(identity);
    if (ready === undefined) throw new Error("Durable Publication setup failed.");
    const pending = PublicationAggregate.rehydrate(ready).beginInitialExecution({
      type: "BEGIN_INITIAL_EXECUTION",
      expectedAggregateVersion: ready.aggregateVersion,
      attempt,
      command: Object.freeze({ actorId: "executor-independent", authorityContext: "PUBLICATION_EXECUTION", reason: "Approved ambiguous dispatch", correlationId: "correlation-ambiguous", occurredAt: "2026-08-31T00:00:00.000Z" }),
    }).snapshot;
    transaction.repository.update(ready.aggregateVersion, pending);
    transaction.execution.prepare({ ...identity, commandId: attempt.commandId, attemptId: attempt.id, dispatchFingerprint: "sha256:durable-dispatch", providerIdempotencyKey: "provider:stable-ambiguous", preparedAt: attempt.occurredAt });
    transaction.execution.markDispatchStarted(identity, attempt.commandId, attempt.occurredAt);
    transaction.idempotency.record({ ...identity, aggregateId: publicationId, commandKey: "idempotency-ambiguous:publish", fingerprint: "sha256:ambiguous:publish", resultReference: JSON.stringify([publicationId, pending.aggregateVersion]), recordedAt: attempt.occurredAt });
    transaction.commit();
    assert.equal(unitOfWork.repository.find(identity)?.lifecycleState, "EXECUTION_PENDING");
    assert.equal(unitOfWork.idempotency.find({ ...identity, aggregateId: publicationId, commandKey: "idempotency-ambiguous:publish" })?.fingerprint, "sha256:ambiguous:publish");
    unitOfWork.close();
    const reopenedEvidence = new DurablePublicationUnitOfWork({ databasePath });
    assert.equal(reopenedEvidence.repository.find(identity)?.lifecycleState, "EXECUTION_PENDING");
    assert.equal(reopenedEvidence.idempotency.find({ ...identity, aggregateId: publicationId, commandKey: "idempotency-ambiguous:publish" })?.fingerprint, "sha256:ambiguous:publish");
    reopenedEvidence.close();

    composition = composeProductionPublicationApi014NodeHttpServer({ runtimeEnvironment: "TEST",
      databasePath,
      infrastructureConfiguration,
      configuration: serverConfiguration,
    });
    await composition.server.start();
    const restartedPort = composition.server.diagnostics.boundPort!;
    const publish = await send(restartedPort, "/api/publication/commands", {
      ...commandRequest("PUBLISH_PUBLICATION", publicationId),
      idempotencyKey: "idempotency-ambiguous",
      intentFingerprint: "sha256:ambiguous",
      correlationId: "correlation-ambiguous",
      payload: { expectedAggregateVersion: ready.aggregateVersion, attempt, occurredAt: attempt.occurredAt },
    }, "session-trusted");

    assert.equal(publish.statusCode, 409, publish.body);
    assert.equal((JSON.parse(publish.body) as { error: { code: string } }).error.code, "RECONCILIATION_REQUIRED");
    const recovered = new DurablePublicationUnitOfWork({ databasePath });
    try {
      assert.equal(recovered.repository.find(identity)?.lifecycleState, "RECONCILIATION_REQUIRED");
      // A dispatch to the unavailable adapter would produce connector-observation:*:unavailable instead.
      assert.deepEqual(recovered.execution.findReceipt(identity, attempt.commandId)?.evidenceRefs, [
        "durable-execution:attempt-http-ambiguous:outcome-unproven",
      ]);
      assert.equal(recovered.execution.findIntent(identity, attempt.commandId)?.attemptId, attempt.id);
    } finally {
      recovered.close();
    }
  } finally {
    await composition.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("F17-H real HTTP production execution persists unavailable outcome and replay remains contained after reopen", async () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-h-http-"));
  const databasePath = join(directory, "publication.sqlite");
  const publicationId = "publication-final-http";
  const identity = { tenantScopeId: "team-a", publicationId };
  const configuration = { ...authorizedConfiguration() };
  delete configuration.connectorDispatcher;
  const open = () => composeProductionPublicationApi014NodeHttpServer({ runtimeEnvironment: "TEST", databasePath, infrastructureConfiguration: configuration, configuration: serverConfiguration });
  let composition = open();
  const attempt = { id: "attempt-final-http", commandId: "command-final-http", operation: "INITIAL_PUBLISH", occurredAt: createPayload.occurredAt, evidenceRefs: [] };
  const publish = { ...commandRequest("PUBLISH_PUBLICATION", publicationId), idempotencyKey: "key-final-publish", intentFingerprint: "sha256:final-publish", payload: { expectedAggregateVersion: 1, attempt, occurredAt: createPayload.occurredAt } };
  try {
    await composition.server.start();
    let port = composition.server.diagnostics.boundPort!;
    const created = await send(port, "/api/publication/commands", { ...commandRequest("CREATE_PUBLICATION", publicationId), payload: createPayload }, "session-trusted");
    assert.equal(created.statusCode, 200, created.body);
    const first = await send(port, "/api/publication/commands", publish, "session-trusted");
    assert.equal(first.statusCode, 409, first.body);
    assert.equal((JSON.parse(first.body) as { error: { code: string } }).error.code, "RECONCILIATION_REQUIRED");
    const evidence = new DurablePublicationUnitOfWork({ databasePath });
    const snapshot = evidence.repository.find(identity);
    const receipt = evidence.execution.findReceipt(identity, attempt.commandId);
    const audit = evidence.audit.list(identity);
    assert.equal(snapshot?.lifecycleState, "RECONCILIATION_REQUIRED");
    assert.equal(snapshot?.attempts.length, 1);
    assert.equal(receipt?.outcome, "UNKNOWN");
    assert.equal(receipt?.evidenceRefs.some(reference => reference.includes("unavailable")), true);
    assert.equal(audit.every(record => record.actorId === "executor-independent"), true);
    assert.notEqual(evidence.idempotency.find({ ...identity, aggregateId: publicationId, commandKey: "key-final-publish:activation" }), undefined);
    evidence.close();
    await composition.close();
    composition = open();
    await composition.server.start();
    port = composition.server.diagnostics.boundPort!;
    const replay = await send(port, "/api/publication/commands", publish, "session-trusted");
    assert.equal(replay.statusCode, 409, replay.body);
    assert.equal((JSON.parse(replay.body) as { error: { code: string } }).error.code, "RECONCILIATION_REQUIRED");
    for (const operation of PUBLICATION_API_QUERY_OPERATIONS) {
      const result = await send(port, "/api/publication/queries", queryRequest(operation, publicationId), "session-trusted");
      assert.ok([200, 404].includes(result.statusCode), `${operation}: ${result.body}`);
      assert.doesNotMatch(result.body, /SQLite|Authorization:|NON_SECRET|stack|publication\.sqlite/);
    }
    const reopened = new DurablePublicationUnitOfWork({ databasePath });
    try {
      assert.deepEqual(reopened.repository.find(identity), snapshot);
      assert.deepEqual(reopened.execution.findReceipt(identity, attempt.commandId), receipt);
      assert.deepEqual(reopened.audit.list(identity), audit);
    } finally { reopened.close(); }
  } finally { await composition.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("F17-H real HTTP live authorization matrix blocks dispatch and durable state mutation", async () => {
  const cases = ["unauthenticated", "capability", "revoked", "expired", "tenant", "scope", "team-request", "purpose", "MFA", "SoD", "approval-expired", "approval-revoked", "representation", "target", "target-version", "aggregate-version", "verification", "permission"] as const;
  for (const scenario of cases) {
    const directory = mkdtempSync(join(tmpdir(), "f17-h-auth-"));
    const databasePath = join(directory, "publication.sqlite");
    const identity = { tenantScopeId: "team-a", publicationId: "publication-final-auth" };
    const base = { ...authorizedConfiguration() };
    delete base.connectorDispatcher;
    let deny = false;
    const configuration: PublicationInfrastructureConfigurationInput = {
      ...base,
      sessionResolver: { resolve: id => {
        const session = base.sessionResolver!.resolve(id);
        if (!deny || session === undefined) return session;
        if (scenario === "revoked") return { ...session, state: "REVOKED" };
        if (scenario === "expired") return { ...session, expiresAt: "2020-01-01T00:00:00.000Z" };
        if (scenario === "MFA") return { ...session, assurance: "SINGLE_FACTOR", isMfaVerified: false };
        if (scenario === "scope") return { ...session, teamId: "team-other" };
        return session;
      } },
      authorizationEvaluator: { evaluate: input => deny && scenario === "capability"
        ? { effect: "DENY", reasonCode: "CAPABILITY_DENIED", policyVersion: "test-v1", obligations: [], assignmentIds: [] }
        : base.authorizationEvaluator!.evaluate(input) },
      liveContextResolver: { resolve: (binding, scope) => {
        const live = base.liveContextResolver!.resolve(binding, scope);
        if (!deny || live === undefined) return live;
        switch (scenario) {
          case "tenant": return { ...live, tenantId: "tenant-other" };
          case "SoD": return { ...live, evidenceSubmitterActorIds: ["executor-independent"] };
          case "approval-expired": return { ...live, approval: { ...live.approval, expiresAt: "2020-01-01T00:00:00.000Z" } };
          case "approval-revoked": return { ...live, approval: { ...live.approval, status: "REVOKED" } };
          case "representation": return { ...live, representation: { ...live.representation, checksum: "sha256:changed" } };
          case "target": return { ...live, target: { ...live.target, status: "INACTIVE" } };
          case "target-version": return { ...live, target: { ...live.target, version: live.target.version + 1 } };
          case "verification": return { ...live, verification: { ...live.verification, version: live.verification.version + 1 } };
          case "permission": return { ...live, permission: { ...live.permission, status: "REVOKED" } };
          default: return live;
        }
      } },
    };
    const composition = composeProductionPublicationApi014NodeHttpServer({ runtimeEnvironment: "TEST", databasePath, infrastructureConfiguration: configuration, configuration: serverConfiguration });
    try {
      await composition.server.start();
      const port = composition.server.diagnostics.boundPort!;
      const created = await send(port, "/api/publication/commands", { ...commandRequest("CREATE_PUBLICATION", identity.publicationId), payload: createPayload }, "session-trusted");
      assert.equal(created.statusCode, 200, `${scenario}: ${created.body}`);
      const evidence = new DurablePublicationUnitOfWork({ databasePath });
      try {
        const before = evidence.repository.find(identity);
        deny = true;
        const response = await send(port, "/api/publication/commands", {
          ...commandRequest("PUBLISH_PUBLICATION", identity.publicationId), idempotencyKey: "key-denied-publish", intentFingerprint: "sha256:denied-publish",
          purpose: scenario === "purpose" ? "CLIENT_SERVICE" : "PUBLICATION_EXECUTION",
          teamId: scenario === "team-request" ? "team-other" : "team-a",
          payload: { expectedAggregateVersion: scenario === "aggregate-version" ? 2 : 1, occurredAt: createPayload.occurredAt, attempt: { id: "attempt-denied", commandId: "command-denied", operation: "INITIAL_PUBLISH", occurredAt: createPayload.occurredAt, evidenceRefs: [] } },
        }, scenario === "unauthenticated" ? undefined : "session-trusted");
        assert.ok([400, 401, 403, 404, 409, 422].includes(response.statusCode), `${scenario}: ${response.statusCode} ${response.body}`);
        assert.doesNotMatch(response.body, /SQLite|publication\.sqlite|stack|executor-independent/);
        assert.deepEqual(evidence.repository.find(identity), before, scenario);
        assert.equal(evidence.execution.findIntent(identity, "command-denied"), undefined, scenario);
        assert.equal(evidence.execution.findReceipt(identity, "command-denied"), undefined, scenario);
        assert.equal(evidence.idempotency.find({ ...identity, aggregateId: identity.publicationId, commandKey: "key-denied-publish:publish" }), undefined, scenario);
      } finally { evidence.close(); }
    } finally { await composition.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("F17-H real HTTP reconciliation and recovery never elevate caller-authored evidence", async () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-h-evidence-"));
  const databasePath = join(directory, "publication.sqlite");
  const configuration = { ...authorizedConfiguration() };
  delete configuration.connectorDispatcher;
  const composition = composeProductionPublicationApi014NodeHttpServer({ runtimeEnvironment: "TEST", databasePath, infrastructureConfiguration: configuration, configuration: serverConfiguration });
  const identity = { tenantScopeId: "team-a", publicationId: "publication-final-evidence" };
  try {
    await composition.server.start();
    const port = composition.server.diagnostics.boundPort!;
    const created = await send(port, "/api/publication/commands", { ...commandRequest("CREATE_PUBLICATION", identity.publicationId), payload: createPayload }, "session-trusted");
    assert.equal(created.statusCode, 200, created.body);
    const evidence = new DurablePublicationUnitOfWork({ databasePath });
    try {
      const before = evidence.repository.find(identity);
      const audit = evidence.audit.list(identity);
      for (const operation of ["RESOLVE_RECONCILIATION", "RECOVER_PUBLICATION"] as const) {
        for (const resolution of [undefined, "EFFECT_CONFIRMED"]) {
          const result = await send(port, "/api/publication/commands", {
            ...commandRequest(operation, identity.publicationId), idempotencyKey: `key-${operation}`,
            payload: { occurredAt: createPayload.occurredAt, input: { expectedAggregateVersion: 1, caseId: "case-caller", category: "TRUSTED", evidenceRefs: ["NON_SECRET_CALLER_EVIDENCE"], ...(resolution === undefined ? {} : { resolution }) } },
          }, "session-trusted");
          assert.equal(result.statusCode, 400, result.body);
          assert.equal((JSON.parse(result.body) as { error: { code: string } }).error.code, "VALIDATION_ERROR");
          assert.doesNotMatch(result.body, /NON_SECRET|case-caller|SQLite|stack/);
          assert.equal(evidence.idempotency.find({ ...identity, aggregateId: identity.publicationId, commandKey: `key-${operation}` }), undefined);
        }
      }
      assert.deepEqual(evidence.repository.find(identity), before);
      assert.deepEqual(evidence.audit.list(identity), audit);
      assert.equal(evidence.repository.find(identity)?.attempts.length, 0);
    } finally { evidence.close(); }
  } finally { await composition.close(); rmSync(directory, { recursive: true, force: true }); }
});

function commandRequest(operation: typeof PUBLICATION_API_COMMAND_OPERATIONS[number], publicationId = "publication-http"): PublicationCommandRequest {
  return {
    requestId: "request-http-command",
    operation,
    tenantId: "team-a",
    teamId: "team-a",
    purpose: "PUBLICATION_EXECUTION",
    correlationId: "correlation-http",
    publicationId,
    idempotencyKey: "idempotency-http",
    intentFingerprint: "sha256:http",
    documentedReason: "Approved F17-D HTTP request",
    payload: {},
  };
}

function queryRequest(operation: typeof PUBLICATION_API_QUERY_OPERATIONS[number], publicationId = "publication-http"): PublicationQueryRequest {
  return {
    requestId: "request-http-query",
    operation,
    tenantId: "team-a",
    teamId: "team-a",
    purpose: "PUBLICATION_EXECUTION",
    correlationId: "correlation-http-query",
    publicationId,
  };
}

function httpRequest(path: string, body: unknown) {
  return createPublicationHttpRequest({
    method: "POST",
    path,
    headers: { "x-session-id": "session-trusted" },
    query: {},
    pathParameters: {},
    requestId: "request-http",
    body,
  });
}

function send(port: number, path: string, body: unknown, sessionId?: string): Promise<{ readonly statusCode: number; readonly body: string }> {
  return new Promise((resolve, reject) => {
    const encoded = JSON.stringify(body);
    const request = httpRequestNode({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(encoded),
        ...(sessionId === undefined ? {} : { "x-session-id": sessionId }),
      },
    }, (response) => {
      let output = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { output += chunk; });
      response.on("end", () => resolve({ statusCode: response.statusCode ?? 0, body: output }));
    });
    request.on("error", reject);
    request.end(encoded);
  });
}

function canonicalHost(port: PublicationApiRuntimeAdapter): PublicationApplicationHost {
  return new PublicationApplicationHost(
    composePublicationHostApplication,
    { now: (): number => 1 },
    {
      runtimeOptions: {
        infrastructureConfiguration: createTestPublicationAuthorizationConfiguration(new FixedClock("2026-08-31T00:00:00.000Z")),
        canonicalApiPort: port,
      },
    },
  );
}

function commandFailure(request: PublicationCommandRequest): PublicationCommandResponse {
  return Object.freeze({
    requestId: request.requestId,
    success: false as const,
    operation: request.operation,
    error: Object.freeze({ code: "VALIDATION_ERROR" as const, message: "The request is invalid." }),
    metadata: Object.freeze({ correlationId: request.correlationId }),
  });
}

function queryFailure(request: PublicationQueryRequest): PublicationQueryResponse {
  return Object.freeze({
    requestId: request.requestId,
    success: false as const,
    operation: request.operation,
    error: Object.freeze({ code: "NOT_FOUND" as const, message: "The resource was not found." }),
    metadata: Object.freeze({ correlationId: request.correlationId }),
  });
}

const createPayload = Object.freeze({
  binding: Object.freeze({
    subjectId: "listing-1", subjectRevision: 3,
    representationId: "representation-1", representationVersion: 2, representationChecksum: "sha256:representation-1-v2",
    approvalId: "approval-1", approvalVersion: 4,
    targetId: "target-1", targetVersion: 5,
    channelId: "channel-1", channelPolicyVersion: "channel-policy-v3",
  }),
  prerequisites: Object.freeze({ immutableSnapshot: true, exactTargetChannel: true, provenancePresent: true }),
  classification: "CONFIDENTIAL_BUSINESS",
  occurredAt: "2026-08-31T00:00:00.000Z",
});

function authorizedInfrastructure() {
  return createPublicationInfrastructure(authorizedConfiguration());
}

function authorizedConfiguration(): PublicationInfrastructureConfigurationInput {
  const clock = new FixedClock("2026-08-31T00:00:00.000Z");
  const base = createTestPublicationAuthorizationConfiguration(clock);
  return {
    ...base,
    sessionResolver: {
      resolve: (sessionId) => sessionId === "session-trusted"
        ? createTestPublicationSession("executor-independent", "session-trusted")
        : undefined,
    },
    authorizationEvaluator: {
      evaluate: () => Object.freeze({
        effect: "ALLOW" as const,
        reasonCode: "POLICY_ALLOWED",
        policyVersion: "test-v1",
        obligations: Object.freeze(["AUDIT", "MFA", "REASON"] as const),
        assignmentIds: Object.freeze(["assignment-1"]),
      }),
    },
    effectiveApprovalPort: {
      check: (input) => Object.freeze({
        effective: true as const,
        decisionReference: `decision:${input.approvalId}:${String(input.approvalVersion)}`,
        approvalId: input.approvalId,
        approvalVersion: input.approvalVersion,
        checkedAt: "2026-08-31T00:00:00.000Z",
        effectiveScope: Object.freeze({ targetId: input.targetId, channelId: input.channelId }),
        reasonCodes: Object.freeze(["APPROVAL_EFFECTIVE"]),
      }),
    },
    connectorDispatcher: {
      dispatch: () => {
        return Object.freeze({ outcome: "CONFIRMED" as const, evidenceRefs: Object.freeze(["connector-confirmed"]), externalObjectReference: "external-safe-reference" });
      },
    },
  };
}

const serverConfiguration = Object.freeze({ host: "127.0.0.1", port: 0, maximumBodyBytes: 65_536, shutdownTimeout: 250 });
