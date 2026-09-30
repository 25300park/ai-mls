import type { AuthorizationDecision, AuthorizationRequest } from "../../../modules/authorization/src/authorization-service.js";
import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import type { PublicationClock } from "../../../modules/publication/src/publication-clock.js";
import type { PublicationSessionResolver } from "../../../modules/publication/src/publication-authorization.js";
import type {
  PublicationOperationsProjectionReadPort,
  PublicationOperationsReadPort,
} from "../../../modules/publication/src/publication-observability.js";
import type {
  PublicationQueryRequest,
  PublicationQueryResponse,
} from "../../api/src/publication-api-contracts.js";
import type { ConnectorApplicationResult } from "../../../modules/source/src/connector-runtime-application.js";
import type { ExternalIntegrationApplicationResult } from "../../../modules/source/src/external-integration-application.js";
import { validateOperationalAlertProjection } from "../../../modules/operations/src/operational-alert-projection.js";
import { validateOperationalReadinessProjection } from "../../../modules/operations/src/operational-readiness-evidence.js";
import { validateOperationalTelemetryRecord } from "../../../modules/operations/src/operational-telemetry-contracts.js";
import { validateOperationalStatusSnapshot } from "../../../modules/operations/src/operational-status-projection.js";
import { isUnsafeSecurityDetailValue } from "../../../packages/security-contracts/src/index.js";

export const CONSOLE_PAGES = Object.freeze([
  "DASHBOARD",
  "UI-031",
  "UI-032",
  "UI-033",
  "UI-035",
  "ADMINISTRATION",
  "UI-036",
  "PROJECTION",
  "OPERATIONS",
  "CONNECTOR",
  "EXTERNAL_INTEGRATION",
  "RECOVERY_CASE",
  "EVIDENCE",
] as const);

export type ConsolePage = typeof CONSOLE_PAGES[number];
export type ConsoleReadState = "LOADING" | "READY" | "EMPTY" | "UNAVAILABLE" | "NOT_AUTHORIZED" | "ERROR";

export interface ConsoleReadRequest {
  readonly page: ConsolePage;
  readonly sessionId: string;
  readonly tenantId: string;
  readonly teamId: string;
  readonly publicationId?: string;
  readonly connectorId?: string;
  readonly sourceId?: string;
  readonly batchId?: string;
  readonly mappingId?: string;
  readonly integrationContractId?: string;
  readonly recoveryCaseId?: string;
  readonly auditTargetId?: string;
  readonly auditEventType?: string;
  readonly correlationId: string;
}

export interface ConsoleReadPort {
  read(request: ConsoleReadRequest): ConsoleReadResult | Promise<ConsoleReadResult>;
}
export interface ConsoleReadResult {
  readonly page: ConsolePage;
  readonly state: ConsoleReadState;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly message?: string;
  readonly error?: Readonly<{
    readonly code: "CONSOLE_READ_UNAVAILABLE";
    readonly message: string;
    readonly correlationId: string;
  }>;
}

interface ConsolePublicationQueryPort {
  executeQuery(input: unknown): Promise<PublicationQueryResponse>;
}

interface ConsoleAuthorizationEvaluator {
  evaluate(request: AuthorizationRequest): AuthorizationDecision;
}

interface ConsoleConnectorQueryPort {
  execute(kind: "QUERY", input: unknown): ConnectorApplicationResult;
}

interface ConsoleExternalIntegrationQueryPort {
  execute(kind: "HTTP_QUERY", input: unknown, sessionId: string): ExternalIntegrationApplicationResult;
}

type ConsoleRecoveryQueryResult =
  | Readonly<{ ok: true; operation: "READ_RECOVERY_CASE"; data: Readonly<Record<string, unknown>> }>
  | Readonly<{ ok: false; error: Readonly<{ code: string; message: string }> }>;

interface ConsoleRecoveryQueryPort {
  execute(kind: "QUERY", input: unknown, sessionId: string): ConsoleRecoveryQueryResult;
}

type ConsoleAuditQueryResult =
  | Readonly<{ ok: true; data: readonly unknown[]; meta: Readonly<Record<string, unknown>> }>
  | Readonly<{ ok: false; error: Readonly<{ code: string; message: string }>; meta: Readonly<Record<string, unknown>> }>;

interface ConsoleAuditQueryPort {
  queryAudit(input: unknown): ConsoleAuditQueryResult;
}

export interface ConsoleOperationalAlertReadPort {
  readAlerts(input: Readonly<{
    session: SessionContext;
    tenantId: string;
    scopeRef: string;
    correlationId: string;
  }>): readonly unknown[];
}

export interface ConsoleOperationalReadinessReadPort {
  readReadiness(input: Readonly<{
    session: SessionContext;
    tenantId: string;
    scopeRef: string;
    correlationId: string;
  }>): readonly unknown[];
}

export interface ConsoleOperationalEvidenceStatusReadPort {
  readTelemetry(input: Readonly<{
    session: SessionContext;
    tenantId: string;
    scopeRef: string;
    correlationId: string;
  }>): readonly unknown[];
  readStatuses(input: Readonly<{
    session: SessionContext;
    tenantId: string;
    scopeRef: string;
    correlationId: string;
  }>): readonly unknown[];
}

export interface ConsoleReleaseTraceReadPort {
  readReleaseTrace(input: Readonly<{
    session: SessionContext;
    tenantId: string;
    scopeRef: string;
    correlationId: string;
  }>): unknown;
}

