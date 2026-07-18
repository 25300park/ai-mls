import type {
  AuditSink,
  Clock,
  DataClassification,
  IdFactory,
} from "../../../packages/security-contracts/src/index.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import { classifyCombinedData } from "../../security/src/privacy-controls.js";
import type { SourceRegistryService } from "./source-registry-service.js";

export interface RawSourceEvidence {
  readonly id: string;
  readonly sourceId: string;
  readonly sourcePolicyVersion: number;
  readonly status: "ACCEPTED";
  readonly method: string;
  readonly purpose: string;
  readonly evidenceReference: string;
  readonly observedAt: string;
  readonly capturedAt: string;
  readonly fingerprint: string;
  readonly language: string;
  readonly classification: DataClassification;
  readonly retentionClass: string;
  readonly capturedBy: string;
}

interface CaptureRawSourceRequest {
  readonly actor: SessionContext;
  readonly sourceId: string;
  readonly sourcePolicyVersion: number;
  readonly method: string;
  readonly purpose: string;
  readonly evidenceReference: string;
  readonly observedAt: string;
  readonly capturedAt: string;
  readonly fingerprint: string;
  readonly language: string;
  readonly classification: DataClassification;
  readonly retentionClass: string;
  readonly requestId?: string;
  readonly correlationId: string;
}

interface RawSourceStoreDependencies {
  readonly sourceRegistryService: SourceRegistryService;
  readonly auditSink: AuditSink;
  readonly clock: Clock;
  readonly idFactory: IdFactory;
  readonly policyVersion: string;
}

function immutableEvidence(evidence: RawSourceEvidence): RawSourceEvidence {
  return Object.freeze(structuredClone(evidence));
}

export class RawSourceStore {
  readonly #sourceRegistryService: SourceRegistryService;
  readonly #auditSink: AuditSink;
  readonly #clock: Clock;
  readonly #idFactory: IdFactory;
  readonly #policyVersion: string;
  readonly #evidence = new Map<string, RawSourceEvidence>();

  public constructor(dependencies: RawSourceStoreDependencies) {
    this.#sourceRegistryService = dependencies.sourceRegistryService;
    this.#auditSink = dependencies.auditSink;
    this.#clock = dependencies.clock;
    this.#idFactory = dependencies.idFactory;
    this.#policyVersion = dependencies.policyVersion;
  }

  public capture(request: CaptureRawSourceRequest): RawSourceEvidence {
    this.#validateRequest(request);
    const policy = this.#sourceRegistryService.requireCapturePolicy({
      actor: request.actor,
      sourceId: request.sourceId,
      sourcePolicyVersion: request.sourcePolicyVersion,
      method: request.method,
      purpose: request.purpose,
      ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
      correlationId: request.correlationId,
    });
    const evidence = immutableEvidence({
      id: this.#idFactory(),
      sourceId: policy.id,
      sourcePolicyVersion: policy.policyVersion,
      status: "ACCEPTED",
      method: request.method,
      purpose: request.purpose,
      evidenceReference: request.evidenceReference,
      observedAt: request.observedAt,
      capturedAt: request.capturedAt,
      fingerprint: request.fingerprint,
      language: request.language,
      classification: classifyCombinedData([
        policy.classification,
        request.classification,
      ]),
      retentionClass: request.retentionClass,
      capturedBy: request.actor.principalId,
    });
    this.#evidence.set(evidence.id, evidence);
    this.#auditSink.append({
      eventType: "RAW_SOURCE_ACCEPTED",
      principal: {
        id: request.actor.principalId,
        type: request.actor.principalType,
        roles: request.actor.roles,
        ...(request.actor.teamId === undefined ? {} : { teamId: request.actor.teamId }),
        sessionId: request.actor.id,
      },
      action: "raw-source.capture",
      target: { type: "RawSource", id: evidence.id, version: 1 },
      purpose: request.purpose,
      policyVersion: this.#policyVersion,
      classification: evidence.classification,
      decision: "ALLOW",
      outcome: "COMPLETED",
      ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
      correlationId: request.correlationId,
      details: {
        sourceId: evidence.sourceId,
        sourcePolicyVersion: evidence.sourcePolicyVersion,
        inputFingerprint: evidence.fingerprint,
        retentionClass: evidence.retentionClass,
      },
    });
    return evidence;
  }

  public read(evidenceId: string): RawSourceEvidence {
    const evidence = this.#evidence.get(evidenceId);
    if (evidence === undefined) {
      throw new Error("RAW_SOURCE_NOT_FOUND");
    }
    return evidence;
  }

  #validateRequest(request: CaptureRawSourceRequest): void {
    if (
      request.evidenceReference.trim().length === 0 ||
      request.fingerprint.trim().length === 0 ||
      request.language.trim().length === 0 ||
      request.retentionClass.trim().length === 0
    ) {
      throw new Error("PROVENANCE_REQUIRED");
    }
    const observedAt = new Date(request.observedAt).getTime();
    const capturedAt = new Date(request.capturedAt).getTime();
    if (
      !Number.isFinite(observedAt) ||
      !Number.isFinite(capturedAt) ||
      observedAt > capturedAt ||
      capturedAt > this.#clock().getTime()
    ) {
      throw new Error("EVIDENCE_INVALID");
    }
  }
}
