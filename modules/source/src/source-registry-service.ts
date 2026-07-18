import type {
  AuditPrincipal,
  AuditSink,
  Clock,
  DataClassification,
  IdFactory,
} from "../../../packages/security-contracts/src/index.js";
import type { AuthorizationService } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";

export type SourcePolicyStatus =
  | "DRAFT"
  | "UNDER_REVIEW"
  | "ACTIVE"
  | "PAUSED"
  | "BLOCKED"
  | "RETIRED";

export interface SourcePolicy {
  readonly id: string;
  readonly name: string;
  readonly sourceType: string;
  readonly status: SourcePolicyStatus;
  readonly policyVersion: number;
  readonly allowedMethods: readonly string[];
  readonly allowedPurposes: readonly string[];
  readonly classification: DataClassification;
  readonly proposedBy: string;
  readonly reviewedAt?: string;
}

interface SourceRegistryDependencies {
  readonly initialSources: readonly SourcePolicy[];
  readonly authorizationService: AuthorizationService;
  readonly auditSink: AuditSink;
  readonly clock: Clock;
  readonly idFactory: IdFactory;
  readonly policyVersion: string;
}

interface ReadSourceRequest {
  readonly actor: SessionContext;
  readonly sourceId: string;
  readonly purpose: string;
  readonly requestId?: string;
  readonly correlationId: string;
}

interface ProposeSourceRequest {
  readonly actor: SessionContext;
  readonly name: string;
  readonly sourceType: string;
  readonly allowedMethods: readonly string[];
  readonly allowedPurposes: readonly string[];
  readonly classification: DataClassification;
  readonly reason: string;
  readonly requestId?: string;
  readonly correlationId: string;
}

interface CapturePolicyRequest extends ReadSourceRequest {
  readonly sourcePolicyVersion: number;
  readonly method: string;
}

function immutablePolicy(policy: SourcePolicy): SourcePolicy {
  const snapshot = structuredClone(policy);
  Object.freeze(snapshot.allowedMethods);
  Object.freeze(snapshot.allowedPurposes);
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

export class SourceRegistryService {
  readonly #authorizationService: AuthorizationService;
  readonly #auditSink: AuditSink;
  readonly #clock: Clock;
  readonly #idFactory: IdFactory;
  readonly #policyVersion: string;
  readonly #sources = new Map<string, SourcePolicy>();

  public constructor(dependencies: SourceRegistryDependencies) {
    this.#authorizationService = dependencies.authorizationService;
    this.#auditSink = dependencies.auditSink;
    this.#clock = dependencies.clock;
    this.#idFactory = dependencies.idFactory;
    this.#policyVersion = dependencies.policyVersion;
    for (const source of dependencies.initialSources) {
      this.#sources.set(source.id, immutablePolicy(source));
    }
  }

  public list(request: Omit<ReadSourceRequest, "sourceId">): readonly SourcePolicy[] {
    this.#authorize(request.actor, "source.read", "collection", request);
    return Object.freeze([...this.#sources.values()]);
  }

  public read(request: ReadSourceRequest): SourcePolicy {
    this.#authorize(request.actor, "source.read", request.sourceId, request);
    return this.#requireSource(request.sourceId);
  }

  public propose(request: ProposeSourceRequest): SourcePolicy {
    if (
      request.name.trim().length === 0 ||
      request.sourceType.trim().length === 0 ||
      request.allowedMethods.length === 0 ||
      request.allowedPurposes.length === 0
    ) {
      throw new Error("SOURCE_PROPOSAL_INVALID");
    }
    if (request.reason.trim().length === 0) {
      throw new Error("SOURCE_REASON_REQUIRED");
    }
    const sourceId = this.#idFactory();
    this.#authorize(request.actor, "source.propose", sourceId, {
      purpose: "SOURCE_GOVERNANCE",
      ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
      correlationId: request.correlationId,
    });
    const proposed = immutablePolicy({
      id: sourceId,
      name: request.name,
      sourceType: request.sourceType,
      status: "DRAFT",
      policyVersion: 1,
      allowedMethods: request.allowedMethods,
      allowedPurposes: request.allowedPurposes,
      classification: request.classification,
      proposedBy: request.actor.principalId,
    });
    this.#sources.set(proposed.id, proposed);
    this.#auditSink.append({
      eventType: "SOURCE_POLICY_PROPOSED",
      principal: principal(request.actor),
      action: "source.propose",
      target: { type: "SourceRegistry", id: proposed.id, version: proposed.policyVersion },
      purpose: "SOURCE_GOVERNANCE",
      policyVersion: this.#policyVersion,
      classification: "CONFIDENTIAL_BUSINESS",
      decision: "ALLOW",
      outcome: "ACCEPTED",
      reason: request.reason,
      ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
      correlationId: request.correlationId,
      details: { sourceType: proposed.sourceType, status: proposed.status },
    });
    return proposed;
  }

  public requireCapturePolicy(request: CapturePolicyRequest): SourcePolicy {
    this.#authorize(request.actor, "source.read", request.sourceId, request);
    this.#authorize(request.actor, "intake.create", request.sourceId, {
      ...request,
      purpose: request.purpose,
    }, "RawSource");
    const policy = this.#requireSource(request.sourceId);
    if (policy.status !== "ACTIVE") {
      throw new Error("SOURCE_NOT_ALLOWED");
    }
    if (policy.policyVersion !== request.sourcePolicyVersion) {
      throw new Error("SOURCE_POLICY_STALE");
    }
    if (
      !policy.allowedMethods.includes(request.method) ||
      !policy.allowedPurposes.includes(request.purpose)
    ) {
      throw new Error("SOURCE_NOT_ALLOWED");
    }
    return policy;
  }

  #authorize(
    actor: SessionContext,
    action: string,
    resourceId: string,
    context: Pick<ReadSourceRequest, "purpose" | "requestId" | "correlationId">,
    resourceType = "SourceRegistry",
  ): void {
    const decision = this.#authorizationService.evaluate({
      session: actor,
      action,
      resource: {
        type: resourceType,
        id: resourceId,
        ...(actor.teamId === undefined ? {} : { teamId: actor.teamId }),
      },
      purpose: context.purpose,
      ...(context.requestId === undefined ? {} : { requestId: context.requestId }),
      correlationId: context.correlationId,
    });
    if (decision.effect === "DENY") {
      throw new Error(decision.reasonCode);
    }
  }

  #requireSource(sourceId: string): SourcePolicy {
    const source = this.#sources.get(sourceId);
    if (source === undefined) {
      throw new Error("SOURCE_NOT_FOUND");
    }
    return source;
  }
}
