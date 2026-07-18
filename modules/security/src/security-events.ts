import type {
  AppendAuditEvent,
  AuditEvent,
  AuditPrincipal,
  AuditSink,
  AuditTarget,
  DataClassification,
} from "../../../packages/security-contracts/src/index.js";
import { sanitizeSecurityDetails } from "./privacy-controls.js";

type SecuritySeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SecurityEventRequest {
  readonly eventType: string;
  readonly principal: AuditPrincipal;
  readonly action: string;
  readonly target: AuditTarget;
  readonly purpose: string;
  readonly classification: DataClassification;
  readonly decision: AppendAuditEvent["decision"];
  readonly outcome: AppendAuditEvent["outcome"];
  readonly severity: SecuritySeverity;
  readonly reason: string;
  readonly requestId?: string;
  readonly correlationId: string;
  readonly controlIds: readonly string[];
  readonly observedFacts: Readonly<Record<string, unknown>>;
  readonly detectorInference?: Readonly<Record<string, unknown>>;
}

interface SecurityEventDetails extends Readonly<Record<string, unknown>> {
  readonly severity: SecuritySeverity;
  readonly controlIds: readonly string[];
  readonly observedFacts: Readonly<Record<string, unknown>>;
  readonly detectorInference?: Readonly<Record<string, unknown>>;
}

export interface SecurityEvent extends AuditEvent {
  readonly details: SecurityEventDetails;
}

interface SecurityEventServiceDependencies {
  readonly auditSink: AuditSink;
  readonly policyVersion: string;
}

export class SecurityEventService {
  readonly #auditSink: AuditSink;
  readonly #policyVersion: string;

  public constructor(dependencies: SecurityEventServiceDependencies) {
    this.#auditSink = dependencies.auditSink;
    this.#policyVersion = dependencies.policyVersion;
  }

  public record(request: SecurityEventRequest): SecurityEvent {
    const details: SecurityEventDetails = {
      severity: request.severity,
      controlIds: Object.freeze([...request.controlIds]),
      observedFacts: sanitizeSecurityDetails(request.observedFacts),
      ...(request.detectorInference === undefined
        ? {}
        : {
            detectorInference: sanitizeSecurityDetails(
              request.detectorInference,
            ),
          }),
    };
    return this.#auditSink.append({
      eventType: request.eventType,
      principal: request.principal,
      action: request.action,
      target: request.target,
      purpose: request.purpose,
      policyVersion: this.#policyVersion,
      classification: request.classification,
      decision: request.decision,
      outcome: request.outcome,
      reason: request.reason,
      ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
      correlationId: request.correlationId,
      details,
    }) as SecurityEvent;
  }
}
