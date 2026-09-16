import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import test from "node:test";

import type { AuthorizationDecision } from "../../../modules/authorization/src/authorization-service.js";
import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import {
  CoreIdentityAuthorizationApplication,
  createCoreIdentityAuthorizationHttpHandler,
  type CurrentPrincipalScope,
} from "./core-identity-authorization-http.js";
import { composeCoreApi001002NodeHttpServer } from "./core-identity-authorization-composition.js";

const session: SessionContext = Object.freeze({
  id: "session:protected",
  principalId: "principal-1",
  principalType: "HUMAN",
  roles: Object.freeze(["ADM" as const]),
  teamId: "team-1",
  state: "ACTIVE",
  assurance: "MFA",
  isMfaVerified: true,
  authenticatedAt: "2026-09-16T00:00:00.000Z",
  expiresAt: "2026-09-16T12:00:00.000Z",
  absoluteExpiresAt: "2026-09-16T12:00:00.000Z",
  familyId: "family:protected",
  refreshReference: "[PROTECTED]",
});

const scope: CurrentPrincipalScope = Object.freeze({
  tenantId: "tenant-1",
  teamId: "team-1",
});

function fixture(options: {
  readonly session?: SessionContext;
  readonly scopes?: readonly CurrentPrincipalScope[];
  readonly liveRoles?: readonly ("ADM" | "OPS")[];
  readonly decision?: AuthorizationDecision;
  readonly ready?: boolean;
  readonly diagnostic?: string;
} = {}) {
  const calls: unknown[] = [];
  const resolvedSession = options.session ?? session;
  const decision = options.decision ?? Object.freeze({
    effect: "ALLOW" as const,
    reasonCode: "POLICY_ALLOWED",
    policyVersion: "policy-v1",
    obligations: Object.freeze(["AUDIT" as const]),
    assignmentIds: Object.freeze(["assignment-1"]),
  });
  const application = new CoreIdentityAuthorizationApplication({
    trustedContext: Object.freeze({ tenantId: "tenant-1", teamId: "team-1", purpose: "ACCESS_GOVERNANCE" }),
    sessionAccess: {
      resolveAuthorizedWithDecision(request) {
        calls.push(request);
        if (options.diagnostic !== undefined) throw new Error(options.diagnostic);
        return Object.freeze({ session: resolvedSession, decision });
      },
    },
    liveAssignments: {
      resolveCurrentAssignments(input) {
        assert.equal(input.tenantId, "tenant-1");
        const scopes = options.scopes ?? Object.freeze([scope]);
        return Object.freeze(scopes.map((item, index) => Object.freeze({
          id: `assignment-${String(index + 1)}`,
          principalId: resolvedSession.principalId,
          role: options.liveRoles?.[index] ?? "ADM" as const,
          teamIds: Object.freeze(item.teamId === undefined ? [] : [item.teamId]),
          resourceTypes: Object.freeze(["IdentitySession"]),
          purposes: Object.freeze(["ACCESS_GOVERNANCE"]),
          effectiveFrom: "2026-09-15T00:00:00.000Z",
          effectiveUntil: "2026-09-17T00:00:00.000Z",
          status: "ACTIVE" as const,
          version: 1,
          tenantId: item.tenantId,
          subjectPrincipalType: resolvedSession.principalType,
        })));
      },
    },
    readiness: { isReady: () => options.ready ?? true },
  });
  return { application, handler: createCoreIdentityAuthorizationHttpHandler(application), calls };
}

function authorizationBody(overrides: Record<string, unknown> = {}) {
  return {
    action: "resource.view",
    resource: { type: "AdminConsole", id: "UI-006", tenantId: "tenant-1", teamId: "team-1" },
    purpose: "ACCESS_GOVERNANCE",
    ...overrides,
  };
}

function request(path: string, body: unknown = null, headers: Record<string, string> = {}) {
  return Object.freeze({
    method: path === "/v1/me" ? "GET" : "POST",
    path,
    headers: Object.freeze({
      "x-session-id": "session-1",
      "x-correlation-id": "correlation-1",
      "x-request-id": "request-1",
      ...headers,
    }),
    query: Object.freeze({}),
    pathParameters: Object.freeze({}),
    body,
    requestId: headers["x-request-id"] ?? "request-1",
  });
}

test("REL001 Blocker 1B exposes only GET /v1/me with a bounded live principal projection", async () => {
  const { handler, calls } = fixture();
  const response = await handler.handle(request("/v1/me"));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    data: {
      principalId: "principal-1",
      principalType: "HUMAN",
      roles: ["ADM"],
      scopes: [scope],
      expiresAt: "2026-09-16T12:00:00.000Z",
    },
  });
  assert.equal(calls.length, 1);
  assert.equal("refreshReference" in (response.body as { data: object }).data, false);
});

