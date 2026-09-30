import assert from "node:assert/strict";
import { request as nodeRequest } from "node:http";
import test from "node:test";

import { PublicationApi } from "../../api/src/publication-api.js";
import { AuditLog } from "../../../modules/audit/src/audit-log.js";
import { AuthorizationService, type RoleAssignment } from "../../../modules/authorization/src/authorization-service.js";
import { PublicationAggregate } from "../../../modules/publication/src/publication-aggregate.js";
import { FixedClock } from "../../../modules/publication/src/publication-clock.js";
import { createPublicationInfrastructure } from "../../../modules/publication/src/publication-infrastructure.js";
import { ConsoleReadAdapter, type ConsoleReadRequest, type ConsoleReadResult } from "./console-read-adapter.js";
import { createAdminConsoleServer } from "./console-server.js";
import { createDevelopmentConsoleSessionAdapter } from "./development-session.js";
import type { AdministrationConsoleCommandRequest } from "./administration-console-read-adapter.js";

const approvedRoutes = Object.freeze([
  "/", "/publication/operations", "/publication/revalidation", "/publication/recovery",
  "/publication/audit", "/administration", "/administration/governance", "/system/projection", "/system/operations",
  "/connector/operations",
  "/recovery/cases",
  "/integration/evidence", "/audit/evidence",
]);

test("POST-F15-CONSOLE Node server renders every approved browser route and bounded read endpoint", async () => {
  let readCalls = 0;
  const server = createAdminConsoleServer({
    host: "127.0.0.1",
    port: 0,
    sessionId: "console-session",
    tenantId: "team-a",
    readAdapter: {
      read: (input) => {
        readCalls += 1;
        return Object.freeze({ page: input.page, state: "EMPTY", message: "No Publication records are currently available." }) satisfies ConsoleReadResult;
      },
    },
  });
  await server.start();

  for (const route of approvedRoutes) {
    const response = await send(server.port, "GET", route);
    assert.equal(response.statusCode, 200, route);
    assert.equal(response.body.includes("AI-MLS ADMIN"), true, route);
    assert.equal(response.body.includes("Loading..."), true, route);
  }
  const view = await send(server.port, "GET", "/api/console/view?page=UI-031&publicationId=publication-console-1");
  assert.equal(view.statusCode, 200);
  const payload = JSON.parse(view.body) as { readonly html?: string };
  assert.equal(payload.html?.includes("No Publication records are currently available."), true);
  assert.equal(readCalls, 1);
  await server.stop();
});

test("F20-D Node server passes only bounded Connector read identities to the existing Console adapter", async () => {
  const reads: ConsoleReadRequest[] = [];
  const server = createAdminConsoleServer({
    host: "127.0.0.1",
    port: 0,
    sessionId: "console-session",
    tenantId: "team-a",
    readAdapter: {
      read: (input) => {
        reads.push(input);
        return Object.freeze({ page: input.page, state: "EMPTY", message: "No authorized Connector batch is currently available." });
      },
    },
  });
  await server.start();

  const shell = await send(server.port, "GET", "/connector/operations?connectorId=connector-1&sourceId=source-1&batchId=batch-1");
  const view = await send(server.port, "GET", "/api/console/view?page=CONNECTOR&connectorId=connector-1&sourceId=source-1&batchId=batch-1");

  assert.equal(shell.statusCode, 200);
  assert.equal(shell.body.includes('data-console-page="CONNECTOR"'), true);
  assert.equal(view.statusCode, 200);
  assert.equal(reads.length, 1);
  assert.equal(reads[0]?.page, "CONNECTOR");
  assert.equal(reads[0]?.connectorId, "connector-1");
  assert.equal(reads[0]?.sourceId, "source-1");
  assert.equal(reads[0]?.batchId, "batch-1");
  assert.equal("checkpointCandidate" in (reads[0] ?? {}), false);
  await server.stop();
});