interface ConsoleReadAdapterDependencies {
  readonly queryPort: ConsolePublicationQueryPort;
  readonly operationsRead: PublicationOperationsReadPort;
  readonly projectionRead: PublicationOperationsProjectionReadPort;
  readonly sessionResolver: PublicationSessionResolver;
  readonly authorizationEvaluator: ConsoleAuthorizationEvaluator;
  readonly clock: PublicationClock;
  readonly connectorQueryPort?: ConsoleConnectorQueryPort;
  readonly externalIntegrationQueryPort?: ConsoleExternalIntegrationQueryPort;
  readonly recoveryQueryPort?: ConsoleRecoveryQueryPort;
  readonly auditQueryPort?: ConsoleAuditQueryPort;
  readonly alertReadPort?: ConsoleOperationalAlertReadPort;
  readonly readinessReadPort?: ConsoleOperationalReadinessReadPort;
  readonly evidenceStatusReadPort?: ConsoleOperationalEvidenceStatusReadPort;
  readonly releaseTraceReadPort?: ConsoleReleaseTraceReadPort;
}

const publicationOperations: Readonly<Record<Exclude<ConsolePage, "DASHBOARD" | "ADMINISTRATION" | "UI-036" | "PROJECTION" | "OPERATIONS" | "CONNECTOR" | "EXTERNAL_INTEGRATION" | "RECOVERY_CASE" | "EVIDENCE">, PublicationQueryRequest["operation"]>> = Object.freeze({
  "UI-031": "GET_PUBLICATION_OPERATIONS_VIEW",
  "UI-032": "GET_PUBLICATION_REVALIDATION_VIEW",
  "UI-033": "GET_PUBLICATION_RECOVERY_VIEW",
  "UI-035": "GET_PUBLICATION_AUDIT_VIEW",
});

export class ConsoleReadAdapter {
  public constructor(private readonly dependencies: ConsoleReadAdapterDependencies) {}

  public async read(request: ConsoleReadRequest): Promise<ConsoleReadResult> {
    try {
      switch (request.page) {
        case "DASHBOARD": return this.readDashboard(request);
        case "ADMINISTRATION": return immutableConsole({ page: request.page, state: "UNAVAILABLE" as const, message: "Administration data is unavailable." });
        case "UI-036": return immutableConsole({ page: request.page, state: "UNAVAILABLE" as const, message: "Controlled administration is unavailable." });
        case "PROJECTION": return this.readProjection(request);
        case "OPERATIONS": return this.readOperations(request);
        case "CONNECTOR": return this.readConnector(request);
        case "EXTERNAL_INTEGRATION": return this.readExternalIntegration(request);
        case "RECOVERY_CASE": return this.readRecoveryCase(request);
        case "EVIDENCE": return this.readEvidence(request);
        case "UI-031":
        case "UI-032":
        case "UI-033":
        case "UI-035": return await this.readPublication(request);
      }
    } catch {
      return immutableConsole({
        page: request.page,
        state: "ERROR" as const,
        error: {
          code: "CONSOLE_READ_UNAVAILABLE" as const,
          message: "The requested Console view is unavailable.",
          correlationId: safeCorrelationId(request.correlationId),
        },
      });
    }
  }

  private async readPublication(request: ConsoleReadRequest): Promise<ConsoleReadResult> {
    if (request.publicationId === undefined || request.publicationId.trim().length === 0) {
      return emptyResult(request.page, "No Publication record is currently selected.");
    }
    const response = await this.queryPublication(request, publicationOperations[request.page as keyof typeof publicationOperations]);
    if (!response.success) {
      return response.error.code === "NOT_FOUND"
        ? emptyResult(request.page, "No authorized Publication record is currently available.")
        : this.safeError(request);
    }
    if (request.page === "UI-031") return await this.readPublicationOperations(request, response);
    return immutableConsole({
      page: request.page,
      state: "READY" as const,
      data: recordOf(response.result.view),
    });
  }

  private queryPublication(request: ConsoleReadRequest, operation: PublicationQueryRequest["operation"]): Promise<PublicationQueryResponse> {
    const publicationId = request.publicationId;
    if (publicationId === undefined || publicationId.trim().length === 0) throw new Error("PUBLICATION_ID_REQUIRED");
    return this.dependencies.queryPort.executeQuery({
      requestId: `console-${request.correlationId}`,
      sessionId: request.sessionId,
      operation,
      tenantId: request.tenantId,
      teamId: request.teamId,
      purpose: "PUBLICATION_EXECUTION",
      correlationId: request.correlationId,
      publicationId,
      maxEntries: 50,
    } satisfies PublicationQueryRequest);
  }

