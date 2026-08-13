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

export const CONSOLE_PAGES = Object.freeze([
  "DASHBOARD",
  "UI-031",
  "UI-032",
  "UI-033",
  "UI-035",
  "PROJECTION",
  "OPERATIONS",
] as const);

export type ConsolePage = typeof CONSOLE_PAGES[number];
export type ConsoleReadState = "READY" | "EMPTY" | "UNAVAILABLE" | "ERROR";

export interface ConsoleReadRequest {
  readonly page: ConsolePage;
  readonly sessionId: string;
  readonly tenantId: string;
  readonly teamId: string;
  readonly publicationId?: string;
  readonly correlationId: string;
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

interface ConsoleReadAdapterDependencies {
  readonly queryPort: ConsolePublicationQueryPort;
  readonly operationsRead: PublicationOperationsReadPort;
  readonly projectionRead: PublicationOperationsProjectionReadPort;
  readonly sessionResolver: PublicationSessionResolver;
  readonly authorizationEvaluator: ConsoleAuthorizationEvaluator;
  readonly clock: PublicationClock;
}

const publicationOperations: Readonly<Record<Exclude<ConsolePage, "DASHBOARD" | "PROJECTION" | "OPERATIONS">, PublicationQueryRequest["operation"]>> = Object.freeze({
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
        case "PROJECTION": return this.readProjection(request);
        case "OPERATIONS": return this.readOperations(request);
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
    const response = this.dependencies.queryPort.executeQuery({
      requestId: `console-${request.correlationId}`,
      sessionId: request.sessionId,
      operation: publicationOperations[request.page as keyof typeof publicationOperations],
      tenantId: request.tenantId,
      teamId: request.teamId,
      purpose: "PUBLICATION_EXECUTION",
      correlationId: request.correlationId,
      publicationId: request.publicationId,
      maxEntries: 50,
    } satisfies PublicationQueryRequest);
    if (!response.success) {
      return response.error.code === "NOT_FOUND"
        ? emptyResult(request.page, "No authorized Publication record is currently available.")
        : this.safeError(request);
    }
    return immutableConsole({
      page: request.page,
      state: "READY" as const,
      data: recordOf(response.result.view),
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
