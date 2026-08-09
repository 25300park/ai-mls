import { immutableDomain, type PublicationIdentity } from "./publication-contracts.js";
import { InMemoryPersistenceState } from "./in-memory-persistence-state.js";
import { persistenceError } from "./publication-persistence-error.js";

export interface PublicationAuditRecord {
  readonly id: string;
  readonly tenantScopeId: string;
  readonly aggregateId: string;
  readonly command: string;
  readonly actorId: string;
  readonly timestamp: string;
  readonly version: number;
  readonly result: "COMPLETED" | "FAILED";
  readonly failureReason?: string;
  readonly decision?: string;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly checkedAt?: string;
  readonly evidenceRefs?: readonly string[];
  readonly eventId?: string;
  readonly eventType?: string;
  readonly eventSequence?: number;
  readonly safeReasonCode?: string;
}

export interface PublicationAuditStore {
  append(input: PublicationAuditRecord): PublicationAuditRecord;
  list(identity: PublicationIdentity): readonly PublicationAuditRecord[];
}

export class InMemoryPublicationAuditStore implements PublicationAuditStore {
  public constructor(
    private readonly state: InMemoryPersistenceState = new InMemoryPersistenceState(),
    private readonly scope?: PublicationIdentity,
    private readonly assertUsable: () => void = () => undefined,
  ) {}

  public append(input: PublicationAuditRecord): PublicationAuditRecord {
    this.assertUsable();
    this.assertScope(input);
    if ((input.result === "FAILED") !== (input.failureReason !== undefined && input.failureReason.trim().length > 0)) {
      throw persistenceError("AUDIT_RECORD_INVALID", "Audit failure evidence is inconsistent with its result.");
    }
    const recoveryValues = [input.decision, input.reason, input.checkedAt];
    const hasCanonicalEventEvidence = input.eventId !== undefined || input.eventType !== undefined || input.eventSequence !== undefined || input.safeReasonCode !== undefined;
    const hasRecoveryEvidence = !hasCanonicalEventEvidence && (recoveryValues.some((value) => value !== undefined) || input.evidenceRefs !== undefined);
    const requiresRecoveryEvidence = input.command === "RESOLVE_RECONCILIATION" && input.result === "COMPLETED";
    const validRecoveryEvidence = recoveryValues.every((value) => typeof value === "string" && value.trim().length > 0)
      && recoveryDecisions.has(input.decision ?? "")
      && input.checkedAt === input.timestamp
      && Array.isArray(input.evidenceRefs)
      && input.evidenceRefs.length > 0
      && input.evidenceRefs.every((reference: unknown) => typeof reference === "string" && reference.trim().length > 0);
    if ((requiresRecoveryEvidence || hasRecoveryEvidence) && !validRecoveryEvidence) {
      throw persistenceError("AUDIT_RECORD_INVALID", "Recovery audit evidence is incomplete or invalid.");
    }
    const eventValues = [input.eventId, input.eventType, input.eventSequence, input.safeReasonCode];
    const hasEventEvidence = eventValues.some((value) => value !== undefined);
    const validEventEvidence = typeof input.eventId === "string" && input.eventId.trim().length > 0
      && typeof input.eventType === "string" && /^EVT-\d{3}$/u.test(input.eventType)
      && Number.isSafeInteger(input.eventSequence) && (input.eventSequence ?? 0) > 0
      && typeof input.correlationId === "string" && input.correlationId.trim().length > 0
      && typeof input.safeReasonCode === "string" && input.safeReasonCode.trim().length > 0;
    if (hasEventEvidence && !validEventEvidence) throw persistenceError("AUDIT_RECORD_INVALID", "Canonical Event audit evidence is incomplete or invalid.");
    if (this.state.audits.has(input.id)) throw persistenceError("AUDIT_RECORD_DUPLICATE", "Audit record already exists.");
    const record = immutableDomain(input);
    this.state.audits.set(input.id, record);
    this.state.markScopeChanged(input.tenantScopeId, input.aggregateId);
    return record;
  }

  public list(identity: PublicationIdentity): readonly PublicationAuditRecord[] {
    this.assertUsable();
    this.assertScope(identity);
    const records = [...this.state.audits.values()].filter(
      (record) => record.tenantScopeId === identity.tenantScopeId && record.aggregateId === identity.publicationId,
    );
    return immutableDomain(records);
  }

  private assertScope(identity: PublicationIdentity | PublicationAuditRecord): void {
    const publicationId = "publicationId" in identity ? identity.publicationId : identity.aggregateId;
    if (this.scope !== undefined && (publicationId !== this.scope.publicationId || identity.tenantScopeId !== this.scope.tenantScopeId)) {
      throw persistenceError("PERSISTENCE_SCOPE_VIOLATION", "Audit operation is outside the transaction scope.");
    }
  }
}

const recoveryDecisions = new Set(["CONFIRMED", "RECOVERED", "REJECTED", "MANUAL_REVIEW_REQUIRED", "NO_ACTION_REQUIRED"]);
