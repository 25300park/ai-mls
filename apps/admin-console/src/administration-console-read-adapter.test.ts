import assert from "node:assert/strict";
import test from "node:test";

import {
  AdministrationApiError,
  createAdministrationCollectionView,
  createAdministrationReadView,
  parseAdministrationApiRequest,
  type AdministrationApiQueryRequest,
} from "../../api/src/administration-api-contracts.js";
import { createAdministrationHttpRequestHandler } from "../../api/src/administration-http-adapter.js";
import { AdministrationConsoleReadAdapter } from "./administration-console-read-adapter.js";
import { createAdminConsoleServer } from "./console-server.js";

const request = Object.freeze({
  page: "ADMINISTRATION" as const,
  sessionId: "console-session-phase10",
  tenantId: "tenant-phase10",
  teamId: "tenant-phase10",
  correlationId: "console-administration-phase10",
});

test("F16-PHASE-10 Administration read adapter maps API-015 role assignments without inventing unsupported data", async () => {
  const handler = createAdministrationHttpRequestHandler({
    execute: () => { throw new Error("mutation path must not execute"); },
    read: () => { throw new Error("individual reads require canonical resource IDs"); },
    list: (input) => {
      const parsed = parseAdministrationApiRequest(input) as AdministrationApiQueryRequest;
      assert.equal(parsed.operation, "LIST_ROLE_ASSIGNMENTS");
      assert.equal(parsed.sessionId, "console-session-phase10");
      assert.equal(parsed.tenantId, "tenant-phase10");
      assert.deepEqual(parsed.payload.scope, { tenantId: "tenant-phase10", scopeType: "TENANT", scopeId: "tenant-phase10" });
      return createAdministrationCollectionView({ items: [
        createAdministrationReadView({
          viewType: "ROLE_ASSIGNMENT", roleAssignmentId: "assignment-active-1",
          subjectPrincipalReference: "principal-safe-1", roleId: "role-operations",
          scope: parsed.payload.scope, status: "ACTIVE", version: 3, evidenceReferences: [],
        }),
        createAdministrationReadView({
          viewType: "ROLE_ASSIGNMENT", roleAssignmentId: "assignment-revoked-1",
          subjectPrincipalReference: "principal-safe-2", roleId: "role-auditor",
          scope: parsed.payload.scope, status: "REVOKED", version: 5, evidenceReferences: [],
        }),
      ] });
    },
  });
  const adapter = new AdministrationConsoleReadAdapter(handler);

  const result = await adapter.read(request);

  assert.equal(result.state, "READY");
  assert.equal(result.data?.["visibleActiveRoleAssignmentCount"], 1);
  assert.equal(result.data?.["visibleRoleAssignmentCount"], 2);
  assert.equal(result.data?.["roleAssignmentsTruncated"], false);
  assert.equal((result.data?.["pendingProposals"] as { state?: string }).state, "UNAVAILABLE");
  assert.equal((result.data?.["recentDecisions"] as { state?: string }).state, "UNAVAILABLE");
  assert.equal((result.data?.["policyGovernance"] as { state?: string }).state, "UNAVAILABLE");
  assert.equal((result.data?.["sourceGovernance"] as { state?: string }).state, "UNAVAILABLE");
  assert.equal((result.data?.["targetGovernance"] as { state?: string }).state, "UNAVAILABLE");
  assert.equal(JSON.stringify(result).includes("evidenceReferences"), false);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.data), true);
});

