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
  executeQuery(input: unknown): PublicationQueryResponse;
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
}

const publicationOperations: Readonly<Record<Exclude<ConsolePage, "DASHBOARD" | "ADMINISTRATION" | "UI-036" | "PROJECTION" | "OPERATIONS" | "CONNECTOR" | "EXTERNAL_INTEGRATION" | "RECOVERY_CASE" | "EVIDENCE">, PublicationQueryRequest["operation"]>> = Object.freeze({
  "UI-031": "GET_PUBLICATION_OPERATIONS_VIEW",
  "UI-032": "GET_PUBLICATION_REVALIDATION_VIEW",
  "UI-033": "GET_PUBLICATION_RECOVERY_VIEW",
  "UI-035": "GET_PUBLICATION_AUDIT_VIEW",
});

export class ConsoleReadAdapter {
  public constructor(private readonly dependencies: ConsoleReadAdapterDependencies) {}

  public read(request: ConsoleReadRequest): ConsoleReadResult {
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
        case "UI-035": return this.readPublication(request);
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

  private readPublication(request: ConsoleReadRequest): ConsoleReadResult {
    if (request.publicationId === undefined || request.publicationId.trim().length === 0) {
      return emptyResult(request.page, "No Publication record is currently selected.");
    }
    const response = this.queryPublication(request, publicationOperations[request.page as keyof typeof publicationOperations]);
    if (!response.success) {
      return response.error.code === "NOT_FOUND"
        ? emptyResult(request.page, "No authorized Publication record is currently available.")
        : this.safeError(request);
    }
    if (request.page === "UI-031") return this.readPublicationOperations(request, response);
    return immutableConsole({
      page: request.page,
      state: "READY" as const,
      data: recordOf(response.result.view),
    });
  }

  private queryPublication(request: ConsoleReadRequest, operation: PublicationQueryRequest["operation"]): PublicationQueryResponse {
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

  private readPublicationOperations(request: ConsoleReadRequest, operationsResponse: Extract<PublicationQueryResponse, { readonly success: true }>): ConsoleReadResult {
    const supplemental = [
      this.queryPublication(request, "GET_PUBLICATION_REVALIDATION_VIEW"),
      this.queryPublication(request, "GET_PUBLICATION_RECOVERY_VIEW"),
      this.queryPublication(request, "GET_PUBLICATION_AUDIT_VIEW"),
    ];
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
    if (!this.authorizeOperationalRead(request, "PublicationOperations", "system")) return concealedResult(request.page);
    const status = this.dependencies.operationsRead.getSystemOperationalStatus();
    return immutableConsole({
      page: request.page,
      state: "READY" as const,
      data: {
        health: status.health,
        readiness: status.readiness,
        components: status.components,
        metrics: this.dependencies.operationsRead.getOperationalMetrics(),
        observedAt: status.observedAt,
      },
    });
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
      data: selectFields(result.data, [
        "batchId", "invocationId", "technicalStatus", "normalizedOutcome", "currentVersion",
        "evidenceRef", "updatedAt", "checkpointReference", "checkpointVersion",
      ]),
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
    return immutableConsole({
      page: request.page,
      state: "READY" as const,
      data: selectFields(result.data, [
        "recoveryCaseId", "originDomain", "originIdentity", "status", "finding", "recoveryId",
        "evidenceRefs", "version", "createdAt", "resolvedAt",
      ]),
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
    const session = this.resolveCurrentSession(request);
    if (session === undefined || request.teamId !== request.tenantId || session.teamId !== request.tenantId) return false;
    try {
      return this.dependencies.authorizationEvaluator.evaluate({
        session,
        action: "resource.view",
        resource: { type: resourceType, id: resourceId, teamId: request.teamId },
        purpose: "PUBLICATION_EXECUTION",
        reason: "Bounded read-only Admin Console visibility",
        requestId: `console-${request.correlationId}`,
        correlationId: request.correlationId,
      }).effect === "ALLOW";
    } catch {
      return false;
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function arrayOfRecords(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  return Array.isArray(value) ? value.filter(isRecord) : Object.freeze([]);
}

function safeCorrelationId(value: string): string {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u.test(value) ? value : "console-correlation-unavailable";
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
