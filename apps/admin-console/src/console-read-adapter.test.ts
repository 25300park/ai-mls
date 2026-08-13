import assert from "node:assert/strict";
import test from "node:test";

import { PublicationApi } from "../../api/src/publication-api.js";
import { AuditLog } from "../../../modules/audit/src/audit-log.js";
import { AuthorizationService, type RoleAssignment } from "../../../modules/authorization/src/authorization-service.js";
import { PublicationAggregate } from "../../../modules/publication/src/publication-aggregate.js";
import { FixedClock } from "../../../modules/publication/src/publication-clock.js";
import { createPublicationInfrastructure } from "../../../modules/publication/src/publication-infrastructure.js";
import { ConsoleReadAdapter } from "./console-read-adapter.js";
import { createDevelopmentConsoleSessionAdapter } from "./development-session.js";

const now = "2026-08-13T00:00:00.000Z";
const publicationId = "publication-console-1";
const tenantId = "team-a";

function setup() {
  const clock = new FixedClock(now);
  const session = createDevelopmentConsoleSessionAdapter({
    enabled: true,
    runtimeEnvironment: "TEST",
    sessionId: "console-session",
    principalId: "console-operator",
    tenantId,
    now: () => new Date(now),
  });
  let auditSequence = 0;
  const audit = new AuditLog({
    clock: () => new Date(now),
    idFactory: () => `console-auth-audit-${String(++auditSequence)}`,
  });
  const assignments: readonly RoleAssignment[] = Object.freeze([
    assignment("OPS", ["Publication", "PublicationOperations", "ListingProjectionOperationalStatus"]),
    assignment("SEC", ["Publication"]),
  ]);
  const authorization = new AuthorizationService({
    assignments,
    auditSink: audit,
    clock: () => new Date(now),
    policyVersion: "console-development-policy-v1",
  });
  const infrastructure = createPublicationInfrastructure({
    clock,
    sessionResolver: session,
    authorizationEvaluator: authorization,
    publicationPolicyVersion: "publication-policy-v1",
  });
  infrastructure.repository.save(PublicationAggregate.create({
    identity: { publicationId, tenantScopeId: tenantId },
    binding: {
      subjectId: "listing-console-1",
      subjectRevision: 3,
      representationId: "representation-console-1",
      representationVersion: 2,
      representationChecksum: "sha256:representation-console-1-v2",
      approvalId: "approval-console-1",
      approvalVersion: 4,
      targetId: "target-console-1",
      targetVersion: 5,
      channelId: "channel-console-1",
      channelPolicyVersion: "channel-policy-console-v1",
    },
    prerequisites: {
      immutableSnapshot: true,
      effectiveApproval: true,
      exactTargetChannel: true,
      provenancePresent: true,
    },
    classification: "CONFIDENTIAL_BUSINESS",
    command: {
      actorId: "console-operator",
      authorityContext: "PUBLICATION_EXECUTION",
      reason: "Deterministic Console read-path fixture",
      correlationId: "console-fixture-correlation",
      occurredAt: now,
    },
  }).snapshot);
  let commandCalls = 0;
  const api = new PublicationApi(infrastructure);
  const queryPort = {
    executeQuery: (request: unknown) => api.executeQuery(request),
    executeCommand: (_request: unknown) => {
      commandCalls += 1;
      throw new Error("Console must not execute commands");
    },
  };
  const adapter = new ConsoleReadAdapter({
    queryPort,
    operationsRead: infrastructure.operationsRead,
    projectionRead: infrastructure.operationsProjectionRead,
    sessionResolver: session,
    authorizationEvaluator: authorization,
    clock,
  });
  return {
    adapter,
    session,
    infrastructure,
    authorization,
    clock,
    get commandCalls() { return commandCalls; },
  };
}

function assignment(role: "OPS" | "SEC", resourceTypes: readonly string[]): RoleAssignment {
  return Object.freeze({
    id: `console-assignment-${role}`,
    principalId: "console-operator",
    role,
    teamIds: Object.freeze([tenantId]),
    resourceTypes: Object.freeze([...resourceTypes]),
    purposes: Object.freeze(["PUBLICATION_EXECUTION"]),
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveUntil: "2099-01-01T00:00:00.000Z",
    status: "ACTIVE",
  });
}

