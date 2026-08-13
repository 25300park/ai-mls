import assert from "node:assert/strict";
import { request as nodeRequest } from "node:http";
import test from "node:test";

import { PublicationApi } from "../../api/src/publication-api.js";
import { AuditLog } from "../../../modules/audit/src/audit-log.js";
import { AuthorizationService, type RoleAssignment } from "../../../modules/authorization/src/authorization-service.js";
import { PublicationAggregate } from "../../../modules/publication/src/publication-aggregate.js";
import { FixedClock } from "../../../modules/publication/src/publication-clock.js";
import { createPublicationInfrastructure } from "../../../modules/publication/src/publication-infrastructure.js";
import { ConsoleReadAdapter, type ConsoleReadResult } from "./console-read-adapter.js";
import { createAdminConsoleServer } from "./console-server.js";
import { createDevelopmentConsoleSessionAdapter } from "./development-session.js";

const approvedRoutes = Object.freeze([
  "/", "/publication/operations", "/publication/revalidation", "/publication/recovery",
  "/publication/audit", "/system/projection", "/system/operations",
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
  const composed = composedReadAdapter();
  const server = createAdminConsoleServer({
    host: "127.0.0.1",
    port: 0,
    sessionId: composed.sessionId,
    tenantId: "team-a",
    readAdapter: composed.adapter,
  });
  await server.start();

  const before = composed.infrastructure.repository.find({ tenantScopeId: "team-a", publicationId: "publication-console-e2e" });
  const response = await send(server.port, "GET", "/api/console/view?page=UI-031&publicationId=publication-console-e2e");
  const after = composed.infrastructure.repository.find({ tenantScopeId: "team-a", publicationId: "publication-console-e2e" });
  const payload = JSON.parse(response.body) as { readonly html?: string };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.html?.includes("publication-console-e2e"), true);
  assert.equal(payload.html?.includes("Publication Operations"), true);
  assert.deepEqual(after, before);
  assert.equal(after?.aggregateVersion, 1);
  assert.equal(composed.commandCalls, 0);
  await server.stop();
});

function composedReadAdapter() {
  const now = "2026-08-13T00:00:00.000Z";
  const clock = new FixedClock(now);
  const session = createDevelopmentConsoleSessionAdapter({ enabled: true, runtimeEnvironment: "TEST", sessionId: "console-e2e-session", principalId: "console-e2e-operator", tenantId: "team-a", now: () => new Date(now) });
  const audit = new AuditLog({ clock: () => new Date(now), idFactory: () => "console-e2e-audit" });
  const assignments: readonly RoleAssignment[] = Object.freeze([
    roleAssignment("OPS", ["Publication", "PublicationOperations", "ListingProjectionOperationalStatus"]),
    roleAssignment("SEC", ["Publication"]),
  ]);
  const authorization = new AuthorizationService({ assignments, auditSink: audit, clock: () => new Date(now), policyVersion: "console-e2e-policy-v1" });
  const infrastructure = createPublicationInfrastructure({ clock, sessionResolver: session, authorizationEvaluator: authorization, publicationPolicyVersion: "publication-policy-v1" });
  infrastructure.repository.save(PublicationAggregate.create({
    identity: { publicationId: "publication-console-e2e", tenantScopeId: "team-a" },
    binding: { subjectId: "listing-e2e", subjectRevision: 1, representationId: "representation-e2e", representationVersion: 1, representationChecksum: "sha256:representation-e2e", approvalId: "approval-e2e", approvalVersion: 1, targetId: "target-e2e", targetVersion: 1, channelId: "channel-e2e", channelPolicyVersion: "channel-e2e-v1" },
    prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
    classification: "CONFIDENTIAL_BUSINESS",
    command: { actorId: "console-e2e-operator", authorityContext: "PUBLICATION_EXECUTION", reason: "Console composed read fixture", correlationId: "console-e2e-fixture", occurredAt: now },
  }).snapshot);
  const api = new PublicationApi(infrastructure);
  let commandCalls = 0;
  const queryPort = {
    executeQuery: (input: unknown) => api.executeQuery(input),
    executeCommand: (_input: unknown) => { commandCalls += 1; throw new Error("not allowed"); },
  };
  const adapter = new ConsoleReadAdapter({ queryPort, operationsRead: infrastructure.operationsRead, projectionRead: infrastructure.operationsProjectionRead, sessionResolver: session, authorizationEvaluator: authorization, clock });
  return { adapter, infrastructure, sessionId: session.sessionId, get commandCalls() { return commandCalls; } };
}

function roleAssignment(role: "OPS" | "SEC", resourceTypes: readonly string[]): RoleAssignment {
  return Object.freeze({ id: `console-e2e-${role}`, principalId: "console-e2e-operator", role, teamIds: Object.freeze(["team-a"]), resourceTypes: Object.freeze([...resourceTypes]), purposes: Object.freeze(["PUBLICATION_EXECUTION"]), effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveUntil: "2099-01-01T00:00:00.000Z", status: "ACTIVE" });
}

async function send(port: number, method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body = ""): Promise<Readonly<{ statusCode: number; body: string }>> {
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
