import type {
  AuditPrincipal,
  AuditSink,
  Clock,
  DataClassification,
  IdFactory,
} from "../../../packages/security-contracts/src/index.js";
import type { AuthorizationService } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import type { JobService } from "../../jobs/src/job-service.js";
import type { AiValidationDecision } from "../../jobs/src/ai-result-validator.js";
import type { RawSourceStore } from "../../source/src/raw-source-store.js";
import { classifyCombinedData } from "../../security/src/privacy-controls.js";

export type IntakeStatus =
  | "DRAFT"
  | "VALIDATED"
  | "VALIDATION_FAILED"
  | "QUARANTINED"
  | "AI_REQUESTED"
  | "REVIEW_REQUIRED"
  | "REGISTERED"
  | "REJECTED";

export interface CandidateDraftReference {
  readonly id: string;
  readonly version: number;
}

export interface CandidateDraftPort {
  register(request: {
    readonly intakeId: string;
    readonly intakeVersion: number;
    readonly rawSourceId: string;
    readonly rawSourceVersion: number;
    readonly reviewedBy: string;
    readonly reason: string;
    readonly correlationId: string;
    readonly aiResultReference?: string;
  }): CandidateDraftReference;
}

export interface Intake {
  readonly id: string;
  readonly version: number;
  readonly status: IntakeStatus;
  readonly rawSourceId: string;
  readonly rawSourceVersion: number;
  readonly rawSourceFingerprint: string;
  readonly purpose: string;
  readonly classification: DataClassification;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly attachmentReferences: readonly RawAttachmentReference[];
  readonly jobId?: string;
  readonly fallbackReason?: string;
  readonly aiResultReference?: string;
  readonly candidateReference?: CandidateDraftReference;
}

export interface RawAttachmentReference {
  readonly id: string;
  readonly evidenceReference: string;
  readonly fingerprint: string;
  readonly classification: DataClassification;
  readonly retentionClass: string;
  readonly status: "CLEARED" | "QUARANTINED";
}

type CaptureRequest = Parameters<RawSourceStore["capture"]>[0];

type CreateDraftRequest = CaptureRequest;

interface IntakeCommand {
  readonly actor: SessionContext;
  readonly intakeId: string;
  readonly expectedVersion: number;
  readonly requestId?: string;
  readonly correlationId: string;
}

interface ValidateIntakeRequest extends IntakeCommand {
  readonly safetyState: "SAFE" | "UNSAFE";
  readonly metadataComplete: boolean;
}

interface RequestAiRequest extends IntakeCommand {
  readonly deadline: string;
  readonly idempotencyKey: string;
}

interface AttachEvidenceRequest extends IntakeCommand {
  readonly evidenceReference: string;
  readonly fingerprint: string;
  readonly classification: DataClassification;
  readonly retentionClass: string;
  readonly safetyState: "CLEARED" | "QUARANTINED";
}

interface ReviewIntakeRequest extends IntakeCommand {
  readonly decision: "REGISTER_CANDIDATE" | "REJECT";
  readonly reason: string;
}

interface RouteJobOutcomeRequest extends IntakeCommand {
  readonly validationDecision?: AiValidationDecision;
}

interface IntakeServiceDependencies {
  readonly rawSourceStore: RawSourceStore;
  readonly jobService: JobService;
  readonly candidateDraftPort: CandidateDraftPort;
  readonly authorizationService: AuthorizationService;
  readonly auditSink: AuditSink;
  readonly clock: Clock;
  readonly idFactory: IdFactory;
  readonly policyVersion: string;
}

function immutableIntake(intake: Intake): Intake {
  const snapshot = structuredClone(intake);
  snapshot.attachmentReferences.forEach((reference) => Object.freeze(reference));
  Object.freeze(snapshot.attachmentReferences);
  if (snapshot.candidateReference !== undefined) {
    Object.freeze(snapshot.candidateReference);
  }
  return Object.freeze(snapshot);
}

function principal(session: SessionContext): AuditPrincipal {
  return {
    id: session.principalId,
    type: session.principalType,
    roles: session.roles,
    ...(session.teamId === undefined ? {} : { teamId: session.teamId }),
    sessionId: session.id,
  };
}

export class IntakeService {
  readonly #rawSourceStore: RawSourceStore;
  readonly #jobService: JobService;
  readonly #candidateDraftPort: CandidateDraftPort;
  readonly #authorizationService: AuthorizationService;
  readonly #auditSink: AuditSink;
  readonly #clock: Clock;
  readonly #idFactory: IdFactory;
  readonly #policyVersion: string;
  readonly #intakes = new Map<string, Intake>();

