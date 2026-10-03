import { adaptSynchronousAdvisoryPersistence } from "../../../modules/ai/src/advisory-async-persistence.js";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { parseAdminConsoleArguments } from "../../admin-console/src/console-configuration.js";
import type { StagingAdminConsoleConfiguration } from "../../admin-console/src/console-configuration.js";
import type { ConsoleReadRequest } from "../../admin-console/src/console-read-adapter.js";
import { Ai001ListingParseApplicationService, Ai004RequirementParseApplicationService, Ai005MatchingApplicationService } from "../../../modules/ai/src/advisory-application-services.js";
import { DurableAdvisoryStore } from "../../../modules/ai/src/advisory-durable-persistence.js";
import { ConfiguredAdvisoryProviderAdapter, type AdvisoryCapabilityConfiguration, type ExecutableAdvisoryCapabilityId } from "../../../modules/ai/src/advisory-provider-boundary.js";
import { composeAdvisoryProviderReadiness } from "../../../modules/ai/src/advisory-readiness-composition.js";
import { AdvisoryRuntime } from "../../../modules/ai/src/advisory-runtime.js";
import { AuditLog } from "../../../modules/audit/src/audit-log.js";
import type { AuditIntentSourcePort, MaterializationReadySourceDomain } from "../../../modules/audit/src/index.js";
import { AuthorizationService, type LiveRoleAssignment } from "../../../modules/authorization/src/authorization-service.js";
import type { AuthenticatedIdentity, AuthenticationAdapter, AuthenticationEvidence } from "../../../modules/identity/src/index.js";
import { AdvisoryJobFailureMapper } from "../../../modules/jobs/src/advisory-job-handlers.js";
import type { BoundedJobHandler, JobExecutionAdmissionPort, JobExecutionFailureMapper } from "../../../modules/jobs/src/job-execution-runtime.js";
import { createStagingJobExecutionRuntime } from "../../../modules/jobs/src/job-staging-composition.js";
import { createAdministrationCollectionView } from "./administration-api-contracts.js";
import { composeAdministrationApi015NodeHttpServer } from "./administration-production-composition.js";
import { createStagingApi016AuditRuntime } from "./api016-production-composition.js";
import { createStagingAdminConsoleBootstrap } from "./staging-admin-console-bootstrap.js";
import { CoreIdentityAuthorizationApplication, createCoreIdentityAuthorizationHttpHandler } from "./core-identity-authorization-http.js";
import { createIntegratedStagingRuntimeVerification } from "./staging-integrated-runtime-verification.js";
import { createStagingSessionComposition, type StagingSessionCompositionOptions } from "./staging-session-composition.js";

const now = new Date("2026-09-16T00:00:00.000Z");

const liveAssignments: readonly LiveRoleAssignment[] = [{
  id: "phase6-assignment", principalId: "phase6-actor", subjectPrincipalType: "HUMAN", role: "SEC",
  teamIds: ["team-staging"], resourceTypes: ["AdminConsole", "IdentitySession"],
  purposes: ["CONSOLE_ACCESS", "ACCESS_GOVERNANCE", "SECURITY_MONITORING"],
  effectiveFrom: "2026-09-15T00:00:00.000Z", effectiveUntil: "2026-09-17T00:00:00.000Z",
  status: "ACTIVE", version: 1, tenantId: "tenant-staging",
}];

class AuthenticationStub implements AuthenticationAdapter {
  public verify(_evidence: AuthenticationEvidence): Promise<AuthenticatedIdentity> {
    return Promise.resolve({
      principalId: "phase6-actor", principalType: "HUMAN", roles: ["SEC"], teamId: "team-staging",
      assurance: "MFA", isMfaVerified: true, status: "ACTIVE",
    });
  }
}

function sessionOptions(databasePath: string): StagingSessionCompositionOptions {
  let sequence = 0;
  const clock = (): Date => new Date(now);
  const auditSink = new AuditLog({ clock, idFactory: () => `phase6-audit-${String(++sequence)}` });
  return {
    runtimeEnvironment: "STAGING", databasePath, authenticationAdapter: new AuthenticationStub(), auditSink,
    authorization: Object.assign(new AuthorizationService({
      liveAssignmentResolver: { resolveCurrentAssignments: () => liveAssignments }, auditSink, clock,
      policyVersion: "phase6-authorization-v1",
    }), { isReady: () => true }),
    bindingResolver: {
      isReady: () => true,
      resolve: () => ({
        actor: { id: "phase6-actor", type: "HUMAN", roles: ["SEC"], teamId: "team-staging" },
        tenantId: "tenant-staging", tenantBindingOrigin: "assignment:phase6-actor:v1",
      }),
    },
    clock, idFactory: () => `phase6-identity-${String(++sequence)}`,
    tenantBindingOrigin: "assignment:phase6-actor:v1",
  };
}

