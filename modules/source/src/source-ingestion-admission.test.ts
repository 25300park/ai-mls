import assert from "node:assert/strict";
import test from "node:test";

import type { SessionContext } from "../../identity/src/session-service.js";
import {
  SourceIngestionAdmissionGate,
  type ConnectorAdmissionSnapshot,
  type SourceIngestionAdmissionInput,
  type SourceIngestionPolicySnapshot,
} from "./source-ingestion-admission.js";

const actor: SessionContext = Object.freeze({
  id: "session-f18-b-1",
  principalId: "collector-service-1",
  principalType: "SERVICE",
  roles: Object.freeze(["SVC"] as const),
  teamId: "team-1",
  state: "ACTIVE",
  assurance: "WORKLOAD",
  isMfaVerified: false,
  authenticatedAt: "2026-09-01T00:00:00.000Z",
  expiresAt: "2026-09-01T01:00:00.000Z",
  absoluteExpiresAt: "2026-09-01T02:00:00.000Z",
  familyId: "family-f18-b-1",
  refreshReference: "non-secret-test-reference",
});

const source: SourceIngestionPolicySnapshot = Object.freeze({
  sourceId: "source-1",
  tenantId: "tenant-1",
  scope: Object.freeze({ scopeType: "TEAM", scopeId: "team-1" }),
  status: "ACTIVE",
  version: 3,
  allowedMethods: Object.freeze(["CONNECTOR"]),
  allowedPurposes: Object.freeze(["LISTING_DISCOVERY"]),
  classification: "CONFIDENTIAL_BUSINESS",
});

const inactiveConnector: ConnectorAdmissionSnapshot = Object.freeze({
  connectorId: "connector-1",
  tenantId: "tenant-1",
  scope: Object.freeze({ scopeType: "TEAM", scopeId: "team-1" }),
  status: "PAUSED",
  version: 5,
  sourceIds: Object.freeze(["source-1"]),
  allowedMethods: Object.freeze(["CONNECTOR"]),
  allowedPurposes: Object.freeze(["LISTING_DISCOVERY"]),
});

const activeConnector: ConnectorAdmissionSnapshot = Object.freeze({
  ...inactiveConnector,
  status: "ACTIVE",
});

const input: SourceIngestionAdmissionInput = Object.freeze({
  actor,
  tenantId: "tenant-1",
  scope: Object.freeze({ scopeType: "TEAM", scopeId: "team-1" }),
  sourceId: "source-1",
  sourcePolicyVersion: 3,
  connectorId: "connector-1",
  connectorVersion: 5,
  method: "CONNECTOR",
  purpose: "LISTING_DISCOVERY",
  correlationId: "correlation-f18-b-1",
});

test("F18-B blocks inactive Connector admission before invocation or authoritative mutation", () => {
  const beforeSource = structuredClone(source);
  const beforeConnector = structuredClone(inactiveConnector);
  const gate = new SourceIngestionAdmissionGate({
    sourcePolicies: { readCurrent: () => source },
    connectors: { readCurrent: () => inactiveConnector },
    authorization: {
      evaluate: () => Object.freeze({
        effect: "ALLOW" as const,
        reasonCode: "AUTHORIZED",
        policyVersion: "policy-v1",
        obligations: Object.freeze(["AUDIT" as const]),
        assignmentIds: Object.freeze(["assignment-1"]),
      }),
    },
  });

  const decision = gate.evaluate(input);
  let connectorInvocations = 0;
  if (decision.status === "ELIGIBLE") connectorInvocations += 1;

  assert.deepEqual(decision, { status: "BLOCKED", reasonCode: "ADMISSION_DENIED" });
  assert.equal(connectorInvocations, 0);
  assert.deepEqual(source, beforeSource);
  assert.deepEqual(inactiveConnector, beforeConnector);
});

