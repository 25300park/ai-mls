import type {
  AuthorizationDecision,
  AuthorizationResource,
  WorkloadAuthorizationRequest,
  WorkloadAuthorizationSubject,
} from "../../../modules/authorization/src/index.js";
import type { ProductionServiceIdentityBinding, ProductionServiceIdentityResolver } from "./production-service-identity-resolver.js";

export interface WorkloadAuthorizationEvaluator {
  evaluateWorkload(request: WorkloadAuthorizationRequest): AuthorizationDecision;
}

export interface ProductionWorkloadAuthorizationRequest {
  readonly identity: ProductionServiceIdentityBinding;
  readonly action: string;
  readonly resource: AuthorizationResource;
  readonly purpose: string;
  readonly reason?: string;
  readonly requestId?: string;
  readonly correlationId: string;
}

export class ProductionWorkloadAuthorizationAdapter {
  public constructor(
    private readonly identityResolver: ProductionServiceIdentityResolver,
    private readonly authorization: WorkloadAuthorizationEvaluator,
  ) {}

  public evaluate(request: ProductionWorkloadAuthorizationRequest): AuthorizationDecision {
    try {
      this.identityResolver.assertStillActive(request.identity);
      return this.authorization.evaluateWorkload({
        subject: subject(request.identity), action: request.action, resource: request.resource,
        purpose: request.purpose, ...(request.reason === undefined ? {} : { reason: request.reason }),
        ...(request.requestId === undefined ? {} : { requestId: request.requestId }), correlationId: request.correlationId,
      });
    } catch {
      throw new Error("Production workload authorization is unavailable.");
    }
  }
}

function subject(binding: ProductionServiceIdentityBinding): WorkloadAuthorizationSubject {
  return Object.freeze({
    registrationId: binding.registrationId, registrationVersion: binding.registrationVersion,
    tenantId: binding.tenantId, principalId: binding.principalId, principalType: "SERVICE", assurance: "WORKLOAD",
    identityEvidenceRef: binding.identityEvidenceRef, auditEvidenceRef: binding.auditEvidenceRef,
  });
}