test("F16-PHASE-10 Administration read adapter maps empty, authorization, and safe failure states", async () => {
  const empty = new AdministrationConsoleReadAdapter(createAdministrationHttpRequestHandler({
    execute: () => { throw new Error("not allowed"); },
    read: () => { throw new Error("not used"); },
    list: () => createAdministrationCollectionView({ items: [] }),
  }));
  const denied = new AdministrationConsoleReadAdapter(createAdministrationHttpRequestHandler({
    execute: () => { throw new Error("not allowed"); },
    read: () => { throw new Error("not used"); },
    list: () => { throw new AdministrationApiError("AUTHORIZATION_DENIED", "internal role topology"); },
  }));
  const failed = new AdministrationConsoleReadAdapter({
    handle: () => Promise.reject(new Error("C:\\restricted\\session-token-secret")),
  });

  const emptyResult = await empty.read(request);
  const deniedResult = await denied.read(request);
  const failedResult = await failed.read({ ...request, correlationId: "<unsafe-correlation>" });

  assert.equal(emptyResult.state, "READY");
  assert.equal((emptyResult.data?.["roleAssignments"] as { state?: string }).state, "EMPTY");
  assert.equal(deniedResult.state, "NOT_AUTHORIZED");
  assert.equal(JSON.stringify(deniedResult).includes("role topology"), false);
  assert.equal(failedResult.state, "ERROR");
  assert.equal(failedResult.error?.correlationId, "console-correlation-unavailable");
  assert.equal(JSON.stringify(failedResult).includes("restricted"), false);
  assert.equal(JSON.stringify(failedResult).includes("session-token-secret"), false);
});

test("F16-PHASE-10 Administration read adapter labels bounded pages as visible rather than total", async () => {
  const adapter = new AdministrationConsoleReadAdapter(createAdministrationHttpRequestHandler({
    execute: () => { throw new Error("not allowed"); },
    read: () => { throw new Error("not used"); },
    list: (input) => {
      const parsed = parseAdministrationApiRequest(input) as AdministrationApiQueryRequest;
      return createAdministrationCollectionView({
        items: [createAdministrationReadView({
          viewType: "ROLE_ASSIGNMENT", roleAssignmentId: "assignment-page-1",
          subjectPrincipalReference: "principal-page-1", roleId: "role-operations",
          scope: parsed.payload.scope, status: "ACTIVE", version: 1, evidenceReferences: [],
        })],
        nextCursor: "cursor-next-page",
      });
    },
  }));

  const result = await adapter.read(request);

  assert.equal(result.data?.["visibleActiveRoleAssignmentCount"], 1);
  assert.equal(result.data?.["visibleRoleAssignmentCount"], 1);
  assert.equal(result.data?.["roleAssignmentsTruncated"], true);
  assert.equal(Object.hasOwn(result.data ?? {}, "roleAssignmentCount"), false);
  assert.equal(Object.hasOwn(result.data ?? {}, "activeRoleAssignmentCount"), false);
});

test("F16-PHASE-10 composed browser read crosses Console server and API-015 HTTP without mutation capability", async () => {
  const handler = createAdministrationHttpRequestHandler({
    execute: () => { throw new Error("mutation path must not execute"); },
    read: () => { throw new Error("individual read must not execute"); },
    list: (input) => {
      const parsed = parseAdministrationApiRequest(input) as AdministrationApiQueryRequest;
      return createAdministrationCollectionView({ items: [createAdministrationReadView({
        viewType: "ROLE_ASSIGNMENT", roleAssignmentId: "assignment-composed-1",
        subjectPrincipalReference: "principal-composed-1", roleId: "role-operations",
        scope: parsed.payload.scope, status: "ACTIVE", version: 2, evidenceReferences: [],
      })] });
    },
  });
  const server = createAdminConsoleServer({
    host: "127.0.0.1", port: 0, sessionId: request.sessionId, tenantId: request.tenantId,
    readAdapter: new AdministrationConsoleReadAdapter(handler),
  });
  await server.start();

  const response = await fetch(`${server.localUrl}/api/console/view?page=ADMINISTRATION`);
  const payload = await response.json() as { readonly html?: string };

  assert.equal(response.status, 200);
  assert.equal(payload.html?.includes("assignment-composed-1"), true);
  assert.equal(payload.html?.includes("Administration Overview"), true);
  assert.equal(/<form|<button|data-command=/u.test(payload.html ?? ""), false);
  await server.stop();
});
