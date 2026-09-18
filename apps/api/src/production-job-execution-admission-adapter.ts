import type { JobExecutionAdmissionContext, JobExecutionAdmissionPort } from "../../../modules/jobs/src/job-execution-runtime.js";
import type { ProductionServiceIdentityBinding } from "./production-service-identity-resolver.js";
import type { ProductionWorkloadAuthorizationAdapter } from "./production-workload-authorization-adapter.js";

export class ProductionJobExecutionAdmissionAdapter implements JobExecutionAdmissionPort {
  public constructor(
    private readonly identity: ProductionServiceIdentityBinding,
    private readonly authorization: ProductionWorkloadAuthorizationAdapter,
  ) {}

  public evaluate(context: JobExecutionAdmissionContext): ReturnType<JobExecutionAdmissionPort["evaluate"]> {
    if (context.tenantId !== this.identity.tenantId) return Object.freeze({ status: "BLOCKED" as const });
    const decision = this.authorization.evaluate({
      identity: this.identity,
      action: "job.execute",
      resource: Object.freeze({ type: "Job", id: context.jobId, tenantId: context.tenantId }),
      purpose: context.purpose,
      correlationId: context.correlationId,
    });
    if (decision.effect !== "ALLOW") return Object.freeze({ status: "BLOCKED" as const });
    return Object.freeze({
      status: "ALLOWED" as const,
      evidenceRefs: Object.freeze([this.identity.identityEvidenceRef, this.identity.auditEvidenceRef]),
    });
  }
}