  private async readPublicationOperations(request: ConsoleReadRequest, operationsResponse: Extract<PublicationQueryResponse, { readonly success: true }>): Promise<ConsoleReadResult> {
    const supplemental = await Promise.all([
      this.queryPublication(request, "GET_PUBLICATION_REVALIDATION_VIEW"),
      this.queryPublication(request, "GET_PUBLICATION_RECOVERY_VIEW"),
      this.queryPublication(request, "GET_PUBLICATION_AUDIT_VIEW"),
    ]);
    if (supplemental.some((response) => !response.success)) return this.safeError(request);
    const [revalidationResponse, recoveryResponse, auditResponse] = supplemental as readonly Extract<PublicationQueryResponse, { readonly success: true }>[];
    if (supplemental.some((response) => response.success && response.result.sourceVersion !== operationsResponse.result.sourceVersion)) {
      return this.safeError(request);
    }
    const revalidation = recordOf(revalidationResponse!.result.view);
    const recovery = recordOf(recoveryResponse!.result.view);
    const audit = recordOf(auditResponse!.result.view);
    const attempts = arrayOfRecords(audit["attemptHistory"]);
    const latestAttempt = attempts.at(-1);
    const safeLatestAttempt = latestAttempt === undefined
      ? undefined
      : selectFields(latestAttempt, ["id", "sequence", "operation", "outcome", "occurredAt"]);
    const auditReferences = arrayOfRecords(audit["auditEntries"])
      .map((entry) => entry["id"])
      .filter((id): id is string => typeof id === "string" && isSafeEvidence(id));
    const evidence: Readonly<Record<string, unknown>> = isRecord(recovery["safeEvidenceSummary"])
      ? recovery["safeEvidenceSummary"]
      : Object.freeze({});
    return immutableConsole({
      page: request.page,
      state: "READY" as const,
      data: {
        ...recordOf(operationsResponse.result.view),
        ...(safeLatestAttempt === undefined ? {} : { latestAttempt: safeLatestAttempt, latestNormalizedOutcome: safeLatestAttempt["outcome"] }),
        recovery: selectFields({
          reconciliationStatus: recovery["reconciliationStatus"],
          caseId: recovery["caseId"],
          attemptId: recovery["attemptId"],
          manualReviewRequired: recovery["manualReviewRequired"],
          reconciliationFinding: "UNAVAILABLE",
          recoveryDisposition: "UNAVAILABLE",
        }, ["reconciliationStatus", "caseId", "attemptId", "manualReviewRequired", "reconciliationFinding", "recoveryDisposition"]),
        eligibility: selectFields(revalidation, [
          "approvalStatus", "verificationStatus", "permissionStatus", "policyStatus",
          "bindingStatus", "stale", "revalidationRequired",
        ]),
        safeEvidence: {
          referenceCount: evidence["referenceCount"] ?? 0,
          auditReferences,
          restricted: true,
        },
      },
    });
  }

  private readDashboard(request: ConsoleReadRequest): ConsoleReadResult {
    if (!this.authorizeOperationalRead(request, "PublicationOperations", "system")) return concealedResult(request.page);
    const system = this.dependencies.operationsRead.getSystemOperationalStatus();
    const journal = this.dependencies.operationsRead.getJournalOperationalStatus();
    const projection = this.dependencies.operationsRead.getComponentStatus("LISTING_PROJECTION");
    return immutableConsole({
      page: request.page,
      state: "READY" as const,
      data: {
        health: system.health,
        readiness: system.readiness,
        runtime: system.components.find(({ component }) => component === "API_RUNTIME_HOST")?.status ?? "UNAVAILABLE",
        publicationApi: system.components.find(({ component }) => component === "PUBLICATION_APPLICATION")?.status ?? "UNAVAILABLE",
        eventJournal: journal.status,
        projection: projection.status,
        operations: system.health,
        publicationCounts: "NOT_AVAILABLE_IN_CURRENT_BACKEND",
        baseline: "feat-015-complete",
        observedAt: system.observedAt,
      },
    });
  }

  private readProjection(request: ConsoleReadRequest): ConsoleReadResult {
    if (request.publicationId === undefined || request.publicationId.trim().length === 0) {
      return emptyResult(request.page, "No Projection record is currently selected.");
    }
    if (!this.authorizeOperationalRead(request, "ListingProjectionOperationalStatus", request.publicationId)) {
      return concealedResult(request.page);
    }
    return immutableConsole({
      page: request.page,
      state: "READY" as const,
      data: recordOf(this.dependencies.projectionRead.getProjectionOperationalStatus({
        tenantId: request.tenantId,
        publicationId: request.publicationId,
      })),
    });
  }

  private readOperations(request: ConsoleReadRequest): ConsoleReadResult {
    const authorizedSession = this.resolveAuthorizedOperationalSession(request, "PublicationOperations", "system");
    if (authorizedSession === undefined) return concealedResult(request.page);
    const status = this.dependencies.operationsRead.getSystemOperationalStatus();
    const alerts = this.readOperationalAlerts(request);
    const operationalReadiness = this.readOperationalReadiness(request);
    const operationalEvidenceStatus = this.readOperationalEvidenceStatus(request);
    const releaseTrace = this.readReleaseTrace(request, authorizedSession);
    return immutableConsole({
      page: request.page,
      state: "READY" as const,
      data: {
        health: status.health,
        readiness: status.readiness,
        components: status.components,
        metrics: this.dependencies.operationsRead.getOperationalMetrics(),
        alerts,
        operationalReadiness,
        ...operationalEvidenceStatus,
        releaseTrace,
        observedAt: status.observedAt,
      },
    });
  }

  private readReleaseTrace(request: ConsoleReadRequest, session: SessionContext): Readonly<Record<string, unknown>> | "UNAVAILABLE" {
    if (this.dependencies.releaseTraceReadPort === undefined) return "UNAVAILABLE";
    try {
      return projectReleaseTrace(this.dependencies.releaseTraceReadPort.readReleaseTrace({
        session,
        tenantId: request.tenantId,
        scopeRef: request.teamId,
        correlationId: request.correlationId,
      }));
    } catch {
      return "UNAVAILABLE";
    }
  }