test("F18-B blocks missing, inactive, stale, mismatched, or disallowed Source policy", () => {
  const cases: readonly Readonly<{
    name: string;
    current: SourceIngestionPolicySnapshot | undefined;
  }>[] = [
    { name: "missing", current: undefined },
    { name: "inactive", current: Object.freeze({ ...source, status: "PAUSED" }) },
    { name: "wrong tenant", current: Object.freeze({ ...source, tenantId: "tenant-2" }) },
    { name: "wrong identity", current: Object.freeze({ ...source, sourceId: "source-2" }) },
    { name: "stale version", current: Object.freeze({ ...source, version: 2 }) },
    { name: "disallowed method", current: Object.freeze({ ...source, allowedMethods: Object.freeze(["MANUAL"]) }) },
    { name: "disallowed purpose", current: Object.freeze({ ...source, allowedPurposes: Object.freeze(["OTHER_PURPOSE"]) }) },
  ];

  for (const item of cases) {
    const gate = new SourceIngestionAdmissionGate({
      sourcePolicies: { readCurrent: () => item.current },
      connectors: { readCurrent: () => activeConnector },
      authorization: {
        evaluate: () => Object.freeze({
          effect: "ALLOW" as const,
          reasonCode: "AUTHORIZED",
          policyVersion: "policy-v1",
          obligations: Object.freeze(["AUDIT" as const]),
          assignmentIds: Object.freeze(["assignment-1"]),
        }),
      },
    });

    const decision = gate.evaluate(input);
    assert.deepEqual(decision, { status: "BLOCKED", reasonCode: "ADMISSION_DENIED" }, item.name);
  }
});

test("F18-B blocks missing, stale, mismatched, or disallowed Connector configuration", () => {
  const cases: readonly Readonly<{
    name: string;
    current: ConnectorAdmissionSnapshot | undefined;
  }>[] = [
    { name: "missing", current: undefined },
    { name: "wrong tenant", current: Object.freeze({ ...activeConnector, tenantId: "tenant-2" }) },
    { name: "wrong identity", current: Object.freeze({ ...activeConnector, connectorId: "connector-2" }) },
    { name: "stale version", current: Object.freeze({ ...activeConnector, version: 4 }) },
    { name: "wrong source", current: Object.freeze({ ...activeConnector, sourceIds: Object.freeze(["source-2"]) }) },
    { name: "disallowed method", current: Object.freeze({ ...activeConnector, allowedMethods: Object.freeze(["MANUAL"]) }) },
    { name: "disallowed purpose", current: Object.freeze({ ...activeConnector, allowedPurposes: Object.freeze(["OTHER_PURPOSE"]) }) },
  ];

  for (const item of cases) {
    const gate = new SourceIngestionAdmissionGate({
      sourcePolicies: { readCurrent: () => source },
      connectors: { readCurrent: () => item.current },
      authorization: {
        evaluate: () => Object.freeze({
          effect: "ALLOW" as const,
          reasonCode: "AUTHORIZED",
          policyVersion: "policy-v1",
          obligations: Object.freeze(["AUDIT" as const]),
          assignmentIds: Object.freeze(["assignment-1"]),
        }),
      },
    });

    assert.deepEqual(gate.evaluate(input), {
      status: "BLOCKED",
      reasonCode: "ADMISSION_DENIED",
    }, item.name);
  }
});

test("F18-B blocks scope or team drift and denied live authority", () => {
  const otherScope = Object.freeze({ scopeType: "TEAM" as const, scopeId: "team-2" });
  const otherActor = Object.freeze({ ...actor, teamId: "team-2" });
  const cases: readonly Readonly<{
    name: string;
    request?: SourceIngestionAdmissionInput;
    currentSource?: SourceIngestionPolicySnapshot;
    currentConnector?: ConnectorAdmissionSnapshot;
    deniedAction?: "source.read" | "intake.create";
  }>[] = [
    { name: "source scope drift", currentSource: Object.freeze({ ...source, scope: otherScope }) },
    { name: "connector scope drift", currentConnector: Object.freeze({ ...activeConnector, scope: otherScope }) },
    { name: "request scope drift", request: Object.freeze({ ...input, scope: otherScope }) },
    { name: "actor team drift", request: Object.freeze({ ...input, actor: otherActor }) },
    { name: "source read authority denied", deniedAction: "source.read" },
    { name: "intake create authority denied", deniedAction: "intake.create" },
  ];

  for (const item of cases) {
    const gate = new SourceIngestionAdmissionGate({
      sourcePolicies: { readCurrent: () => item.currentSource ?? source },
      connectors: { readCurrent: () => item.currentConnector ?? activeConnector },
      authorization: {
        evaluate: (request) => Object.freeze({
          effect: request.action === item.deniedAction ? "DENY" as const : "ALLOW" as const,
          reasonCode: request.action === item.deniedAction ? "AUTHORITY_DENIED" : "AUTHORIZED",
          policyVersion: "policy-v1",
          obligations: Object.freeze(["AUDIT" as const]),
          assignmentIds: Object.freeze(["assignment-1"]),
        }),
      },
    });

    assert.deepEqual(gate.evaluate(item.request ?? input), {
      status: "BLOCKED",
      reasonCode: "ADMISSION_DENIED",
    }, item.name);
  }
});