function createCoreIdentityHttpHandler(sessionAccess: ReturnType<typeof createStagingSessionComposition>["sessionAccess"]) {
  return createCoreIdentityAuthorizationHttpHandler(new CoreIdentityAuthorizationApplication({
    trustedContext: Object.freeze({ tenantId: "tenant-staging", teamId: "team-staging", purpose: "CONSOLE_ACCESS" }),
    sessionAccess,
    liveAssignments: { resolveCurrentAssignments: () => liveAssignments },
    readiness: { isReady: () => true },
  }));
}

function auditSources(): readonly AuditIntentSourcePort[] {
  const domains: readonly MaterializationReadySourceDomain[] = [
    "SOURCE_REGISTRY", "INTAKE", "PROPERTY", "LISTING", "CONTACT", "MATCHING", "API-017",
  ];
  return domains.map((sourceDomain) => ({
    sourceDomain,
    readByIntentId: () => undefined,
    listEligible: () => ({ intents: [] }),
  }));
}

const handlers = Object.freeze({
  AI_LISTING_PARSE: Object.freeze({ handlerId: "AI-001", execute: () => { throw new Error("UNEXPECTED_HANDLER_EXECUTION"); } }),
  AI_REQUIREMENT_PARSE: Object.freeze({ handlerId: "AI-004", execute: () => { throw new Error("UNEXPECTED_HANDLER_EXECUTION"); } }),
  AI_MATCHING: Object.freeze({ handlerId: "AI-005", execute: () => { throw new Error("UNEXPECTED_HANDLER_EXECUTION"); } }),
});
const admission: JobExecutionAdmissionPort = Object.freeze({
  evaluate: () => { throw new Error("UNEXPECTED_JOB_ADMISSION"); },
});
const failureMapper: JobExecutionFailureMapper = Object.freeze({
  map: () => { throw new Error("UNEXPECTED_FAILURE_MAPPING"); },
});

const advisoryCapabilities = ["AI-001", "AI-004", "AI-005"] as const;
const advisoryConfigurations = Object.fromEntries(advisoryCapabilities.map((capabilityId) => [capabilityId, Object.freeze({
  environment: "Staging", capabilityId, capabilityVersion: "v1.0", providerRef: `provider:${capabilityId}`,
  modelRef: `model:${capabilityId}`, timeoutMs: 1000, credentialRef: `vault-ref:${capabilityId}`,
  promptId: `PRM-${capabilityId}-001`, promptVersion: "v1.0",
})])) as Record<ExecutableAdvisoryCapabilityId, AdvisoryCapabilityConfiguration>;

async function createAdvisoryReadiness(directory: string, onExecute: () => void) {
  const stores: DurableAdvisoryStore[] = [];
  const adapters = Object.fromEntries(advisoryCapabilities.map((capabilityId) => [capabilityId, new ConfiguredAdvisoryProviderAdapter({
    configuration: advisoryConfigurations[capabilityId], networkAuthorized: false,
    credentialResolver: { isAvailable: () => true, resolve: () => "test-boundary-value" },
    executor: { testOnly: true, execute: () => { onExecute(); return {}; } },
    telemetrySink: { append: () => undefined }, clock: () => new Date(now),
  })])) as Record<ExecutableAdvisoryCapabilityId, ConfiguredAdvisoryProviderAdapter>;
  const applicationPorts = Object.fromEntries(advisoryCapabilities.map((capabilityId) => {
    const configuration = advisoryConfigurations[capabilityId];
    const store = new DurableAdvisoryStore({ databasePath: join(directory, `${capabilityId}.sqlite`) });
    stores.push(store);
    store.registerPrompt({
      promptId: configuration.promptId, promptVersion: configuration.promptVersion, capabilityId,
      schemaId: capabilityId === "AI-001" ? "urn:ai-mls:schema:listing-parser-output:v0.1"
        : capabilityId === "AI-004" ? "urn:ai-mls:schema:requirement-parser-output:v0.1"
          : "urn:ai-mls:schema:matching-result:v0.1",
      contentFingerprint: `sha256:prompt-${capabilityId}`, status: "ACTIVE", createdAt: now.toISOString(),
    });
    const runtime = new AdvisoryRuntime({ persistence: adaptSynchronousAdvisoryPersistence(store), snapshotResolver: { resolve: () => undefined }, adapter: adapters[capabilityId], clock: () => new Date(now) });
    const binding = { capabilityVersion: configuration.capabilityVersion, promptId: configuration.promptId, promptVersion: configuration.promptVersion };
    const service = capabilityId === "AI-001" ? new Ai001ListingParseApplicationService({ runtime, binding })
      : capabilityId === "AI-004" ? new Ai004RequirementParseApplicationService({ runtime, binding })
        : new Ai005MatchingApplicationService({ runtime, binding });
    return [capabilityId, service];
  })) as { "AI-001": Ai001ListingParseApplicationService; "AI-004": Ai004RequirementParseApplicationService; "AI-005": Ai005MatchingApplicationService };
  const ready = await composeAdvisoryProviderReadiness({ adapters, applicationPorts, failureMapper: new AdvisoryJobFailureMapper() });
  const status = () => ready;
  return Object.freeze({ status, close: () => stores.forEach((store) => store.close()) });
}