test("REL001 Blocker 1B exposes POST /v1/authorization-decisions through SessionAccessCoordinator", async () => {
  const decisionWithUnsafeExtra = Object.freeze({
    effect: "ALLOW" as const,
    reasonCode: "POLICY_ALLOWED",
    policyVersion: "policy-v1",
    obligations: Object.freeze(["AUDIT" as const]),
    assignmentIds: Object.freeze(["assignment-1"]),
    unsafeDiagnostic: "SQLITE_ERROR D:\\secret\\authorization.sqlite token=unsafe",
  }) as AuthorizationDecision;
  const { handler, calls } = fixture({ decision: decisionWithUnsafeExtra });
  const body = authorizationBody();
  const response = await handler.handle(request("/v1/authorization-decisions", body));
  assert.equal(response.statusCode, 200);
  assert.deepEqual((response.body as { data: unknown }).data, {
    effect: "ALLOW", reasonCode: "POLICY_ALLOWED", policyVersion: "policy-v1",
    obligations: ["AUDIT"], assignmentIds: ["assignment-1"],
  });
  assert.doesNotMatch(JSON.stringify(response.body), /sqlite|secret|token|unsafeDiagnostic|D:\\/iu);
  assert.equal(calls.length, 1);
});

test("REL001 Blocker 1B rejects missing Session, unrelated routes, and unsafe diagnostics", async () => {
  const { handler } = fixture();
  const missing = await handler.handle(request("/v1/me", null, { "x-session-id": "" }));
  assert.equal(missing.statusCode, 401);
  const unrelated = await handler.handle(request("/v1/sources"));
  assert.equal(unrelated.statusCode, 404);
  assert.doesNotMatch(JSON.stringify(unrelated.body), /stack|sqlite|\\\\|D:\\|token/iu);
});

test("REL001 Blocker 1B projects live assignments instead of stale Session roles", async () => {
  const stale = Object.freeze({ ...session, roles: Object.freeze(["OPS" as const]) });
  const { handler } = fixture({ session: stale, liveRoles: ["ADM"] });
  const response = await handler.handle(request("/v1/me"));
  assert.deepEqual((response.body as { data: { roles: unknown } }).data.roles, ["ADM"]);
});

test("REL001 Blocker 1B fails closed for revoked or expired Session projections", async () => {
  for (const state of ["REVOKED", "EXPIRED"] as const) {
    const { handler } = fixture({ session: Object.freeze({ ...session, state }) });
    const response = await handler.handle(request("/v1/me"));
    assert.equal(response.statusCode, 503);
  }
});

test("REL001 Blocker 1B enforces principal role and scope bounds without truncation", async () => {
  const sixtyFour = Array.from({ length: 64 }, (_, index) => Object.freeze({ tenantId: "tenant-1", teamId: `team-${String(index)}` }));
  const accepted = fixture({ scopes: sixtyFour, liveRoles: sixtyFour.map((_, index) => index % 2 === 0 ? "ADM" : "OPS") });
  const acceptedResponse = await accepted.handler.handle(request("/v1/me"));
  assert.equal(acceptedResponse.statusCode, 200);
  assert.equal((acceptedResponse.body as { data: { scopes: unknown[] } }).data.scopes.length, 64);

  const tooManyScopes = fixture({ scopes: Array.from({ length: 129 }, (_, index) => ({ tenantId: "tenant-1", teamId: `team-${String(index)}` })) });
  assert.equal((await tooManyScopes.handler.handle(request("/v1/me"))).statusCode, 503);

  const roleValues = Array.from({ length: 65 }, (_, index) => `ROLE-${String(index)}` as "ADM");
  const roleOverflow = fixture({
    scopes: roleValues.map((_, index) => ({ tenantId: "tenant-1", teamId: `team-${String(index)}` })),
    liveRoles: roleValues,
  });
  assert.equal((await roleOverflow.handler.handle(request("/v1/me"))).statusCode, 503);
});

test("REL001 Blocker 1B enforces authorization decision collection bounds", async () => {
  const obligations = Object.freeze(Array.from({ length: 65 }, () => "AUDIT" as const));
  const obligationOverflow = fixture({ decision: Object.freeze({
    effect: "ALLOW", reasonCode: "POLICY_ALLOWED", policyVersion: "policy-v1",
    obligations, assignmentIds: Object.freeze([]),
  }) });
  assert.equal((await obligationOverflow.handler.handle(request("/v1/authorization-decisions", authorizationBody()))).statusCode, 503);

  const assignmentOverflow = fixture({ decision: Object.freeze({
    effect: "ALLOW", reasonCode: "POLICY_ALLOWED", policyVersion: "policy-v1",
    obligations: Object.freeze([]), assignmentIds: Object.freeze(Array.from({ length: 257 }, (_, index) => `assignment-${String(index)}`)),
  }) });
  assert.equal((await assignmentOverflow.handler.handle(request("/v1/authorization-decisions", authorizationBody()))).statusCode, 503);
});