test("F20-E Node server passes only the exact Recovery Case identity to the existing Console adapter", async () => {
  const reads: ConsoleReadRequest[] = [];
  const server = createAdminConsoleServer({
    host: "127.0.0.1",
    port: 0,
    sessionId: "console-session",
    tenantId: "team-a",
    readAdapter: {
      read: (input) => {
        reads.push(input);
        return Object.freeze({ page: input.page, state: "EMPTY", message: "No authorized Recovery Case is currently available." });
      },
    },
  });
  await server.start();

  const shell = await send(server.port, "GET", "/recovery/cases?recoveryCaseId=recovery-case-1");
  const view = await send(server.port, "GET", "/api/console/view?page=RECOVERY_CASE&recoveryCaseId=recovery-case-1&connectorId=connector-cross&sourceId=source-cross&batchId=batch-cross");

  assert.equal(shell.statusCode, 200);
  assert.equal(shell.body.includes('data-console-page="RECOVERY_CASE"'), true);
  assert.equal(view.statusCode, 200);
  assert.equal(reads.length, 1);
  assert.equal(reads[0]?.page, "RECOVERY_CASE");
  assert.equal(reads[0]?.recoveryCaseId, "recovery-case-1");
  assert.equal(reads[0]?.connectorId, undefined);
  assert.equal(reads[0]?.sourceId, undefined);
  assert.equal(reads[0]?.batchId, undefined);
  assert.equal("recoveryDisposition" in (reads[0] ?? {}), false);
  await server.stop();
});

test("F20-F Node server page-gates exact Integration and Audit evidence query inputs", async () => {
  const reads: ConsoleReadRequest[] = [];
  const server = createAdminConsoleServer({
    host: "127.0.0.1", port: 0, sessionId: "console-session", tenantId: "team-a",
    readAdapter: { read: (input) => { reads.push(input); return Object.freeze({ page: input.page, state: "EMPTY", message: "No authorized evidence is currently available." }); } },
  });
  await server.start();

  const integrationShell = await send(server.port, "GET", "/integration/evidence?mappingId=mapping-1");
  const integration = await send(server.port, "GET", "/api/console/view?page=EXTERNAL_INTEGRATION&mappingId=mapping-1&auditTargetId=ignored-target");
  const auditShell = await send(server.port, "GET", "/audit/evidence?auditTargetId=resource-1&auditEventType=RECOVERY_READ");
  const audit = await send(server.port, "GET", "/api/console/view?page=EVIDENCE&auditTargetId=resource-1&auditEventType=RECOVERY_READ&mappingId=ignored-mapping");
  const ambiguous = await send(server.port, "GET", "/api/console/view?page=EXTERNAL_INTEGRATION&mappingId=mapping-1&integrationContractId=contract-1");

  assert.equal(integrationShell.statusCode, 200);
  assert.equal(auditShell.statusCode, 200);
  assert.equal(integration.statusCode, 200);
  assert.equal(audit.statusCode, 200);
  assert.equal(ambiguous.statusCode, 400);
  assert.deepEqual(reads.map((item) => ({ page: item.page, mappingId: item.mappingId, auditTargetId: item.auditTargetId, auditEventType: item.auditEventType })), [
    { page: "EXTERNAL_INTEGRATION", mappingId: "mapping-1", auditTargetId: undefined, auditEventType: undefined },
    { page: "EVIDENCE", mappingId: undefined, auditTargetId: "resource-1", auditEventType: "RECOVERY_READ" },
  ]);
  await server.stop();
});