  public constructor(dependencies: IntakeServiceDependencies) {
    this.#rawSourceStore = dependencies.rawSourceStore;
    this.#jobService = dependencies.jobService;
    this.#candidateDraftPort = dependencies.candidateDraftPort;
    this.#authorizationService = dependencies.authorizationService;
    this.#auditSink = dependencies.auditSink;
    this.#clock = dependencies.clock;
    this.#idFactory = dependencies.idFactory;
    this.#policyVersion = dependencies.policyVersion;
  }

  public createDraft(request: CreateDraftRequest): Intake {
    const evidence = this.#rawSourceStore.capture(request);
    const intake = immutableIntake({
      id: this.#idFactory(),
      version: 1,
      status: "DRAFT",
      rawSourceId: evidence.id,
      rawSourceVersion: 1,
      rawSourceFingerprint: evidence.fingerprint,
      purpose: evidence.purpose,
      classification: evidence.classification,
      createdBy: request.actor.principalId,
      createdAt: this.#clock().toISOString(),
      attachmentReferences: [],
    });
    this.#intakes.set(intake.id, intake);
    this.#record("INTAKE_CREATED", "intake.create", intake, request.actor, request, "ACCEPTED");
    return intake;
  }

  public attachEvidence(request: AttachEvidenceRequest): Intake {
    const current = this.#prepare(request, "intake.create");
    if (current.status !== "DRAFT") {
      throw new Error("STATE_TRANSITION_INVALID");
    }
    if (
      request.evidenceReference.trim().length === 0 ||
      request.fingerprint.trim().length === 0 ||
      request.retentionClass.trim().length === 0
    ) {
      throw new Error("PROVENANCE_REQUIRED");
    }
    const attachment: RawAttachmentReference = {
      id: this.#idFactory(),
      evidenceReference: request.evidenceReference,
      fingerprint: request.fingerprint,
      classification: request.classification,
      retentionClass: request.retentionClass,
      status: request.safetyState,
    };
    const updated = this.#replace({
      ...current,
      version: current.version + 1,
      classification: classifyCombinedData([current.classification, request.classification]),
      attachmentReferences: [...current.attachmentReferences, attachment],
    });
    this.#record("RAW_ATTACHMENT_LINKED", "intake.attach-evidence", updated, request.actor, request);
    return updated;
  }

  public read(intakeId: string): Intake {
    const intake = this.#intakes.get(intakeId);
    if (intake === undefined) {
      throw new Error("INTAKE_NOT_FOUND");
    }
    return intake;
  }

  public readForActor(request: Omit<IntakeCommand, "expectedVersion">): Intake {
    const current = this.read(request.intakeId);
    const decision = this.#authorizationService.evaluate({
      session: request.actor,
      action: "intake.read",
      resource: {
        type: "Intake",
        id: current.id,
        version: current.version,
        ...(request.actor.teamId === undefined ? {} : { teamId: request.actor.teamId }),
      },
      purpose: current.purpose,
      ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
      correlationId: request.correlationId,
    });
    if (decision.effect === "DENY") throw new Error(decision.reasonCode);
    return current;
  }

  public validate(request: ValidateIntakeRequest): Intake {
    const current = this.#prepare(request, "intake.validate");
    if (current.status !== "DRAFT") {
      throw new Error("STATE_TRANSITION_INVALID");
    }
    const status: IntakeStatus = request.safetyState === "UNSAFE" ||
      current.attachmentReferences.some((attachment) => attachment.status === "QUARANTINED")
      ? "QUARANTINED"
      : request.metadataComplete
        ? "VALIDATED"
        : "VALIDATION_FAILED";
    const updated = this.#replace({ ...current, status, version: current.version + 1 });
    this.#record("INTAKE_VALIDATED", "intake.validate", updated, request.actor, request);
    return updated;
  }

  public requestAi(request: RequestAiRequest): Intake {
    const current = this.#prepare(request, "intake.request-ai");
    if (current.status !== "VALIDATED") {
      throw new Error("STATE_TRANSITION_INVALID");
    }
    const job = this.#jobService.submit({
      actor: request.actor,
      jobType: "AI_LISTING_PARSE",
      inputReferences: [{
        type: "RawSource",
        id: current.rawSourceId,
        version: current.rawSourceVersion,
        checksum: current.rawSourceFingerprint,
      }],
      purpose: current.purpose,
      privacyClassification: current.classification,
      deadline: request.deadline,
      idempotencyKey: request.idempotencyKey,
      reason: "Validate intake with advisory listing extraction",
      ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
      correlationId: request.correlationId,
      causationId: current.id,
    });
    const updated = this.#replace({
      ...current,
      status: "AI_REQUESTED",
      version: current.version + 1,
      jobId: job.id,
    });
    this.#record("INTAKE_AI_REQUESTED", "intake.request-ai", updated, request.actor, request, "ACCEPTED");
    return updated;
  }

  public routeJobOutcome(request: RouteJobOutcomeRequest): Intake {
    const current = this.#prepare(request, "intake.validate");
    if (current.status !== "AI_REQUESTED" || current.jobId === undefined) {
      throw new Error("STATE_TRANSITION_INVALID");
    }
    const job = this.#jobService.read(current.jobId);
    if (job.status === "SUCCEEDED") {
      if (job.resultReference === undefined || request.validationDecision === undefined) {
        throw new Error("JOB_RESULT_INVALID");
      }
      const fallbackReason = request.validationDecision.status === "REJECTED"
        ? request.validationDecision.reasonCode ?? "AI_RESULT_SCHEMA_INVALID"
        : undefined;
      const updated = this.#replace({
        ...current,
        status: "REVIEW_REQUIRED",
        version: current.version + 1,
        aiResultReference: job.resultReference,
        ...(fallbackReason === undefined ? {} : { fallbackReason }),
      });
      this.#record(
        fallbackReason === undefined ? "INTAKE_AI_RESULT_ROUTED" : "INTAKE_MANUAL_FALLBACK",
        "intake.validate",
        updated,
        request.actor,
        request,
      );
      return updated;
    }
    if (job.status !== "FAILED" && job.status !== "EXPIRED" && job.status !== "CANCELLED") {
      throw new Error("JOB_OUTCOME_NOT_READY");
    }
    const fallbackReason = job.failureCode ?? job.status;
    const updated = this.#replace({
      ...current,
      status: "REVIEW_REQUIRED",
      version: current.version + 1,
      fallbackReason,
    });
    this.#record("INTAKE_MANUAL_FALLBACK", "intake.validate", updated, request.actor, request);
    return updated;
  }

  public review(request: ReviewIntakeRequest): Intake {
    const current = this.#prepare(request, "intake.review");
    if (!["VALIDATED", "REVIEW_REQUIRED"].includes(current.status)) {
      throw new Error("STATE_TRANSITION_INVALID");
    }
    if (request.reason.trim().length === 0) {
      throw new Error("REASON_REQUIRED");
    }
    const candidateReference = request.decision === "REGISTER_CANDIDATE"
      ? this.#candidateDraftPort.register({
          intakeId: current.id,
          intakeVersion: current.version,
          rawSourceId: current.rawSourceId,
          rawSourceVersion: current.rawSourceVersion,
          reviewedBy: request.actor.principalId,
          reason: request.reason,
          correlationId: request.correlationId,
          ...(current.aiResultReference === undefined
            ? {}
            : { aiResultReference: current.aiResultReference }),
        })
      : undefined;
    const updated = this.#replace({
      ...current,
      status: request.decision === "REGISTER_CANDIDATE" ? "REGISTERED" : "REJECTED",
      version: current.version + 1,
      ...(candidateReference === undefined ? {} : { candidateReference }),
    });
    this.#record("INTAKE_REVIEWED", "intake.review", updated, request.actor, request);
    return updated;
  }

  #prepare(request: IntakeCommand, action: string): Intake {
    const current = this.read(request.intakeId);
    if (current.version !== request.expectedVersion) {
      throw new Error("VERSION_CONFLICT");
    }
    const decision = this.#authorizationService.evaluate({
      session: request.actor,
      action,
      resource: {
        type: "Intake",
        id: current.id,
        version: current.version,
        ...(request.actor.teamId === undefined ? {} : { teamId: request.actor.teamId }),
        createdBy: current.createdBy,
      },
      purpose: current.purpose,
      ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
      correlationId: request.correlationId,
    });
    if (decision.effect === "DENY") {
      throw new Error(decision.reasonCode);
    }
    return current;
  }

  #replace(intake: Intake): Intake {
    const snapshot = immutableIntake(intake);
    this.#intakes.set(snapshot.id, snapshot);
    return snapshot;
  }

  #record(
    eventType: string,
    action: string,
    intake: Intake,
    actor: SessionContext,
    context: { readonly requestId?: string; readonly correlationId: string },
    outcome: "ACCEPTED" | "COMPLETED" = "COMPLETED",
  ): void {
    this.#auditSink.append({
      eventType,
      principal: principal(actor),
      action,
      target: { type: "Intake", id: intake.id, version: intake.version },
      purpose: intake.purpose,
      policyVersion: this.#policyVersion,
      classification: intake.classification,
      decision: "ALLOW",
      outcome,
      ...(context.requestId === undefined ? {} : { requestId: context.requestId }),
      correlationId: context.correlationId,
      details: {
        status: intake.status,
        rawSourceId: intake.rawSourceId,
        rawSourceVersion: intake.rawSourceVersion,
        inputFingerprint: intake.rawSourceFingerprint,
        ...(intake.jobId === undefined ? {} : { jobId: intake.jobId }),
        ...(intake.aiResultReference === undefined ? {} : { aiResultId: intake.aiResultReference }),
        ...(intake.candidateReference === undefined
          ? {}
          : { candidateId: intake.candidateReference.id, candidateVersion: intake.candidateReference.version }),
      },
    });
  }
}