test("REL001 Blocker 1B enforces resource, semantic, body, key, and depth bounds", async () => {
  const { handler } = fixture();
  const oversizedId = authorizationBody({ resource: { type: "AdminConsole", id: "x".repeat(513) } });
  assert.equal((await handler.handle(request("/v1/authorization-decisions", oversizedId))).statusCode, 400);
  assert.equal((await handler.handle(request("/v1/authorization-decisions", authorizationBody({ action: "x".repeat(129) })))).statusCode, 400);
  assert.equal((await handler.handle(request("/v1/authorization-decisions", authorizationBody({ reason: "x".repeat(17_000) })))).statusCode, 400);

  const tooManyKeys = Object.fromEntries(Array.from({ length: 33 }, (_, index) => [`field${String(index)}`, "value"]));
  assert.equal((await handler.handle(request("/v1/authorization-decisions", tooManyKeys))).statusCode, 400);
  const deep = { level1: { level2: { level3: { level4: { level5: { level6: { level7: "value" } } } } } } };
  assert.equal((await handler.handle(request("/v1/authorization-decisions", deep))).statusCode, 400);
});

test("REL001 Blocker 1B enforces request and correlation header bounds", async () => {
  const { handler } = fixture();
  const correlation = await handler.handle(request("/v1/me", null, { "x-correlation-id": "c".repeat(129) }));
  assert.equal(correlation.statusCode, 400);
  const requestHeader = await handler.handle(request("/v1/me", null, { "x-request-id": "r".repeat(129) }));
  assert.equal(requestHeader.statusCode, 400);
});

test("REL001 Blocker 1B conceals tenant mismatch and maps readiness safely", async () => {
  const { handler } = fixture();
  const mismatch = authorizationBody({ resource: { type: "AdminConsole", id: "UI-006", tenantId: "tenant-other" } });
  assert.equal((await handler.handle(request("/v1/authorization-decisions", mismatch))).statusCode, 404);
  const unavailable = fixture({ ready: false });
  assert.deepEqual(unavailable.handler.status(), { health: "UNHEALTHY", readiness: "NOT_READY" });
  assert.equal((await unavailable.handler.handle(request("/v1/me"))).statusCode, 503);
  const crossTenantAssignment = fixture({ scopes: [{ tenantId: "tenant-other", teamId: "team-1" }] });
  assert.equal((await crossTenantAssignment.handler.handle(request("/v1/me"))).statusCode, 503);
});

test("REL001 Blocker 1B rejects malformed bodies and never leaks internal diagnostics", async () => {
  const { handler } = fixture({ diagnostic: "SQLITE_ERROR D:\\secret\\session.sqlite token=unsafe stack trace" });
  const failure = await handler.handle(request("/v1/me"));
  assert.equal(failure.statusCode, 500);
  assert.doesNotMatch(JSON.stringify(failure.body), /sqlite|secret|token|stack|D:\\/iu);
  const malformed = fixture();
  assert.equal((await malformed.handler.handle(request("/v1/authorization-decisions", { action: "resource.view" }))).statusCode, 400);
});

test("REL001 Blocker 1B transport has no SessionService or repository access", () => {
  const source = readFileSync("apps/api/src/core-identity-authorization-http.ts", "utf8");
  assert.doesNotMatch(source, /SessionService|SessionUnitOfWork|DurableSessionUnitOfWork|\.sessions\.|Repository/);
  assert.match(source, /resolveAuthorizedWithDecision/);
});

test("REL001 Blocker 1B Node composition requires the approved 16 KiB raw-body bound", () => {
  const { application } = fixture();
  assert.throws(() => composeCoreApi001002NodeHttpServer({
    application,
    configuration: { host: "127.0.0.1", port: 0, maximumBodyBytes: 16_385, shutdownTimeout: 250 },
  }), /CORE_API_001_002_CONFIGURATION_INVALID/);
  const server = composeCoreApi001002NodeHttpServer({
    application,
    configuration: { host: "127.0.0.1", port: 0, maximumBodyBytes: 16_384, shutdownTimeout: 250 },
  });
  assert.equal(server.configuration.maximumBodyBytes, 16_384);
});

test("REL001 Blocker 1B executes GET /v1/me through the bounded Node HTTP host", async () => {
  const { application } = fixture();
  const server = composeCoreApi001002NodeHttpServer({
    application,
    configuration: { host: "127.0.0.1", port: 0, maximumBodyBytes: 16_384, shutdownTimeout: 250 },
  });
  try {
    await server.start();
    const port = server.diagnostics.boundPort;
    assert.notEqual(port, null);
    const response = await sendHttp(port!, "GET", "/v1/me");
    assert.equal(response.statusCode, 200);
    assert.equal((response.body as { success: boolean }).success, true);
  } finally {
    if (server.diagnostics.listening) await server.stop();
  }
});

function sendHttp(port: number, method: string, path: string): Promise<{ statusCode: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const outgoing = httpRequest({
      host: "127.0.0.1",
      port,
      method,
      path,
      headers: {
        "x-session-id": "session-1",
        "x-correlation-id": "correlation-node-1",
        "x-request-id": "request-node-1",
      },
    }, (incoming) => {
      const chunks: Buffer[] = [];
      incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
      incoming.on("end", () => resolve({
        statusCode: incoming.statusCode ?? 0,
        body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown,
      }));
    });
    outgoing.on("error", reject);
    outgoing.end();
  });
}