test("F16-PHASE-10 Node server exposes the read-only UI-006 Administration route", async () => {
  const pages: string[] = [];
  const server = createAdminConsoleServer({
    host: "127.0.0.1",
    port: 0,
    sessionId: "console-session",
    tenantId: "team-a",
    readAdapter: {
      read: (input) => {
        pages.push(input.page);
        return Object.freeze({ page: input.page, state: "UNAVAILABLE", message: "Administration data is unavailable." }) satisfies ConsoleReadResult;
      },
    },
  });
  await server.start();

  const shell = await send(server.port, "GET", "/administration");
  const view = await send(server.port, "GET", "/api/console/view?page=ADMINISTRATION");

  assert.equal(shell.statusCode, 200);
  assert.equal(shell.body.includes("Administration"), true);
  assert.equal(shell.body.includes('data-console-page="ADMINISTRATION"'), true);
  assert.equal(view.statusCode, 200);
  assert.deepEqual(pages, ["ADMINISTRATION"]);
  await server.stop();
});
test("F16-PHASE-10 Node server awaits the injected asynchronous Administration read boundary", async () => {
  const server = createAdminConsoleServer({
    host: "127.0.0.1",
    port: 0,
    sessionId: "console-session",
    tenantId: "team-a",
    readAdapter: {
      read: (input: ConsoleReadRequest) => Promise.resolve(Object.freeze({
        page: input.page,
        state: "READY",
        data: Object.freeze({
          activeRoleAssignmentCount: 0,
          roleAssignmentCount: 0,
          roleAssignments: Object.freeze({ state: "EMPTY", items: Object.freeze([]) }),
          pendingProposals: Object.freeze({ state: "UNAVAILABLE" }),
          recentDecisions: Object.freeze({ state: "UNAVAILABLE" }),
          policyGovernance: Object.freeze({ state: "UNAVAILABLE" }),
          sourceGovernance: Object.freeze({ state: "UNAVAILABLE" }),
          targetGovernance: Object.freeze({ state: "UNAVAILABLE" }),
          authorityStatus: "AUTHORIZED",
          administrationApiStatus: "AVAILABLE",
        }),
      })),
    },
  });
  await server.start();
  const response = await send(server.port, "GET", "/api/console/view?page=ADMINISTRATION");
  const payload = JSON.parse(response.body) as { readonly html?: string };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.html?.includes("Administration Overview"), true);
  assert.equal(payload.html?.includes("No role assignments are currently available."), true);
  await server.stop();
});
test("F16-PHASE-11 Node server uses trusted command context and refreshes UI-036 after confirmed mutation", async () => {
  const commands: AdministrationConsoleCommandRequest[] = [];
  const pages: string[] = [];
  const selectorScopes = Object.freeze({
    roles: { tenantId: "tenant-a", scopeType: "TENANT" as const, scopeId: "tenant-a" },
    teamScopes: { tenantId: "tenant-a", scopeType: "TEAM" as const, scopeId: "team-a" },
    policies: { tenantId: "tenant-a", scopeType: "POLICY" as const, scopeId: "policy-scope-a" },
    sourceGovernance: { tenantId: "tenant-a", scopeType: "SOURCE" as const, scopeId: "source-scope-a" },
    publicationTargets: { tenantId: "tenant-a", scopeType: "TARGET" as const, scopeId: "target-scope-a" },
  });
  const server = createAdminConsoleServer({
    host: "127.0.0.1", port: 0, sessionId: "trusted-console-session", tenantId: "tenant-a",
    readAdapter: { read: (input) => { pages.push(input.page); return { page: input.page, state: "READY", data: { selectorOptions: {} } }; } },
    administrationCommandAdapter: { execute: async (input) => {
      await Promise.resolve();
      commands.push(input);
      return Promise.resolve(Object.freeze({
        state: "CONFIRMED" as const, operation: input.operation, proposalId: "proposal-server-phase11",
        resourceType: "POLICY", resourceId: "policy-a", status: "PROPOSED", version: 1, decisionReferences: Object.freeze([]),
      }));
    } },
    administrationSelectorScopes: selectorScopes,
  });
  await server.start();

  const shell = await send(server.port, "GET", "/administration/governance");
  const response = await send(server.port, "POST", "/api/console/administration/command", JSON.stringify({
    operation: "PROPOSE_POLICY_CHANGE",
    payload: {
      policyId: "policy-a", proposedChangeReference: "change-a", scope: { tenantId: "tenant-a", scopeType: "POLICY", scopeId: "policy-scope-a" },
      expectedVersion: 4, idempotencyKey: "idempotency-server-phase11", reason: "Governed policy proposal", evidenceReferences: [],
    },
  }));
  const payload = JSON.parse(response.body) as { readonly result?: { readonly status?: string }; readonly html?: string };

  assert.equal(shell.statusCode, 200);
  assert.equal(shell.body.includes('data-console-page="UI-036"'), true);
  assert.equal(response.statusCode, 200);
  assert.equal(payload.result?.status, "PROPOSED");
  assert.equal(typeof payload.html, "string");
  assert.equal(commands.length, 1);
  assert.equal(commands[0]?.sessionId, "trusted-console-session");
  assert.equal(commands[0]?.tenantId, "tenant-a");
  assert.equal(Object.hasOwn(commands[0] ?? {}, "actorId"), false);
  assert.deepEqual(pages, ["UI-036"]);
  await server.stop();
});
test("F16-PHASE-11 UI-036 fails unavailable before reads when trusted governed scopes are absent", async () => {
  let readCalls = 0;
  const server = createAdminConsoleServer({
    host: "127.0.0.1", port: 0, sessionId: "trusted-console-session", tenantId: "tenant-a",
    readAdapter: { read: () => { readCalls += 1; return { page: "ADMINISTRATION", state: "READY", data: {} }; } },
    administrationCommandAdapter: { execute: async () => {
      await Promise.resolve(); throw new Error("must not execute"); } },
  });
  await server.start();
  const response = await send(server.port, "GET", "/api/console/view?page=UI-036");
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.includes("Authorized governed selector scopes are unavailable."), true);
  assert.equal(response.body.includes("Administration Overview"), false);
  assert.equal(readCalls, 0);
  await server.stop();
});