  private readOperationalEvidenceStatus(request: ConsoleReadRequest): Readonly<Record<string, unknown>> {
    if (this.dependencies.evidenceStatusReadPort === undefined) return unavailableOperationalEvidenceStatus();
    const session = this.resolveCurrentSession(request);
    if (session === undefined) return unavailableOperationalEvidenceStatus();
    const input = { session, tenantId: request.tenantId, scopeRef: request.teamId, correlationId: request.correlationId };
    try {
      const telemetry = this.dependencies.evidenceStatusReadPort.readTelemetry(input).map((value) => {
        const record = validateOperationalTelemetryRecord(value);
        return {
          telemetryEventId: record.telemetryEventId,
          eventType: record.eventType,
          component: record.component,
          operation: record.operation,
          resourceType: record.resourceType,
          resourceRef: record.resourceRef,
          outcome: record.outcome,
          safeErrorCode: record.safeErrorCode,
          correlationId: record.correlationId,
          evidenceRefs: record.evidenceRefs,
          occurredAt: record.occurredAt,
          ...(record.attemptId === undefined ? {} : { attemptId: record.attemptId }),
          ...(record.invocationId === undefined ? {} : { invocationId: record.invocationId }),
          ...(record.recoveryCaseId === undefined ? {} : { recoveryCaseId: record.recoveryCaseId }),
          ...(record.recoveryId === undefined ? {} : { recoveryId: record.recoveryId }),
          ...(record.advisoryId === undefined ? {} : { advisoryId: record.advisoryId }),
        };
      });
      const operationalStatuses = this.dependencies.evidenceStatusReadPort.readStatuses(input).map((value) => {
        const status = validateOperationalStatusSnapshot(value);
        return {
          statusSnapshotId: status.statusSnapshotId,
          telemetryEventId: status.telemetryEventId,
          component: status.component,
          resourceType: status.resourceType,
          resourceRef: status.resourceRef,
          health: status.health,
          readiness: status.readiness,
          freshness: status.freshness,
          evidenceOccurredAt: status.evidenceOccurredAt,
          evaluatedAt: status.evaluatedAt,
          freshnessThresholdMs: status.freshnessThresholdMs,
        };
      });
      const securityTelemetry = telemetry.filter(({ component }) => component === "SECURITY");
      const securityStatuses = operationalStatuses.filter(({ component }) => component === "SECURITY");
      const evidenceRefs = [...new Set(securityTelemetry.flatMap(({ evidenceRefs: refs }) => refs))].sort();
      return immutableConsole({
        telemetry,
        operationalStatuses,
        securityPrivacySummary: {
          telemetryCount: securityTelemetry.length,
          statusCount: securityStatuses.length,
          evidenceRefs,
        },
      });
    } catch { return unavailableOperationalEvidenceStatus(); }
  }

  private readOperationalAlerts(request: ConsoleReadRequest): readonly Readonly<Record<string, unknown>>[] | "UNAVAILABLE" {
    if (this.dependencies.alertReadPort === undefined) return "UNAVAILABLE";
    const session = this.resolveCurrentSession(request);
    if (session === undefined) return "UNAVAILABLE";
    try {
      return immutableConsole(this.dependencies.alertReadPort.readAlerts({
        session,
        tenantId: request.tenantId,
        scopeRef: request.teamId,
        correlationId: request.correlationId,
      }).map((value) => {
        const alert = validateOperationalAlertProjection(value);
        return {
          alertId: alert.alertId,
          alertType: alert.alertType,
          severity: alert.severity,
          component: alert.component,
          resourceRef: alert.resourceRef,
          currentState: alert.currentState,
          safeReasonCode: alert.safeReasonCode,
          evidenceRefs: alert.evidenceRefs,
          openedAt: alert.openedAt,
          lastEvaluatedAt: alert.lastEvaluatedAt,
          clearedAt: alert.clearedAt,
        };
      }));
    } catch { return "UNAVAILABLE"; }
  }

  private readOperationalReadiness(request: ConsoleReadRequest): readonly Readonly<Record<string, unknown>>[] | "UNAVAILABLE" {
    if (this.dependencies.readinessReadPort === undefined) return "UNAVAILABLE";
    const session = this.resolveCurrentSession(request);
    if (session === undefined) return "UNAVAILABLE";
    try {
      return immutableConsole(this.dependencies.readinessReadPort.readReadiness({
        session,
        tenantId: request.tenantId,
        scopeRef: request.teamId,
        correlationId: request.correlationId,
      }).map((value) => {
        const projection = validateOperationalReadinessProjection(value);
        return {
          readinessProjectionId: projection.readinessProjectionId,
          readinessType: projection.readinessType,
          resourceRef: projection.binding.subjectRef,
          readiness: projection.readiness,
          freshness: projection.freshness,
          safeReasonCodes: projection.safeReasonCodes,
          evidenceRefs: projection.evidenceRefs,
          evaluatedAt: projection.evaluatedAt,
        };
      }));
    } catch { return "UNAVAILABLE"; }
  }

  private readConnector(request: ConsoleReadRequest): ConsoleReadResult {
    if (this.dependencies.connectorQueryPort === undefined) {
      return immutableConsole({ page: request.page, state: "UNAVAILABLE" as const, message: "Connector operations data is unavailable." });
    }
    if (!this.hasVisibleTenant(request) || !hasValues(request.connectorId, request.sourceId, request.batchId)) {
      return emptyResult(request.page, "No authorized Connector batch is currently available.");
    }
    const result = this.dependencies.connectorQueryPort.execute("QUERY", {
      operation: "ReadBatchStatus",
      sessionId: request.sessionId,
      connectorId: request.connectorId,
      sourceId: request.sourceId,
      batchId: request.batchId,
    });
    if (!result.ok) {
      return result.error.code === "NOT_FOUND" || result.error.code === "UNAUTHENTICATED" || result.error.code === "FORBIDDEN"
        ? emptyResult(request.page, "No authorized Connector batch is currently available.")
        : this.safeError(request);
    }
    return immutableConsole({
      page: request.page,
      state: "READY" as const,
      data: {
        connectorId: request.connectorId,
        sourceId: request.sourceId,
        ...selectFields(result.data, [
          "batchId", "invocationId", "technicalStatus", "normalizedOutcome", "currentVersion",
          "evidenceRef", "updatedAt", "checkpointReference", "checkpointVersion",
        ]),
      },
    });
  }

