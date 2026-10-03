import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AuditLog } from "../../../modules/audit/src/audit-log.js";
import {
  AuthorizationService,
  type LiveRoleAssignment,
} from "../../../modules/authorization/src/authorization-service.js";
import {
  InMemorySessionUnitOfWork,
  SessionPersistenceError,
  type AuthenticatedIdentity,
  type AuthenticationAdapter,
  type AuthenticationEvidence,
} from "../../../modules/identity/src/index.js";
import { executeBoundary } from "./contracts.js";
import {
  createStagingSessionComposition,
  StagingSessionCompositionError,
  type StagingSessionCompositionOptions,
} from "./staging-session-composition.js";

const now = new Date("2026-09-13T00:00:00.000Z");

class AuthenticationStub implements AuthenticationAdapter {
  public verify(_evidence: AuthenticationEvidence): Promise<AuthenticatedIdentity> {
    return Promise.resolve({
      principalId: "staging-agent-1",
      principalType: "HUMAN",
      roles: ["AGT"],
      teamId: "team-staging",
      assurance: "MFA",
      isMfaVerified: true,
      status: "ACTIVE",
    });
  }
}

function options(databasePath: string): StagingSessionCompositionOptions {
  let sequence = 0;
  const clock = (): Date => new Date(now);
  const auditSink = new AuditLog({
    clock,
    idFactory: () => `audit-staging-${String(++sequence)}`,
  });
  const assignments: readonly LiveRoleAssignment[] = [{
    id: "assignment-staging-1",
    principalId: "staging-agent-1",
    subjectPrincipalType: "HUMAN",
    role: "AGT",
    teamIds: ["team-staging"],
    resourceTypes: ["Property"],
    purposes: ["PROPERTY_ADMINISTRATION"],
    effectiveFrom: "2026-09-12T00:00:00.000Z",
    effectiveUntil: "2026-09-14T00:00:00.000Z",
    status: "ACTIVE",
    version: 1,
    tenantId: "tenant-staging",
  }];
  return {
    runtimeEnvironment: "STAGING",
    databasePath,
    authenticationAdapter: new AuthenticationStub(),
    auditSink,
    authorization: Object.assign(new AuthorizationService({
      liveAssignmentResolver: { resolveCurrentAssignments: () => assignments },
      auditSink,
      clock,
      policyVersion: "staging-authorization-v1",
    }), { isReady: () => true }),
    bindingResolver: {
      isReady: () => true,
      resolve: () => ({
        actor: {
          id: "staging-agent-1",
          type: "HUMAN",
          roles: ["AGT"],
          teamId: "team-staging",
        },
        tenantId: "tenant-staging",
        tenantBindingOrigin: "assignment:staging-agent-1:v1",
      }),
    },
    clock,
    idFactory: () => `identity-staging-${String(++sequence)}`,
    tenantBindingOrigin: "assignment:staging-agent-1:v1",
  };
}

async function withDirectory(run: (databasePath: string) => void | Promise<void>): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), "rel001-staging-session-"));
  try {
    await run(join(directory, "identity.sqlite"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("requires the durable Staging Session boundary and rejects development or in-memory authority", () => {
  const required = options("C:\\staging\\identity.sqlite");
  for (const invalid of [
    { ...required, databasePath: "" },
    { ...required, runtimeEnvironment: "DEVELOPMENT" },
    { ...required, unitOfWork: new InMemorySessionUnitOfWork() },
    { ...required, developmentSessionResolver: { resolve: () => undefined } },
  ]) {
    assert.throws(
      () => createStagingSessionComposition(invalid as StagingSessionCompositionOptions),
      (error: unknown) => error instanceof StagingSessionCompositionError
        && error.code === "STAGING_SESSION_NOT_READY"
        && error.publicMessage === "Staging Session runtime is not ready.",
    );
  }
});

test("reopens one durable Session truth for shared Core and Console access consumers", () => withDirectory(async (databasePath) => {
  const first = createStagingSessionComposition(options(databasePath));
  const created = await first.sessionService.createSession({
    evidence: { credentialReference: "credential-ref-staging-1", requestedScope: "staging" },
    correlationId: "correlation-staging-session-create",
  });
  assert.deepEqual(first.status(), { health: "HEALTHY", readiness: "READY" });
  first.close();

  const reopened = createStagingSessionComposition(options(databasePath));
  const resolved = reopened.sessionAccess.resolveAuthorized({
    sessionId: created.id,
    action: "property.read",
    resource: {
      type: "Property",
      id: "property-staging-1",
      tenantId: "tenant-staging",
      teamId: "team-staging",
    },
    purpose: "PROPERTY_ADMINISTRATION",
    correlationId: "correlation-staging-session-read",
  });
  assert.notEqual(resolved.id, created.id);
  assert.notEqual(resolved.refreshReference, created.refreshReference);
  assert.equal(resolved.sessionVersion, 2);
  reopened.close();
  assert.deepEqual(reopened.status(), { health: "UNHEALTHY", readiness: "NOT_READY" });
}));

test("maps corrupt Staging Session persistence to safe NOT_READY without diagnostic leakage", () => {
  const directory = mkdtempSync(join(tmpdir(), "rel001-staging-corrupt-"));
  const databasePath = join(directory, "secret-session.sqlite");
  writeFileSync(databasePath, "malformed sqlite payload");
  try {
    assert.throws(
      () => createStagingSessionComposition(options(databasePath)),
      (error: unknown) => error instanceof StagingSessionCompositionError
        && error.code === "STAGING_SESSION_NOT_READY"
        && !error.message.includes(databasePath)
        && !/sqlite|stack|select|pragma/i.test(error.message),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("API boundary conceals unsafe Session persistence diagnostics", () => {
  const response = executeBoundary(
    { correlationId: "correlation-staging-safe-error" },
    () => {
      throw new SessionPersistenceError(
        "SESSION_PERSISTENCE_UNAVAILABLE",
        "C:\\secret\\identity.sqlite SELECT token FROM sessions\n at unsafe stack",
      );
    },
  );

  assert.deepEqual(response, {
    ok: false,
    error: {
      code: "REQUEST_REJECTED",
      message: "Request could not be completed.",
    },
    meta: { correlationId: "correlation-staging-safe-error" },
  });
  assert.equal(/secret|sqlite|select|token|stack/i.test(JSON.stringify(response)), false);
});

test("reports NOT_READY when trusted binding or authorization readiness is unavailable", () => withDirectory((databasePath) => {
  let bindingReady = true;
  let authorizationReady = true;
  const configured = options(databasePath);
  const composition = createStagingSessionComposition({
    ...configured,
    bindingResolver: {
      ...configured.bindingResolver,
      isReady: () => bindingReady,
    },
    authorization: {
      ...configured.authorization,
      evaluate: configured.authorization.evaluate.bind(configured.authorization),
      isReady: () => authorizationReady,
    },
  });
  try {
    assert.deepEqual(composition.status(), { health: "HEALTHY", readiness: "READY" });
    bindingReady = false;
    assert.deepEqual(composition.status(), { health: "UNHEALTHY", readiness: "NOT_READY" });
    bindingReady = true;
    authorizationReady = false;
    assert.deepEqual(composition.status(), { health: "UNHEALTHY", readiness: "NOT_READY" });
  } finally {
    composition.close();
  }
}));