test("F16-PHASE-11 Node server rejects browser authority and unsupported command routes without side effects", async () => {
  let calls = 0;
  const server = createAdminConsoleServer({
    host: "127.0.0.1", port: 0, sessionId: "trusted-console-session", tenantId: "tenant-a",
    readAdapter: { read: (input) => ({ page: input.page, state: "READY", data: { selectorOptions: {} } }) },
    administrationCommandAdapter: { execute: async () => {
      await Promise.resolve(); calls += 1; throw new Error("must not execute"); } },
  });
  await server.start();
  const spoofed = await send(server.port, "POST", "/api/console/administration/command", JSON.stringify({ operation: "PROPOSE_POLICY_CHANGE", payload: {}, actorId: "spoofed" }));
  const publication = await send(server.port, "POST", "/api/console/publication/command", JSON.stringify({ operation: "PUBLISH_PUBLICATION", payload: {} }));
  assert.equal(spoofed.statusCode, 400);
  assert.equal(spoofed.body.includes("INVALID_CONSOLE_REQUEST"), true);
  assert.equal(spoofed.body.includes("spoofed"), false);
  assert.equal(publication.statusCode, 405);
  assert.equal(calls, 0);
  await server.stop();
});

test("POST-F15-CONSOLE Node server has zero mutation routes and returns safe failures", async () => {
  let readCalls = 0;
  const server = createAdminConsoleServer({
    host: "127.0.0.1",
    port: 0,
    sessionId: "console-session",
    tenantId: "team-a",
    readAdapter: { read: () => { readCalls += 1; return { page: "DASHBOARD", state: "READY", data: {} }; } },
  });
  await server.start();

  const rejectedPost = await send(server.port, "POST", "/api/console/view", "{\"operation\":\"PUBLISH_PUBLICATION\"}");
  const rejectedPatch = await send(server.port, "PATCH", "/publication/operations", "{}");
  const rejectedDelete = await send(server.port, "DELETE", "/system/projection");
  const missing = await send(server.port, "GET", "/internal/repository");
  assert.equal(rejectedPost.statusCode, 405);
  assert.equal(rejectedPatch.statusCode, 405);
  assert.equal(rejectedDelete.statusCode, 405);
  assert.equal(rejectedPost.body.includes("METHOD_NOT_ALLOWED"), true);
  assert.equal(rejectedPost.body.includes("PUBLISH_PUBLICATION"), false);
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.body.includes("ROUTE_NOT_FOUND"), true);
  assert.equal(readCalls, 0);
  await server.stop();
});