  private readExternalIntegration(request: ConsoleReadRequest): ConsoleReadResult {
    if (this.dependencies.externalIntegrationQueryPort === undefined) {
      return immutableConsole({ page: request.page, state: "UNAVAILABLE" as const, message: "External Integration data is unavailable." });
    }
    if (!this.hasVisibleTenant(request)) return emptyResult(request.page, "No authorized External Integration record is currently available.");
    const query = request.mappingId?.trim()
      ? Object.freeze({ operation: "ReadExternalMapping", mappingId: request.mappingId })
      : request.integrationContractId?.trim()
        ? Object.freeze({ operation: "ReadIntegrationContract", integrationContractId: request.integrationContractId })
        : undefined;
    if (query === undefined) return emptyResult(request.page, "No authorized External Integration record is currently available.");
    const result = this.dependencies.externalIntegrationQueryPort.execute("HTTP_QUERY", query, request.sessionId);
    if (!result.ok) {
      return result.error.code === "NOT_FOUND" || result.error.code === "UNAUTHENTICATED" || result.error.code === "FORBIDDEN"
        ? emptyResult(request.page, "No authorized External Integration record is currently available.")
        : this.safeError(request);
    }
    const fields = result.operation === "ReadExternalMapping"
      ? ["mappingId", "providerNamespace", "externalObjectId", "internalResourceType", "internalResourceId", "state", "version", "evidenceRef", "createdAt", "updatedAt"]
      : ["integrationContractId", "technicalStatus", "providerNamespace", "connectorId", "sourceId", "version", "evidenceRef", "createdAt", "updatedAt"];
    return immutableConsole({ page: request.page, state: "READY" as const, data: selectFields(result.data, fields) });
  }

  private readRecoveryCase(request: ConsoleReadRequest): ConsoleReadResult {
    if (this.dependencies.recoveryQueryPort === undefined) {
      return immutableConsole({ page: request.page, state: "UNAVAILABLE" as const, message: "Recovery Case data is unavailable." });
    }
    if (!this.hasVisibleTenant(request) || !hasValues(request.recoveryCaseId)) {
      return emptyResult(request.page, "No authorized Recovery Case is currently available.");
    }
    const result = this.dependencies.recoveryQueryPort.execute("QUERY", {
      operation: "READ_RECOVERY_CASE",
      recoveryCaseId: request.recoveryCaseId,
    }, request.sessionId);
    if (!result.ok) {
      return ["NOT_FOUND", "AUTHENTICATION_REQUIRED", "NOT_AUTHORIZED"].includes(result.error.code)
        ? emptyResult(request.page, "No authorized Recovery Case is currently available.")
        : this.safeError(request);
    }
    const originIdentity = safeRecoveryOriginIdentity(result.data["originDomain"], result.data["originIdentity"]);
    if (originIdentity === undefined) return this.safeError(request);
    return immutableConsole({
      page: request.page,
      state: "READY" as const,
      data: {
        ...selectFields(result.data, [
          "recoveryCaseId", "originDomain", "status", "finding", "recoveryId",
          "evidenceRefs", "version", "createdAt", "resolvedAt",
        ]),
        originIdentity,
      },
    });
  }

  private readEvidence(request: ConsoleReadRequest): ConsoleReadResult {
    if (this.dependencies.auditQueryPort === undefined) {
      return immutableConsole({ page: request.page, state: "UNAVAILABLE" as const, message: "Audit evidence is unavailable." });
    }
    if (!this.hasVisibleTenant(request)) return emptyResult(request.page, "No authorized Audit evidence is currently available.");
    const result = this.dependencies.auditQueryPort.queryAudit({
      context: {
        requestId: `console-${request.correlationId}`,
        correlationId: request.correlationId,
        sessionId: request.sessionId,
      },
      purpose: "OPERATIONS_AUDIT",
      ...(request.auditTargetId?.trim() ? { targetId: request.auditTargetId } : {}),
      ...(request.auditEventType?.trim() ? { eventType: request.auditEventType } : {}),
    });
    if (!result.ok) return this.safeError(request);
    const events = result.data.flatMap((event) => {
      const projected = safeAuditEvent(event);
      return projected === undefined ? [] : [projected];
    });
    return events.length === 0
      ? emptyResult(request.page, "No authorized Audit evidence is currently available.")
      : immutableConsole({ page: request.page, state: "READY" as const, data: { events } });
  }

  private hasVisibleTenant(request: ConsoleReadRequest): boolean {
    const session = this.resolveCurrentSession(request);
    return session !== undefined && request.teamId === request.tenantId && session.teamId === request.tenantId;
  }

  private authorizeOperationalRead(request: ConsoleReadRequest, resourceType: string, resourceId: string): boolean {
    return this.resolveAuthorizedOperationalSession(request, resourceType, resourceId) !== undefined;
  }

