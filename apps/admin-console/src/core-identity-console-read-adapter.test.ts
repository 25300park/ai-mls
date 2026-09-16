import assert from "node:assert/strict";
import test from "node:test";

import type { CoreIdentityAuthorizationHttpHandler } from "../../api/src/core-identity-authorization-http.js";
import { CoreIdentityConsoleReadAdapter } from "./core-identity-console-read-adapter.js";

const request = Object.freeze({
  sessionId: "session-staging",
  tenantId: "tenant-staging",
  scopeRef: "team-staging",
  correlationId: "correlation-staging",
});

function handler(data: unknown, statusCode = 200, observed: unknown[] = []): CoreIdentityAuthorizationHttpHandler {
  return Object.freeze({
    status: () => Object.freeze({ health: "HEALTHY" as const, readiness: "READY" as const }),
    handle: (input: unknown) => {
      observed.push(input);
      return Promise.resolve(Object.freeze({
      statusCode,
      headers: Object.freeze({ "content-type": "application/json" }),
      body: Object.freeze({ success: statusCode === 200, data }) as never,
      requestId: "request-core",
      }));
    },
  });
}

const transportPrincipal = Object.freeze({
  principalId: "principal-live",
  principalType: "HUMAN",
  roles: Object.freeze(["ADMINISTRATOR", "SEC"]),
  scopes: Object.freeze([
    Object.freeze({ tenantId: "tenant-staging" }),
    Object.freeze({ tenantId: "tenant-staging", teamId: "team-staging" }),
  ]),
  expiresAt: "2026-09-16T12:00:00.000Z",
});

test("REL001-BLOCKER2 API-001 adapter reconstructs only the four approved UI-006 fields", async () => {
  const observed: unknown[] = [];
  const result = await new CoreIdentityConsoleReadAdapter(handler(transportPrincipal, 200, observed)).readCurrentPrincipal(request);

  assert.deepEqual(result, {
    principalId: "principal-live",
    tenantId: "tenant-staging",
    roles: ["ADMINISTRATOR", "SEC"],
    scopes: [
      { tenantId: "tenant-staging" },
      { tenantId: "tenant-staging", teamId: "team-staging" },
    ],
  });
  assert.deepEqual(Object.keys(result).sort(), ["principalId", "roles", "scopes", "tenantId"]);
  assert.equal("principalType" in result, false);
  assert.equal("expiresAt" in result, false);
  assert.equal("sessionId" in result, false);
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(observed, [{
    method: "GET",
    path: "/v1/me",
    headers: { "x-session-id": "session-staging", "x-correlation-id": "correlation-staging" },
    query: {},
    pathParameters: {},
    body: null,
    requestId: "console-core-correlation-staging",
  }]);
});

test("REL001-BLOCKER2 API-001 adapter rejects mismatched or unsafe transport data", async () => {
  const cases = [
    { ...transportPrincipal, scopes: [{ tenantId: "tenant-other", teamId: "team-staging" }] },
    { ...transportPrincipal, scopes: [{ tenantId: "tenant-staging", teamId: "team-other" }] },
    { ...transportPrincipal, rawAssignment: { secret: "unsafe" } },
    { ...transportPrincipal, roles: ["ADMINISTRATOR", "Bearer secret-token"] },
    { ...transportPrincipal, expiresAt: "C:\\private\\sessions.sqlite" },
  ];
  for (const value of cases) {
    await assert.rejects(
      new CoreIdentityConsoleReadAdapter(handler(value)).readCurrentPrincipal(request),
      /CORE_IDENTITY_CONSOLE_UNAVAILABLE/u,
    );
  }
  await assert.rejects(
    new CoreIdentityConsoleReadAdapter(handler(transportPrincipal, 503)).readCurrentPrincipal(request),
    /CORE_IDENTITY_CONSOLE_UNAVAILABLE/u,
  );
});