test("POST-F15-CONSOLE composed loopback carries existing FEAT-015 data through API-014 without mutation", async () => {
  const composed = await composedReadAdapter();
  const server = createAdminConsoleServer({
    host: "127.0.0.1",
    port: 0,
    sessionId: composed.sessionId,
    tenantId: "team-a",
    readAdapter: composed.adapter,
  });
  await server.start();

  const before = await composed.infrastructure.repository.find({ tenantScopeId: "team-a", publicationId: "publication-console-e2e" });
  const response = await send(server.port, "GET", "/api/console/view?page=UI-031&publicationId=publication-console-e2e");
  const after = await composed.infrastructure.repository.find({ tenantScopeId: "team-a", publicationId: "publication-console-e2e" });
  const payload = JSON.parse(response.body) as { readonly html?: string };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.html?.includes("publication-console-e2e"), true);
  assert.equal(payload.html?.includes("Publication Operations"), true);
  assert.deepEqual(after, before);
  assert.equal(after?.aggregateVersion, 1);
  assert.equal(composed.commandCalls, 0);
  await server.stop();
});

async function composedReadAdapter() {
  const now = "2026-08-13T00:00:00.000Z";
  const clock = new FixedClock(now);
  const session = createDevelopmentConsoleSessionAdapter({ enabled: true, runtimeEnvironment: "TEST", sessionId: "console-e2e-session", principalId: "console-e2e-operator", tenantId: "team-a", now: () => new Date(now) });
  const audit = new AuditLog({ clock: () => new Date(now), idFactory: () => "console-e2e-audit" });
  const assignments: readonly RoleAssignment[] = Object.freeze([
    roleAssignment("OPS", ["Publication", "PublicationOperations", "ListingProjectionOperationalStatus"]),
    roleAssignment("SEC", ["Publication"]),
  ]);
  const authorization = new AuthorizationService({ assignments, authoritySource: "STATIC_TEST_COMPATIBILITY", auditSink: audit, clock: () => new Date(now), policyVersion: "console-e2e-policy-v1" });
  const infrastructure = createPublicationInfrastructure({ clock, sessionResolver: session, authorizationEvaluator: authorization, publicationPolicyVersion: "publication-policy-v1" });
  await infrastructure.repository.save(PublicationAggregate.create({
    identity: { publicationId: "publication-console-e2e", tenantScopeId: "team-a" },
    binding: { subjectId: "listing-e2e", subjectRevision: 1, representationId: "representation-e2e", representationVersion: 1, representationChecksum: "sha256:representation-e2e", approvalId: "approval-e2e", approvalVersion: 1, targetId: "target-e2e", targetVersion: 1, channelId: "channel-e2e", channelPolicyVersion: "channel-e2e-v1" },
    prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
    classification: "CONFIDENTIAL_BUSINESS",
    command: { actorId: "console-e2e-operator", authorityContext: "PUBLICATION_EXECUTION", reason: "Console composed read fixture", correlationId: "console-e2e-fixture", occurredAt: now },
  }).snapshot);
  const api = new PublicationApi(infrastructure);
  let commandCalls = 0;
  const queryPort = {
    executeQuery: async (input: unknown) => { await Promise.resolve(); return api.executeQuery(input); },
    executeCommand: (_input: unknown) => { commandCalls += 1; throw new Error("not allowed"); },
  };
  const adapter = new ConsoleReadAdapter({ queryPort, operationsRead: infrastructure.operationsRead, projectionRead: infrastructure.operationsProjectionRead, sessionResolver: session, authorizationEvaluator: authorization, clock });
  return { adapter, infrastructure, sessionId: session.sessionId, get commandCalls() { return commandCalls; } };
}

function roleAssignment(role: "OPS" | "SEC", resourceTypes: readonly string[]): RoleAssignment {
  return Object.freeze({ id: `console-e2e-${role}`, principalId: "console-e2e-operator", role, teamIds: Object.freeze(["team-a"]), resourceTypes: Object.freeze([...resourceTypes]), purposes: Object.freeze(["PUBLICATION_EXECUTION"]), effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveUntil: "2099-01-01T00:00:00.000Z", status: "ACTIVE" });
}

async function send(port: number, method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body = ""): Promise<Readonly<{ statusCode: number; body: string }>> {
  await Promise.resolve();
  return new Promise((resolve, reject) => {
    const request = nodeRequest({ host: "127.0.0.1", port, method, path, headers: body === "" ? {} : { "content-type": "application/json", "content-length": Buffer.byteLength(body) } }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve(Object.freeze({ statusCode: response.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") })));
    });
    request.on("error", reject);
    request.end(body);
  });
}