  private resolveAuthorizedOperationalSession(request: ConsoleReadRequest, resourceType: string, resourceId: string): SessionContext | undefined {
    const session = this.resolveCurrentSession(request);
    if (session === undefined || request.teamId !== request.tenantId || session.teamId !== request.tenantId) return undefined;
    try {
      return this.dependencies.authorizationEvaluator.evaluate({
        session,
        action: "resource.view",
        resource: { type: resourceType, id: resourceId, teamId: request.teamId },
        purpose: "PUBLICATION_EXECUTION",
        reason: "Bounded read-only Admin Console visibility",
        requestId: `console-${request.correlationId}`,
        correlationId: request.correlationId,
      }).effect === "ALLOW" ? session : undefined;
    } catch {
      return undefined;
    }
  }

  private resolveCurrentSession(request: ConsoleReadRequest): SessionContext | undefined {
    let session: SessionContext | undefined;
    try { session = this.dependencies.sessionResolver.resolve(request.sessionId); } catch { return undefined; }
    const now = Date.parse(this.dependencies.clock.now());
    if (session?.id !== request.sessionId || session.state !== "ACTIVE"
      || Date.parse(session.expiresAt) <= now || Date.parse(session.absoluteExpiresAt) <= now) return undefined;
    return session;
  }

  private safeError(request: ConsoleReadRequest): ConsoleReadResult {
    return immutableConsole({
      page: request.page,
      state: "ERROR" as const,
      error: {
        code: "CONSOLE_READ_UNAVAILABLE" as const,
        message: "The requested Console view is unavailable.",
        correlationId: safeCorrelationId(request.correlationId),
      },
    });
  }
}

function emptyResult(page: ConsolePage, message: string): ConsoleReadResult {
  return immutableConsole({ page, state: "EMPTY" as const, message });
}

function concealedResult(page: ConsolePage): ConsoleReadResult {
  return emptyResult(page, "No authorized resource is currently available.");
}

function recordOf(value: object): Readonly<Record<string, unknown>> {
  return structuredClone(value) as Readonly<Record<string, unknown>>;
}

function hasValues(...values: readonly (string | undefined)[]): boolean {
  return values.every((value) => value !== undefined && value.trim().length > 0);
}

function selectFields(value: Readonly<Record<string, unknown>>, fields: readonly string[]): Readonly<Record<string, unknown>> {
  return Object.freeze(Object.fromEntries(fields.flatMap((field) => {
    const item = value[field];
    if (item === undefined) return [];
    if ((field === "evidenceRef" || field === "evidenceRefs") && !isSafeEvidence(item)) {
      throw new Error("UNSAFE_CONSOLE_EVIDENCE");
    }
    return [[field, structuredClone(item)]];
  })));
}

function isSafeEvidence(value: unknown): boolean {
  const values = typeof value === "string" ? [value] : Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
  return values.length > 0 && values.every((item) => item.length <= 512
    && !/[\r\n\u0000-\u001f]/u.test(item)
    && !/(?:authorization|bearer|cookie|credential|password|private.?key|secret|session.?token|token)/iu.test(item));
}

function safeAuditEvent(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!isRecord(value) || !isRecord(value["principal"]) || !isRecord(value["target"])) return undefined;
  return selectFields({
    eventId: value["id"],
    eventType: value["eventType"],
    actorId: value["principal"]["id"],
    actorType: value["principal"]["type"],
    action: value["action"],
    resourceType: value["target"]["type"],
    resourceId: value["target"]["id"],
    decision: value["decision"],
    outcome: value["outcome"],
    correlationId: value["correlationId"],
    occurredAt: value["occurredAt"],
    evidenceRefs: Array.isArray(value["evidenceRefs"]) && value["evidenceRefs"].every((item) => typeof item === "string")
      ? value["evidenceRefs"]
      : undefined,
  }, ["eventId", "eventType", "actorId", "actorType", "action", "resourceType", "resourceId", "decision", "outcome", "correlationId", "occurredAt", "evidenceRefs"]);
}

