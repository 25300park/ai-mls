import type {
  AdvisoryApplicationExecutionInput,
  AdvisoryApplicationResult,
  Ai001ListingParseApplicationPort,
  Ai004RequirementParseApplicationPort,
  Ai005MatchingApplicationPort,
} from "../../ai/src/advisory-application-services.js";
import type { BoundedJobHandler, CanonicalJobHandlerId, JobExecutionContext, JobExecutionFailureMapper } from "./job-execution-runtime.js";
import type { DurableJobType, NormalizedJobFailure } from "./job-durable-persistence.js";

type CapabilityApplicationPort = Readonly<{ execute(input: AdvisoryApplicationExecutionInput): AdvisoryApplicationResult }>;

export class Ai001ListingParseJobHandler implements BoundedJobHandler {
  public readonly handlerId = "AI-001" as const;
  readonly #delegate: AdvisoryJobHandlerDelegate;
  public constructor(port: Ai001ListingParseApplicationPort) { this.#delegate = new AdvisoryJobHandlerDelegate("AI_LISTING_PARSE", this.handlerId, port); }
  public execute(context: JobExecutionContext): ReturnType<BoundedJobHandler["execute"]> { return this.#delegate.execute(context); }
}

export class Ai004RequirementParseJobHandler implements BoundedJobHandler {
  public readonly handlerId = "AI-004" as const;
  readonly #delegate: AdvisoryJobHandlerDelegate;
  public constructor(port: Ai004RequirementParseApplicationPort) { this.#delegate = new AdvisoryJobHandlerDelegate("AI_REQUIREMENT_PARSE", this.handlerId, port); }
  public execute(context: JobExecutionContext): ReturnType<BoundedJobHandler["execute"]> { return this.#delegate.execute(context); }
}

export class Ai005MatchingJobHandler implements BoundedJobHandler {
  public readonly handlerId = "AI-005" as const;
  readonly #delegate: AdvisoryJobHandlerDelegate;
  public constructor(port: Ai005MatchingApplicationPort) { this.#delegate = new AdvisoryJobHandlerDelegate("AI_MATCHING", this.handlerId, port); }
  public execute(context: JobExecutionContext): ReturnType<BoundedJobHandler["execute"]> { return this.#delegate.execute(context); }
}

class AdvisoryJobHandlerDelegate {
  public constructor(
    private readonly jobType: DurableJobType,
    private readonly handlerId: CanonicalJobHandlerId,
    private readonly port: CapabilityApplicationPort,
  ) {}

  public execute(context: JobExecutionContext): ReturnType<BoundedJobHandler["execute"]> {
    if (context.jobType !== this.jobType || context.inputReferences.length !== 1) throw new Error("JOB_RESULT_INVALID");
    const reference = context.inputReferences[0];
    const principalEvidenceRef = context.initiatingPrincipalProvenance.kind === "IMMUTABLE_REFERENCE"
      ? context.initiatingPrincipalProvenance.evidenceRef
      : context.originatingAuthorityEvidenceRefs[0];
    if (reference === undefined || !nonempty(principalEvidenceRef)) throw new Error("JOB_RESULT_INVALID");
    const accepted = this.port.execute(Object.freeze({
      tenantId: context.tenantId,
      scopeRef: context.scopeRef,
      inputReference: Object.freeze({ entityType: reference.type, entityId: reference.id, version: String(reference.version) }),
      correlationId: context.correlationId,
      idempotencyKey: `job:${context.jobId}:attempt:${String(context.attempt)}:${this.handlerId}`,
      initiatingPrincipalEvidenceRef: principalEvidenceRef,
      initiatingPrincipalProvenance: context.initiatingPrincipalProvenance,
    }));
    if (accepted.capabilityId !== this.handlerId || accepted.authority !== "ADVISORY" || accepted.reviewRequired !== true) throw new Error("JOB_RESULT_INVALID");
    return Object.freeze({ resultReference: accepted.resultReference, resultChecksum: accepted.resultChecksum, evidenceRefs: Object.freeze([...accepted.evidenceRefs]) });
  }
}

export class AdvisoryJobFailureMapper implements JobExecutionFailureMapper {
  public map(error: unknown, context: JobExecutionContext): NormalizedJobFailure {
    void context;
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : error instanceof Error ? error.message : "";
    return code === "ADVISORY_UNAVAILABLE" || code === "PROMPT_NOT_ACTIVE" || code === "ADVISORY_RUNTIME_NOT_READY"
      ? Object.freeze({ code: "DEPENDENCY_UNAVAILABLE" as const, evidenceRef: "job-failure:advisory-unavailable" })
      : Object.freeze({ code: "JOB_RESULT_INVALID" as const, evidenceRef: "job-failure:advisory-result-invalid" });
  }
}

function nonempty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