function createApi015Server() {
  return composeAdministrationApi015NodeHttpServer({
    application: {
      execute: () => { throw new Error("UNEXPECTED_ADMINISTRATION_COMMAND"); },
      read: () => { throw new Error("UNEXPECTED_ADMINISTRATION_SINGLE_READ"); },
      list: () => createAdministrationCollectionView({ items: [] }),
    },
    configuration: { host: "127.0.0.1", port: 0, maximumBodyBytes: 4_096, shutdownTimeout: 250 },
  });
}

function consoleConfiguration(administrationApiOrigin: string): StagingAdminConsoleConfiguration {
  const parsed = parseAdminConsoleArguments([
    "--runtime=staging", "--port=4173", "--tenant-id=tenant-staging", "--scope-ref=team-staging",
    `--administration-api-origin=${administrationApiOrigin}`, "--policy-scope-id=policy-staging",
    "--source-scope-id=source-staging", "--target-scope-id=target-staging",
  ]);
  if (parsed.runtimeEnvironment !== "STAGING") throw new Error("UNEXPECTED_CONSOLE_CONFIGURATION");
  return Object.freeze({ ...parsed, port: 0 });
}

test("REL001-PHASE6 concrete compositions become ready, perform no execution, and re-evaluate after close/reopen", async () => {
  const directory = mkdtempSync(join(tmpdir(), "rel001-phase6-integrated-"));
  const sessionPath = join(directory, "identity.sqlite");
  const auditPath = join(directory, "audit.sqlite");
  const jobsPath = join(directory, "jobs.sqlite");
  let handlerCalls = 0;
  const counted = (handler: BoundedJobHandler): BoundedJobHandler => Object.freeze({
    ...handler,
    execute: () => { handlerCalls += 1; throw new Error("UNEXPECTED_HANDLER_EXECUTION"); },
  });
  const countedHandlers = Object.freeze({
    AI_LISTING_PARSE: counted(handlers.AI_LISTING_PARSE),
    AI_REQUIREMENT_PARSE: counted(handlers.AI_REQUIREMENT_PARSE),
    AI_MATCHING: counted(handlers.AI_MATCHING),
  });
  let session = createStagingSessionComposition(sessionOptions(sessionPath));
  let audit = createStagingApi016AuditRuntime({ environment: "Staging", databasePath: auditPath, sources: auditSources() });
  let jobs = createStagingJobExecutionRuntime({
    environment: "Staging", databasePath: jobsPath, idFactory: () => "unused", clock: () => new Date(now),
    handlers: countedHandlers, admission, failureMapper,
  });
  let providerCalls = 0;
  let advisory = await createAdvisoryReadiness(directory, () => { providerCalls += 1; });
  const createdSession = await session.sessionService.createSession({
    evidence: { credentialReference: "phase6-test-reference", requestedScope: "tenant-staging" },
    correlationId: "correlation-phase6-session",
  });
  const sessionId = createdSession.id;
  const readyRead = (page: ConsoleReadRequest["page"]) => Object.freeze({ page, state: "READY" as const, data: Object.freeze({}) });
  const startConnected = async () => {
    const api015 = createApi015Server();
    await api015.start();
    const origin = `http://127.0.0.1:${String(api015.diagnostics.boundPort)}`;
    const console = createStagingAdminConsoleBootstrap(consoleConfiguration(origin), {
      sessionAccess: session.sessionAccess,
      coreIdentityHttpHandler: createCoreIdentityHttpHandler(session.sessionAccess),
      publicationReadAdapter: { read: (request) => readyRead(request.page) },
      auditReadAdapter: { read: (request) => { audit.status(); return readyRead(request.page); } },
      jobRuntimeReadPort: { readStatus: () => Object.freeze({ readiness: jobs.status().readiness, jobs: Object.freeze([]) }) },
      advisoryRuntimeReadPort: { readStatus: () => {
        const status = advisory.status();
        if (status.providerIndependentReady !== 3 || status.stagingExecutionReady !== 0) {
          throw new Error("ADVISORY_RUNTIME_UNAVAILABLE");
        }
        return Object.freeze({
          providerIndependentImplementation: "READY" as const,
          liveProviderExecution: "NOT_READY" as const,
          externalDependency: "EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY" as const, decision162: "IN_REVIEW" as const,
        });
      } },
      administrationSelectorScopes: Object.freeze({
        roles: Object.freeze({ tenantId: "tenant-staging", scopeType: "TENANT" as const, scopeId: "tenant-staging" }),
        teamScopes: Object.freeze({ tenantId: "tenant-staging", scopeType: "TEAM" as const, scopeId: "team-staging" }),
        policies: Object.freeze({ tenantId: "tenant-staging", scopeType: "POLICY" as const, scopeId: "policy-staging" }),
        sourceGovernance: Object.freeze({ tenantId: "tenant-staging", scopeType: "SOURCE" as const, scopeId: "source-staging" }),
        publicationTargets: Object.freeze({ tenantId: "tenant-staging", scopeType: "TARGET" as const, scopeId: "target-staging" }),
      }),
    });
    await console.server.start();
    return { api015, console };
  };
  let connected = await startConnected();

  const prime = async () => {
    for (const page of ["ADMINISTRATION", "UI-031", "UI-035", "OPERATIONS"]) {
      const response = await fetch(`${connected.console.server.localUrl}/api/console/view?page=${page}`, { headers: { "x-session-id": sessionId } });
      assert.equal(response.status, 200, page);
    }
  };

  try {
    await prime();
    const administration = await fetch(`${connected.console.server.localUrl}/api/console/view?page=ADMINISTRATION`, {
      headers: { "x-session-id": sessionId },
    });
    const administrationBody = await administration.text();
    assert.equal(administrationBody.includes("phase6-actor"), true);
    assert.equal(administrationBody.includes("tenant-staging"), true);
    assert.equal(administrationBody.includes("team-staging"), true);
    assert.equal(administrationBody.includes("NOT_AVAILABLE"), false);
    const integrated = () => createIntegratedStagingRuntimeVerification({
      session, audit, jobs, advisory, console: connected.console,
    });
    assert.equal(integrated().status().classification, "READY_FOR_AVAILABLE_BOUNDARY");
    assert.equal(handlerCalls, 0);
    assert.equal(providerCalls, 0);

    session.close();
    audit.close();
    jobs.close();
    advisory.close();
    assert.equal(integrated().status().classification, "NOT_READY");
    await connected.console.server.stop();
    await connected.api015.stop();

    session = createStagingSessionComposition(sessionOptions(sessionPath));
    audit = createStagingApi016AuditRuntime({ environment: "Staging", databasePath: auditPath, sources: auditSources() });
    jobs = createStagingJobExecutionRuntime({
      environment: "Staging", databasePath: jobsPath, idFactory: () => "unused", clock: () => new Date(now),
      handlers: countedHandlers, admission, failureMapper,
    });
    advisory = await createAdvisoryReadiness(directory, () => { providerCalls += 1; });
    connected = await startConnected();
    assert.equal(integrated().status().classification, "NOT_READY");
    await prime();
    assert.equal(integrated().status().classification, "READY_FOR_AVAILABLE_BOUNDARY");
    assert.equal(handlerCalls, 0);
    assert.equal(providerCalls, 0);
  } finally {
    await connected.console.server.stop();
    if (connected.api015.diagnostics.listening) await connected.api015.stop();
    session.close();
    audit.close();
    jobs.close();
    advisory.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