function request(page: "DASHBOARD" | "UI-031" | "UI-032" | "UI-033" | "UI-035" | "PROJECTION" | "OPERATIONS") {
  return Object.freeze({
    page,
    sessionId: "console-session",
    tenantId,
    teamId: tenantId,
    publicationId,
    correlationId: `console-${page.toLowerCase()}`,
  });
}

test("POST-F15-CONSOLE read adapter returns immutable UI-031 data through API-014 without command execution", () => {
  const setupResult = setup();
  const result = setupResult.adapter.read(request("UI-031"));

  assert.equal(result.state, "READY");
  assert.equal(result.page, "UI-031");
  assert.equal(result.data?.["screenId"], "UI-031");
  assert.equal(result.data?.["publicationId"], publicationId);
  assert.equal(setupResult.commandCalls, 0);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.data), true);
});

test("POST-F15-CONSOLE read adapter exposes bounded Dashboard, Projection and Operations status", () => {
  const { adapter } = setup();
  const dashboard = adapter.read(request("DASHBOARD"));
  const projection = adapter.read(request("PROJECTION"));
  const operations = adapter.read(request("OPERATIONS"));

  assert.equal(dashboard.state, "READY");
  assert.equal(dashboard.data?.["health"], "HEALTHY");
  assert.equal(dashboard.data?.["publicationCounts"], "NOT_AVAILABLE_IN_CURRENT_BACKEND");
  assert.equal(projection.state, "READY");
  assert.equal(projection.data?.["projectionStatus"], "UNAVAILABLE");
  assert.equal(operations.state, "READY");
  assert.equal((operations.data?.["readiness"] as { operationsRead?: boolean }).operationsRead, true);
});

test("POST-F15-CONSOLE every Console DTO is deeply immutable and no command capability is exposed", () => {
  const setupResult = setup();
  for (const page of ["UI-032", "UI-033", "UI-035", "PROJECTION", "OPERATIONS"] as const) {
    const result = setupResult.adapter.read(request(page));
    assert.equal(Object.isFrozen(result), true, page);
    assert.equal(Object.isFrozen(result.data), true, page);
    for (const value of Object.values(result.data ?? {})) {
      if (typeof value === "object" && value !== null) assert.equal(Object.isFrozen(value), true, page);
    }
  }
  assert.equal("executeCommand" in setupResult.adapter, false);
  assert.equal("rebuild" in setupResult.adapter, false);
  assert.equal("retry" in setupResult.adapter, false);
  assert.equal(setupResult.commandCalls, 0);
});

test("POST-F15-CONSOLE unavailable backend failures return only the bounded safe error", () => {
  const setupResult = setup();
  const adapter = new ConsoleReadAdapter({
    queryPort: { executeQuery: () => { throw new Error("C:\\restricted\\backend secret-token"); } },
    operationsRead: setupResult.infrastructure.operationsRead,
    projectionRead: setupResult.infrastructure.operationsProjectionRead,
    sessionResolver: setupResult.session,
    authorizationEvaluator: setupResult.authorization,
    clock: setupResult.clock,
  });

  const result = adapter.read(request("UI-031"));
  const serialized = JSON.stringify(result);
  assert.equal(result.state, "ERROR");
  assert.equal(result.error?.code, "CONSOLE_READ_UNAVAILABLE");
  assert.equal(serialized.includes("restricted"), false);
  assert.equal(serialized.includes("secret-token"), false);
});

test("POST-F15-CONSOLE missing and unauthorized Publication reads conceal protected data", () => {
  const { adapter } = setup();
  const withPublication = request("UI-032");
  const withoutPublication = {
    page: withPublication.page,
    sessionId: withPublication.sessionId,
    tenantId: withPublication.tenantId,
    teamId: withPublication.teamId,
    correlationId: withPublication.correlationId,
  };
  const missing = adapter.read(withoutPublication);
  const wrongTenant = adapter.read({ ...request("UI-031"), tenantId: "team-b", teamId: "team-b" });

  assert.equal(missing.state, "EMPTY");
  assert.equal(wrongTenant.state, "EMPTY");
  assert.equal(JSON.stringify(wrongTenant).includes(publicationId), false);
  assert.equal(JSON.stringify(wrongTenant).includes("console-operator"), false);
});
