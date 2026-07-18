import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import type { IntakeService } from "../../../modules/intake/src/intake-service.js";
import type { SourceRegistryService } from "../../../modules/source/src/source-registry-service.js";
import { executeBoundary, requireSessionId, type ApiResponse, type RequestContext } from "./contracts.js";

type SourcePort = Pick<SourceRegistryService, "list" | "read" | "propose">;
type IntakePort = Pick<IntakeService, "createDraft" | "attachEvidence" | "readForActor" | "validate" | "requestAi" | "review">;

export interface SourceIntakeApiDependencies {
  readonly sourceRegistryService: SourcePort;
  readonly intakeService: IntakePort;
  readonly sessionReader: (sessionId: string) => SessionContext;
}

type Contextual<T> = Omit<T, "actor" | "requestId" | "correlationId"> & { readonly context: RequestContext };
type ReadSourceInput = Contextual<Parameters<SourceRegistryService["read"]>[0]>;
type ListSourcesInput = Contextual<Parameters<SourceRegistryService["list"]>[0]>;
type ProposeSourceInput = Contextual<Parameters<SourceRegistryService["propose"]>[0]>;
type CreateIntakeInput = Contextual<Parameters<IntakeService["createDraft"]>[0]>;
type AttachEvidenceInput = Contextual<Parameters<IntakeService["attachEvidence"]>[0]>;
type ReadIntakeInput = Contextual<Parameters<IntakeService["readForActor"]>[0]>;
type ValidateIntakeInput = Contextual<Parameters<IntakeService["validate"]>[0]>;
type RequestAiInput = Contextual<Parameters<IntakeService["requestAi"]>[0]>;
type ReviewInput = Contextual<Parameters<IntakeService["review"]>[0]>;

export class SourceIntakeApi {
  public constructor(private readonly dependencies: SourceIntakeApiDependencies) {}

  public listSources(input: ListSourcesInput): ApiResponse<ReturnType<SourceRegistryService["list"]>> {
    return executeBoundary(input.context, () => this.dependencies.sourceRegistryService.list({
      actor: this.#actor(input.context), purpose: input.purpose,
      ...(input.context.requestId === undefined ? {} : { requestId: input.context.requestId }),
      correlationId: input.context.correlationId,
    }));
  }

  public readSource(input: ReadSourceInput): ApiResponse<ReturnType<SourceRegistryService["read"]>> {
    return executeBoundary(input.context, () => this.dependencies.sourceRegistryService.read({
      actor: this.#actor(input.context),
      sourceId: input.sourceId,
      purpose: input.purpose,
      ...(input.context.requestId === undefined ? {} : { requestId: input.context.requestId }),
      correlationId: input.context.correlationId,
    }));
  }

  public createIntake(input: CreateIntakeInput): ApiResponse<ReturnType<IntakeService["createDraft"]>> {
    return executeBoundary(input.context, () => this.dependencies.intakeService.createDraft({
      actor: this.#actor(input.context), sourceId: input.sourceId,
      sourcePolicyVersion: input.sourcePolicyVersion, method: input.method, purpose: input.purpose,
      evidenceReference: input.evidenceReference, observedAt: input.observedAt, capturedAt: input.capturedAt,
      fingerprint: input.fingerprint, language: input.language, classification: input.classification,
      retentionClass: input.retentionClass,
      ...(input.context.requestId === undefined ? {} : { requestId: input.context.requestId }),
      correlationId: input.context.correlationId,
    }));
  }

  public proposeSource(input: ProposeSourceInput): ApiResponse<ReturnType<SourceRegistryService["propose"]>> {
    return executeBoundary(input.context, () => this.dependencies.sourceRegistryService.propose({
      actor: this.#actor(input.context), name: input.name, sourceType: input.sourceType,
      allowedMethods: input.allowedMethods, allowedPurposes: input.allowedPurposes,
      classification: input.classification, reason: input.reason,
      ...(input.context.requestId === undefined ? {} : { requestId: input.context.requestId }),
      correlationId: input.context.correlationId,
    }));
  }

  public attachEvidence(input: AttachEvidenceInput): ApiResponse<ReturnType<IntakeService["attachEvidence"]>> {
    return executeBoundary(input.context, () => this.dependencies.intakeService.attachEvidence({
      actor: this.#actor(input.context), intakeId: input.intakeId, expectedVersion: input.expectedVersion,
      evidenceReference: input.evidenceReference, fingerprint: input.fingerprint,
      classification: input.classification, retentionClass: input.retentionClass,
      safetyState: input.safetyState,
      ...(input.context.requestId === undefined ? {} : { requestId: input.context.requestId }),
      correlationId: input.context.correlationId,
    }));
  }

  public readIntake(input: ReadIntakeInput): ApiResponse<ReturnType<IntakeService["readForActor"]>> {
    return executeBoundary(input.context, () => this.dependencies.intakeService.readForActor({
      actor: this.#actor(input.context), intakeId: input.intakeId,
      ...(input.context.requestId === undefined ? {} : { requestId: input.context.requestId }),
      correlationId: input.context.correlationId,
    }));
  }

  public validateIntake(input: ValidateIntakeInput): ApiResponse<ReturnType<IntakeService["validate"]>> {
    return executeBoundary(input.context, () => this.dependencies.intakeService.validate({
      actor: this.#actor(input.context), intakeId: input.intakeId, expectedVersion: input.expectedVersion,
      safetyState: input.safetyState, metadataComplete: input.metadataComplete,
      ...(input.context.requestId === undefined ? {} : { requestId: input.context.requestId }),
      correlationId: input.context.correlationId,
    }));
  }

  public requestAi(input: RequestAiInput): ApiResponse<ReturnType<IntakeService["requestAi"]>> {
    return executeBoundary(input.context, () => this.dependencies.intakeService.requestAi({
      actor: this.#actor(input.context), intakeId: input.intakeId, expectedVersion: input.expectedVersion,
      deadline: input.deadline, idempotencyKey: input.idempotencyKey,
      ...(input.context.requestId === undefined ? {} : { requestId: input.context.requestId }),
      correlationId: input.context.correlationId,
    }));
  }

  public review(input: ReviewInput): ApiResponse<ReturnType<IntakeService["review"]>> {
    return executeBoundary(input.context, () => this.dependencies.intakeService.review({
      actor: this.#actor(input.context), intakeId: input.intakeId, expectedVersion: input.expectedVersion,
      decision: input.decision, reason: input.reason,
      ...(input.context.requestId === undefined ? {} : { requestId: input.context.requestId }),
      correlationId: input.context.correlationId,
    }));
  }

  #actor(context: RequestContext): SessionContext {
    return this.dependencies.sessionReader(requireSessionId(context));
  }
}
