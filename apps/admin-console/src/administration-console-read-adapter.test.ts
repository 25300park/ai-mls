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

test("F16-PHASE-11A Administration read adapter obtains selector options only through canonical API-015 lists", async () => {
  const operations: string[] = [];
  const roleStatuses: unknown[] = [];
  const handler = createAdministrationHttpRequestHandler({
    execute: () => { throw new Error("mutation path must not execute"); },
    read: () => { throw new Error("individual read must not execute"); },
    list: (input) => {
      const parsed = parseAdministrationApiRequest(input) as AdministrationApiQueryRequest;
      operations.push(parsed.operation);
      if (parsed.operation === "LIST_ROLES") roleStatuses.push(parsed.payload["status"]);
      const view = parsed.operation === "LIST_ROLES" ? createAdministrationReadView({
          viewType: "ROLE", roleId: "role-selector-phase11a", scope: parsed.payload.scope,
          status: "ACTIVE", version: 2, evidenceReferences: [{ type: "AUDIT", id: "evidence-role-selector-phase11a", version: 1 }],
        }) : parsed.operation === "LIST_TEAM_SCOPES" ? createAdministrationReadView({
          viewType: "TEAM_SCOPE", teamId: "team-selector-phase11a", scope: parsed.payload.scope,
          status: "ACTIVE", version: 3, evidenceReferences: [],
        }) : parsed.operation === "LIST_POLICIES" ? createAdministrationReadView({
          viewType: "POLICY", policyId: "policy-selector-phase11a", scope: parsed.payload.scope,
          status: "ACTIVE", version: 4, evidenceReferences: [],
        }) : parsed.operation === "LIST_SOURCE_GOVERNANCE" ? createAdministrationReadView({
          viewType: "SOURCE_GOVERNANCE", sourceRegistryEntryId: "source-selector-phase11a",
          policyReference: "policy-source-selector-phase11a", scope: parsed.payload.scope,
          status: "ACTIVE", version: 5, evidenceReferences: [],
        }) : parsed.operation === "LIST_PUBLICATION_TARGET_GOVERNANCE" ? createAdministrationReadView({
          viewType: "PUBLICATION_TARGET_GOVERNANCE", publicationTargetId: "target-selector-phase11a",
          policyReference: "policy-target-selector-phase11a", channelReference: "channel-selector-phase11a",
          scope: parsed.payload.scope, status: "ACTIVE", version: 6, evidenceReferences: [],
        }) : undefined;
      return createAdministrationCollectionView({ items: view === undefined ? [] : [view] });
    },
  });
  const selectorScopes = {
    roles: { tenantId: request.tenantId, scopeType: "TENANT", scopeId: request.tenantId },
    teamScopes: { tenantId: request.tenantId, scopeType: "TEAM", scopeId: request.teamId },
    policies: { tenantId: request.tenantId, scopeType: "POLICY", scopeId: "policy-scope-selector-phase11a" },
    sourceGovernance: { tenantId: request.tenantId, scopeType: "SOURCE", scopeId: "source-scope-selector-phase11a" },
    publicationTargets: { tenantId: request.tenantId, scopeType: "TARGET", scopeId: "target-scope-selector-phase11a" },
  } as const;

  const result = await new AdministrationConsoleReadAdapter(handler).read({ ...request, selectorScopes });
  const selectors = result.data?.["selectorOptions"] as Readonly<Record<string, { readonly items: readonly { readonly id: string }[] }>>;

  assert.equal(result.state, "READY");
  assert.deepEqual(operations, ["LIST_ROLES", "LIST_TEAM_SCOPES", "LIST_POLICIES", "LIST_SOURCE_GOVERNANCE", "LIST_PUBLICATION_TARGET_GOVERNANCE"]);
  assert.deepEqual(roleStatuses, ["ACTIVE"]);
  assert.equal(selectors["roles"]?.items[0]?.id, "role-selector-phase11a");
  assert.equal(selectors["publicationTargets"]?.items[0]?.id, "target-selector-phase11a");
  assert.equal(JSON.stringify(selectors).includes("evidence-role-selector-phase11a"), false);
  assert.equal(Object.isFrozen(selectors), true);
});

test("F16-PHASE-11A selector reads fail closed without leaking denied scope or backend evidence", async () => {
  const selectorScopes = {
    roles: { tenantId: request.tenantId, scopeType: "TENANT", scopeId: request.tenantId },
    teamScopes: { tenantId: request.tenantId, scopeType: "TEAM", scopeId: request.teamId },
    policies: { tenantId: request.tenantId, scopeType: "POLICY", scopeId: "policy-denied-phase11a" },
    sourceGovernance: { tenantId: request.tenantId, scopeType: "SOURCE", scopeId: "source-denied-phase11a" },
    publicationTargets: { tenantId: request.tenantId, scopeType: "TARGET", scopeId: "target-denied-phase11a" },
  } as const;
  const adapter = new AdministrationConsoleReadAdapter({
    handle: () => Promise.resolve({
      statusCode: 403, headers: { "content-type": "application/json" },
      body: { success: false, error: { code: "AUTHORIZATION_DENIED", message: "internal capability graph" } },
      requestId: "request-selector-denied-phase11a",
    }),
  });

  const result = await adapter.read({ ...request, selectorScopes });

  assert.equal(result.state, "NOT_AUTHORIZED");
  assert.equal(JSON.stringify(result).includes("policy-denied-phase11a"), false);
  assert.equal(JSON.stringify(result).includes("capability graph"), false);
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
