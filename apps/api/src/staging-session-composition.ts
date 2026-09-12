import type { AuditSink, Clock, IdFactory } from "../../../packages/security-contracts/src/index.js";
import type { AuthorizationService } from "../../../modules/authorization/src/authorization-service.js";
import {
  DurableSessionUnitOfWork,
  SessionAccessCoordinator,
  SessionService,
  type AuthenticationAdapter,
  type TrustedSessionBindingResolver,
} from "../../../modules/identity/src/index.js";

const STAGING_SESSION_LIFETIME_MILLISECONDS = 12 * 60 * 60 * 1000;
const allowedOptionKeys = new Set([
  "runtimeEnvironment",
  "databasePath",
  "authenticationAdapter",
  "auditSink",
  "authorization",
  "bindingResolver",
  "clock",
  "idFactory",
  "tenantBindingOrigin",
]);

export interface StagingSessionCompositionOptions {
  readonly runtimeEnvironment: "STAGING";
  readonly databasePath: string;
  readonly authenticationAdapter: AuthenticationAdapter;
  readonly auditSink: AuditSink;
  readonly authorization: Pick<AuthorizationService, "evaluate"> & StagingReadinessProbe;
  readonly bindingResolver: TrustedSessionBindingResolver & StagingReadinessProbe;
  readonly clock: Clock;
  readonly idFactory: IdFactory;
  readonly tenantBindingOrigin: string;
}

interface StagingReadinessProbe {
  isReady(): boolean;
}

export interface StagingSessionRuntimeStatus {
  readonly health: "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN";
  readonly readiness: "READY" | "NOT_READY" | "DEGRADED" | "UNKNOWN";
}

export interface StagingSessionComposition {
  readonly sessionService: SessionService;
  readonly sessionAccess: SessionAccessCoordinator;
  status(): StagingSessionRuntimeStatus;
  close(): void;
}

export class StagingSessionCompositionError extends Error {
  public constructor(
    public readonly code: "STAGING_SESSION_NOT_READY",
    public readonly publicMessage: "Staging Session runtime is not ready.",
  ) {
    super(publicMessage);
    this.name = "StagingSessionCompositionError";
  }
}

export function createStagingSessionComposition(
  options: StagingSessionCompositionOptions,
): StagingSessionComposition {
  if (!validOptions(options)) throw notReady();
  let unitOfWork: DurableSessionUnitOfWork | undefined;
  try {
    unitOfWork = new DurableSessionUnitOfWork({ databasePath: options.databasePath });
    const sessionService = new SessionService({
      authenticationAdapter: options.authenticationAdapter,
      auditSink: options.auditSink,
      clock: options.clock,
      idFactory: options.idFactory,
      accessLifetimeMs: STAGING_SESSION_LIFETIME_MILLISECONDS,
      absoluteLifetimeMs: STAGING_SESSION_LIFETIME_MILLISECONDS,
      unitOfWork,
      tenantBindingOrigin: options.tenantBindingOrigin,
    });
    const sessionAccess = new SessionAccessCoordinator({
      unitOfWork,
      bindingResolver: options.bindingResolver,
      authorization: options.authorization,
      clock: options.clock,
    });
    let closed = false;
    return Object.freeze({
      sessionService,
      sessionAccess,
      status: (): StagingSessionRuntimeStatus => {
        if (closed) return Object.freeze({ health: "UNHEALTHY", readiness: "NOT_READY" });
        try {
          unitOfWork?.sessions.find("staging-session-readiness-probe");
          if (!options.bindingResolver.isReady() || !options.authorization.isReady()) {
            return Object.freeze({ health: "UNHEALTHY", readiness: "NOT_READY" });
          }
          return Object.freeze({ health: "HEALTHY", readiness: "READY" });
        } catch {
          return Object.freeze({ health: "UNHEALTHY", readiness: "NOT_READY" });
        }
      },
      close: (): void => {
        if (closed) return;
        closed = true;
        unitOfWork?.close();
      },
    });
  } catch {
    try { unitOfWork?.close(); } catch { /* preserve safe composition failure */ }
    throw notReady();
  }
}

function validOptions(value: unknown): value is StagingSessionCompositionOptions {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const options = value as Record<string, unknown>;
  return Object.keys(options).every((key) => allowedOptionKeys.has(key))
    && options["runtimeEnvironment"] === "STAGING"
    && typeof options["databasePath"] === "string"
    && options["databasePath"].trim().length > 0
    && typeof options["tenantBindingOrigin"] === "string"
    && options["tenantBindingOrigin"].trim().length > 0
    && hasMethod(options["authenticationAdapter"], "verify")
    && hasMethod(options["auditSink"], "append")
    && hasMethod(options["authorization"], "evaluate")
    && hasMethod(options["authorization"], "isReady")
    && hasMethod(options["bindingResolver"], "resolve")
    && hasMethod(options["bindingResolver"], "isReady")
    && typeof options["clock"] === "function"
    && typeof options["idFactory"] === "function";
}

function hasMethod(value: unknown, method: string): boolean {
  return typeof value === "object"
    && value !== null
    && method in value
    && typeof (value as Record<string, unknown>)[method] === "function";
}

function notReady(): StagingSessionCompositionError {
  return new StagingSessionCompositionError(
    "STAGING_SESSION_NOT_READY",
    "Staging Session runtime is not ready.",
  );
}
