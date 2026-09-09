import type {
  AuthorizationDecision,
  AuthorizationRequest,
} from "../../authorization/src/authorization-service.js";
import {
  hasVerifiedMfaAssurance,
  type SessionContext,
} from "../../identity/src/session-service.js";
import type {
  OperationalEvidenceBinding,
  OperationalEvidenceStore,
} from "./durable-operational-evidence-store.js";
import {
  validateOperationalReference,
  validateOperationalResourceReference,
  type OperationalTelemetryRecord,
} from "./operational-telemetry-contracts.js";
import {
  validateOperationalStatusProjectionRequest,
  type OperationalHealth,
  type OperationalReadiness,
  type OperationalStatusSnapshot,
} from "./operational-status-projection.js";

const SECURITY_MONITORING_PURPOSE = "SECURITY_MONITORING";
const OPERATIONAL_EVIDENCE_RESOURCE = "OPERATIONAL_EVIDENCE";

interface AuthorizationEvaluator {
  evaluate(request: AuthorizationRequest): AuthorizationDecision;
}

export interface SecurityOperationalAccessRequest {
  readonly session: SessionContext;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly resourceRef: string;
  readonly correlationId: string;
}

export interface SecurityReadinessProjectionRequest extends SecurityOperationalAccessRequest {
  readonly telemetryEventId: string;
  readonly statusSnapshotId: string;
  readonly health: OperationalHealth;
  readonly readiness: OperationalReadiness;
  readonly evaluatedAt: string;
  readonly freshnessThresholdMs: number | null;
  readonly reason: string;
}

interface SecurityPrivacyOperationalControlDependencies {
  readonly authorizationService: AuthorizationEvaluator;
  readonly evidenceStore: OperationalEvidenceStore;
}

export class SecurityPrivacyOperationalControlService {
  readonly #authorizationService: AuthorizationEvaluator;
  readonly #evidenceStore: OperationalEvidenceStore;

  public constructor(dependencies: SecurityPrivacyOperationalControlDependencies) {
    this.#authorizationService = dependencies.authorizationService;
    this.#evidenceStore = dependencies.evidenceStore;
  }

  public readEvidence(request: SecurityOperationalAccessRequest): readonly OperationalTelemetryRecord[] {
    if (!isAccessRequest(request)) return Object.freeze([]);
    const decision = this.#authorize(request, "audit.query");
    if (decision?.effect !== "ALLOW") return Object.freeze([]);
    try {
      return this.#evidenceStore.listScoped(binding(request), {
        component: "SECURITY",
        resourceRef: request.resourceRef,
        limit: 100,
      });
    } catch { return Object.freeze([]); }
  }

  public projectSecurityReadiness(request: SecurityReadinessProjectionRequest): OperationalStatusSnapshot | undefined {
    if (!isReadinessRequest(request)) return undefined;
    const decision = this.#authorize(request, "security.admin", request.reason);
    if (decision?.effect !== "ALLOW") return undefined;
    try {
      const source = this.#evidenceStore.listScoped(binding(request), {
        component: "SECURITY",
        resourceRef: request.resourceRef,
        limit: 100,
      }).find(({ telemetryEventId }) => telemetryEventId === request.telemetryEventId);
      if (source === undefined) return undefined;
      return this.#evidenceStore.projectStatus({
        statusSnapshotId: request.statusSnapshotId,
        telemetryEventId: request.telemetryEventId,
        health: request.health,
        readiness: request.readiness,
        evaluatedAt: request.evaluatedAt,
        freshnessThresholdMs: request.freshnessThresholdMs,
      });
    } catch { return undefined; }
  }

  #authorize(
    request: SecurityOperationalAccessRequest,
    action: "audit.query" | "security.admin",
    reason?: string,
  ): AuthorizationDecision | undefined {
    if (!hasVerifiedMfaAssurance(request.session)) return undefined;
    try {
      return this.#authorizationService.evaluate({
        session: request.session,
        action,
        resource: {
          type: OPERATIONAL_EVIDENCE_RESOURCE,
          id: request.resourceRef,
          tenantId: request.tenantId,
          teamId: request.scopeRef,
        },
        purpose: SECURITY_MONITORING_PURPOSE,
        ...(reason === undefined ? {} : { reason }),
        correlationId: request.correlationId,
      });
    } catch { return undefined; }
  }
}

function binding(request: SecurityOperationalAccessRequest): OperationalEvidenceBinding {
  return { tenantId: request.tenantId, scopeRef: request.scopeRef };
}

function isAccessRequest(value: unknown): value is SecurityOperationalAccessRequest {
  if (!isExactObject(value, ["session", "tenantId", "scopeRef", "resourceRef", "correlationId"])) return false;
  try {
    assertScopeValue(value["tenantId"]);
    assertScopeValue(value["scopeRef"]);
    validateOperationalResourceReference(value["resourceRef"]);
    validateOperationalReference(value["correlationId"], "correlation:");
    return typeof value["session"] === "object" && value["session"] !== null;
  } catch { return false; }
}

function isReadinessRequest(value: unknown): value is SecurityReadinessProjectionRequest {
  const keys = [
    "session", "tenantId", "scopeRef", "resourceRef", "correlationId", "telemetryEventId",
    "statusSnapshotId", "health", "readiness", "evaluatedAt", "freshnessThresholdMs", "reason",
  ];
  if (!isExactObject(value, keys) || typeof value["reason"] !== "string" || value["reason"].trim().length === 0) return false;
  const access = {
    session: value["session"], tenantId: value["tenantId"], scopeRef: value["scopeRef"],
    resourceRef: value["resourceRef"], correlationId: value["correlationId"],
  };
  if (!isAccessRequest(access)) return false;
  try {
    validateOperationalStatusProjectionRequest({
      statusSnapshotId: value["statusSnapshotId"], telemetryEventId: value["telemetryEventId"],
      health: value["health"], readiness: value["readiness"], evaluatedAt: value["evaluatedAt"],
      freshnessThresholdMs: value["freshnessThresholdMs"],
    });
    return true;
  } catch { return false; }
}

function isExactObject(value: unknown, keys: readonly string[]): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function assertScopeValue(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.trim() !== value || value.length < 1 || value.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)) throw new TypeError("Invalid trusted operational scope.");
}