test("F18-B returns an immutable exact-binding ELIGIBLE decision after both live authority checks", () => {
  const gate = new SourceIngestionAdmissionGate({
    sourcePolicies: { readCurrent: () => source },
    connectors: { readCurrent: () => activeConnector },
    authorization: {
      evaluate: () => Object.freeze({
          effect: "ALLOW" as const,
          reasonCode: "AUTHORIZED",
          policyVersion: "policy-v1",
          obligations: Object.freeze(["AUDIT" as const]),
          assignmentIds: Object.freeze(["assignment-1"]),
        }),
    },
  });

  const decision = gate.evaluate(input);

  assert.deepEqual(decision, {
    status: "ELIGIBLE",
    sourceId: "source-1",
    sourcePolicyVersion: 3,
    connectorId: "connector-1",
    connectorVersion: 5,
    tenantId: "tenant-1",
    scope: { scopeType: "TEAM", scopeId: "team-1" },
    purpose: "LISTING_DISCOVERY",
    method: "CONNECTOR",
  });
  assert.equal(Object.isFrozen(decision), true);
});

test("F18-B rejects malformed bounded admission input before reading authority", () => {
  const malformed: readonly SourceIngestionAdmissionInput[] = [
    Object.freeze({ ...input, tenantId: " " }),
    Object.freeze({ ...input, sourceId: "" }),
    Object.freeze({ ...input, sourcePolicyVersion: 0 }),
    Object.freeze({ ...input, connectorId: "" }),
    Object.freeze({ ...input, connectorVersion: -1 }),
    Object.freeze({ ...input, method: "" }),
    Object.freeze({ ...input, purpose: "" }),
    Object.freeze({ ...input, correlationId: "" }),
    Object.freeze({ ...input, scope: Object.freeze({ ...input.scope, scopeId: "" }) }),
  ];
  let authoritativeReads = 0;
  const gate = new SourceIngestionAdmissionGate({
    sourcePolicies: { readCurrent: () => { authoritativeReads += 1; return source; } },
    connectors: { readCurrent: () => { authoritativeReads += 1; return activeConnector; } },
    authorization: {
      evaluate: () => Object.freeze({
        effect: "ALLOW" as const,
        reasonCode: "AUTHORIZED",
        policyVersion: "policy-v1",
        obligations: Object.freeze(["AUDIT" as const]),
        assignmentIds: Object.freeze(["assignment-1"]),
      }),
    },
  });

  for (const request of malformed) {
    assert.deepEqual(gate.evaluate(request), {
      status: "BLOCKED",
      reasonCode: "ADMISSION_DENIED",
    });
  }
  assert.equal(authoritativeReads, 0);
});

test("F18-B fails closed when an authoritative admission dependency is unavailable", () => {
  const gate = new SourceIngestionAdmissionGate({
    sourcePolicies: { readCurrent: (): never => { throw new Error("unsafe dependency detail"); } },
    connectors: { readCurrent: () => activeConnector },
    authorization: {
      evaluate: () => Object.freeze({
        effect: "ALLOW" as const,
        reasonCode: "AUTHORIZED",
        policyVersion: "policy-v1",
        obligations: Object.freeze(["AUDIT" as const]),
        assignmentIds: Object.freeze(["assignment-1"]),
      }),
    },
  });

  assert.deepEqual(gate.evaluate(input), {
    status: "BLOCKED",
    reasonCode: "ADMISSION_DENIED",
  });
});