function safeRecoveryOriginIdentity(originDomain: unknown, value: unknown): Readonly<Record<string, string>> | undefined {
  if (!isRecord(value)) return undefined;
  if (originDomain === "PUBLICATION" && typeof value["reconciliationCaseId"] === "string" && typeof value["attemptId"] === "string") {
    return Object.freeze({ reconciliationCaseId: value["reconciliationCaseId"], attemptId: value["attemptId"] });
  }
  if (originDomain === "CONNECTOR" && typeof value["invocationId"] === "string") {
    return Object.freeze({ invocationId: value["invocationId"] });
  }
  if (originDomain === "EXTERNAL_INTEGRATION" && typeof value["integrationContractId"] === "string") {
    return Object.freeze(Object.fromEntries([
      "integrationContractId", "mappingId", "observationId", "conflictEvidenceId",
    ].flatMap((key) => typeof value[key] === "string" ? [[key, value[key]]] : [])));
  }
  return undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function arrayOfRecords(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  return Array.isArray(value) ? value.filter(isRecord) : Object.freeze([]);
}

function safeCorrelationId(value: string): string {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u.test(value) ? value : "console-correlation-unavailable";
}

function unavailableOperationalEvidenceStatus(): Readonly<Record<string, "UNAVAILABLE">> {
  return immutableConsole({
    telemetry: "UNAVAILABLE" as const,
    operationalStatuses: "UNAVAILABLE" as const,
    securityPrivacySummary: "UNAVAILABLE" as const,
  });
}

const RELEASE_TRACE_RUNTIME_GAPS = Object.freeze([
  "ADMIN_CONSOLE",
  "AI_ADVISORY_FEAT_022",
  "AUDIT_API_016",
  "CORE_APIS_FEAT_001_011",
  "JOBS_API_017",
]);
const RELEASE_TRACE_KEYS = Object.freeze(["acceptanceManifest", "authorityProvenance", "candidate", "evidenceComposition", "promotionHandoff"]);
const RELEASE_CANDIDATE_KEYS = Object.freeze(["acceptanceResult", "artifactFingerprint", "candidateFingerprint", "logicalReleaseId", "releaseCandidateId", "runtimeGapComponentIds", "sourceCommitSha", "targetEnvironment"]);
const RELEASE_MANIFEST_KEYS = Object.freeze(["acceptanceManifestId", "acceptanceResult", "acceptedAt", "acceptedBy", "artifactFingerprint", "decisionEvidenceRef", "evaluatedAt", "evidenceRefs", "logicalReleaseId", "manifestFingerprint", "readinessRefs", "releaseCandidateId", "sourceCommitSha", "targetEnvironment"]);
const RELEASE_COMPOSITION_KEYS = Object.freeze(["acceptanceResult", "artifactFingerprint", "candidateBindingFingerprint", "compositionFingerprint", "evidenceRefs", "logicalReleaseId", "readinessRefs", "releaseCandidateId", "runtimeGapComponentIds", "sourceCommitSha", "targetEnvironment"]);
const RELEASE_AUTHORITY_KEYS = Object.freeze(["acceptanceAuthorityEvidenceRefs", "acceptedBy", "deploymentSodEvidenceRefs"]);
const RELEASE_HANDOFF_KEYS = Object.freeze(["acceptanceActorId", "acceptanceAuthorityEvidenceRefs", "acceptanceManifestId", "acceptanceResult", "acceptedAt", "artifactFingerprint", "deploymentSodEvidenceRefs", "handoffEvidenceFingerprint", "logicalReleaseId", "manifestFingerprint", "readinessRefs", "releaseCandidateId", "sourceCommitSha", "state", "targetEnvironment"]);

function projectReleaseTrace(value: unknown): Readonly<Record<string, unknown>> | "UNAVAILABLE" {
  if (!hasExactKeys(value, RELEASE_TRACE_KEYS)) return "UNAVAILABLE";
  const candidate = value["candidate"];
  const manifest = value["acceptanceManifest"];
  const composition = value["evidenceComposition"];
  const handoff = value["promotionHandoff"];
  const authority = value["authorityProvenance"];
  if (!hasExactKeys(candidate, RELEASE_CANDIDATE_KEYS)
    || !hasExactKeys(manifest, RELEASE_MANIFEST_KEYS)
    || !hasExactKeys(composition, RELEASE_COMPOSITION_KEYS)
    || !hasExactKeys(authority, RELEASE_AUTHORITY_KEYS)
    || !isRecord(handoff)) return "UNAVAILABLE";

  const bindingKeys = ["releaseCandidateId", "logicalReleaseId", "sourceCommitSha", "artifactFingerprint", "targetEnvironment"] as const;
  if (bindingKeys.some((key) => candidate[key] !== manifest[key] || candidate[key] !== composition[key])
    || composition["candidateBindingFingerprint"] !== candidate["candidateFingerprint"]
    || candidate["logicalReleaseId"] !== "REL-001"
    || candidate["targetEnvironment"] !== "Staging"
    || candidate["acceptanceResult"] !== "INCOMPLETE"
    || !isHex(candidate["releaseCandidateId"], 64)
    || !isHex(candidate["artifactFingerprint"], 64)
    || !isHex(candidate["candidateFingerprint"], 64)
    || !isHex(candidate["sourceCommitSha"], 40)
    || !isHex(manifest["acceptanceManifestId"], 64)
    || !isHex(manifest["manifestFingerprint"], 64)
    || !isHex(composition["compositionFingerprint"], 64)) return "UNAVAILABLE";

  const manifestResult = manifest["acceptanceResult"];
  if (!isAcceptanceResult(manifestResult) || composition["acceptanceResult"] !== manifestResult) return "UNAVAILABLE";
  const acceptedBy = manifest["acceptedBy"];
  const acceptedAt = manifest["acceptedAt"];
  if ((manifestResult === "ACCEPTED" && (!isSafeReleaseIdentifier(acceptedBy) || !isTimestamp(acceptedAt)))
    || (manifestResult !== "ACCEPTED" && (acceptedBy !== null || acceptedAt !== null))
    || authority["acceptedBy"] !== acceptedBy) return "UNAVAILABLE";

  const candidateGaps = safeStringList(candidate["runtimeGapComponentIds"], isSafeReleaseIdentifier);
  const compositionGaps = safeStringList(composition["runtimeGapComponentIds"], isSafeReleaseIdentifier);
  const evidenceRefs = safeStringList(manifest["evidenceRefs"], isSafeReleaseReference);
  const readinessRefs = safeStringList(manifest["readinessRefs"], isSafeReleaseReference);
  const compositionEvidenceRefs = safeStringList(composition["evidenceRefs"], isSafeReleaseReference);
  const compositionReadinessRefs = safeStringList(composition["readinessRefs"], isSafeReleaseReference);
  const authorityRefs = safeStringList(authority["acceptanceAuthorityEvidenceRefs"], isSafeReleaseReference);
  const sodRefs = safeStringList(authority["deploymentSodEvidenceRefs"], isSafeReleaseReference);
  if (candidateGaps === undefined || compositionGaps === undefined || evidenceRefs === undefined || readinessRefs === undefined
    || compositionEvidenceRefs === undefined || compositionReadinessRefs === undefined || authorityRefs === undefined || sodRefs === undefined
    || JSON.stringify(candidateGaps) !== JSON.stringify(compositionGaps)
    || (manifestResult === "INCOMPLETE" && JSON.stringify(candidateGaps) !== JSON.stringify(RELEASE_TRACE_RUNTIME_GAPS))
    || !isTimestamp(manifest["evaluatedAt"])
    || !isSafeReleaseReference(manifest["decisionEvidenceRef"])) return "UNAVAILABLE";

  const projectedHandoff = projectReleaseHandoff(handoff, candidate, manifest, authority, readinessRefs);
  if (projectedHandoff === undefined) return "UNAVAILABLE";
  return immutableConsole({
    candidate: { ...candidate, runtimeGapComponentIds: candidateGaps },
    acceptanceManifest: { ...manifest, evidenceRefs, readinessRefs },
    evidenceComposition: { ...composition, runtimeGapComponentIds: compositionGaps, evidenceRefs: compositionEvidenceRefs, readinessRefs: compositionReadinessRefs },
    promotionHandoff: projectedHandoff,
    authorityProvenance: { acceptedBy, acceptanceAuthorityEvidenceRefs: authorityRefs, deploymentSodEvidenceRefs: sodRefs },
  });
}

function projectReleaseHandoff(
  handoff: Readonly<Record<string, unknown>>,
  candidate: Readonly<Record<string, unknown>>,
  manifest: Readonly<Record<string, unknown>>,
  authority: Readonly<Record<string, unknown>>,
  readinessRefs: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (hasExactKeys(handoff, ["state"]) && handoff["state"] === "UNAVAILABLE") return Object.freeze({ state: "UNAVAILABLE" as const });
  if (!hasExactKeys(handoff, RELEASE_HANDOFF_KEYS) || handoff["state"] !== "AVAILABLE" || handoff["acceptanceResult"] !== "ACCEPTED") return undefined;
  const bindingKeys = ["releaseCandidateId", "logicalReleaseId", "sourceCommitSha", "artifactFingerprint", "targetEnvironment"] as const;
  const authorityRefs = safeStringList(handoff["acceptanceAuthorityEvidenceRefs"], isSafeReleaseReference);
  const sodRefs = safeStringList(handoff["deploymentSodEvidenceRefs"], isSafeReleaseReference);
  const handoffReadiness = safeStringList(handoff["readinessRefs"], isSafeReleaseReference);
  if (bindingKeys.some((key) => handoff[key] !== candidate[key])
    || handoff["acceptanceManifestId"] !== manifest["acceptanceManifestId"]
    || handoff["manifestFingerprint"] !== manifest["manifestFingerprint"]
    || handoff["acceptedAt"] !== manifest["acceptedAt"]
    || handoff["acceptanceActorId"] !== manifest["acceptedBy"]
    || !isHex(handoff["handoffEvidenceFingerprint"], 64)
    || authorityRefs === undefined || sodRefs === undefined || handoffReadiness === undefined
    || JSON.stringify(authorityRefs) !== JSON.stringify(authority["acceptanceAuthorityEvidenceRefs"])
    || JSON.stringify(sodRefs) !== JSON.stringify(authority["deploymentSodEvidenceRefs"])
    || JSON.stringify(handoffReadiness) !== JSON.stringify(readinessRefs)) return undefined;
  return immutableConsole({ ...handoff, readinessRefs: handoffReadiness, acceptanceAuthorityEvidenceRefs: authorityRefs, deploymentSodEvidenceRefs: sodRefs });
}

function hasExactKeys(value: unknown, expected: readonly string[]): value is Readonly<Record<string, unknown>> {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"));
  const sorted = [...expected].sort((left, right) => left.localeCompare(right, "en"));
  return actual.length === sorted.length && actual.every((key, index) => key === sorted[index]);
}

function isHex(value: unknown, length: 40 | 64): value is string {
  return typeof value === "string" && new RegExp(`^[a-f0-9]{${length}}$`, "u").test(value);
}

function isAcceptanceResult(value: unknown): value is "ACCEPTED" | "REJECTED" | "INCOMPLETE" {
  return value === "ACCEPTED" || value === "REJECTED" || value === "INCOMPLETE";
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  return new Date(value).toISOString() === value;
}

function isSafeReleaseIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u.test(value)
    && !isUnsafeSecurityDetailValue(value)
    && !/(?:authorization|bearer|cookie|credential|password|private.?key|secret|session.?token|token|prompt|chain.?of.?thought|stack|sql|sqlite|database|[A-Z]:\\)/iu.test(value);
}

function isSafeReleaseReference(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:#/-]{0,255}$/u.test(value)
    && !isUnsafeSecurityDetailValue(value)
    && !/(?:authorization|bearer|cookie|credential|password|private.?key|secret|session.?token|token|prompt|chain.?of.?thought|stack|sql|sqlite|database|[A-Z]:\\)/iu.test(value);
}

function safeStringList(value: unknown, predicate: (item: unknown) => item is string): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length > 64 || !value.every(predicate) || new Set(value).size !== value.length) return undefined;
  return Object.freeze([...value]);
}

export function immutableConsole<Value>(value: Value): Value {
  const copy = structuredClone(value);
  deepFreeze(copy);
  return copy;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) deepFreeze(child);
  Object.freeze(value);
}
