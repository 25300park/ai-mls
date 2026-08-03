import type {
  CorrectPublicationRequest,
  PublicationApplicationResult,
  PublicationLifecycleCoordinationRequest,
  PublicationLifecyclePort,
  RepublishPublicationRequest,
  RequestWithdrawalLifecycleRequest,
  ResolveWithdrawalLifecycleRequest,
  ResumePublicationRequest,
  SupersedePublicationRequest,
  SuspendPublicationRequest,
  TerminatePublicationRequest,
} from "./publication-application-contracts.js";
import type { PublicationApplicationService } from "./publication-application-service.js";
import type { PublicationEffectiveApprovalPort } from "./publication-service.js";
import { requireEffectivePublicationApproval } from "./publication-service.js";

export interface PublicationLifecycleDependencies {
  readonly application: PublicationApplicationService;
  readonly effectiveApproval: PublicationEffectiveApprovalPort;
}

export class PublicationLifecycleService implements PublicationLifecyclePort {
  public constructor(private readonly dependencies: PublicationLifecycleDependencies) {}

  public correctPublication(request: CorrectPublicationRequest): PublicationApplicationResult {
    return this.executeCommand(request);
  }

  public republishPublication(request: RepublishPublicationRequest): PublicationApplicationResult {
    return this.executeCommand(request);
  }

  public requestWithdrawal(request: RequestWithdrawalLifecycleRequest): PublicationApplicationResult {
    return this.executeCommand(request);
  }

  public resolveWithdrawal(request: ResolveWithdrawalLifecycleRequest): PublicationApplicationResult {
    return this.executeCommand(request);
  }

  public suspendPublication(request: SuspendPublicationRequest): PublicationApplicationResult {
    return this.executeCommand(request);
  }

  public resumePublication(request: ResumePublicationRequest): PublicationApplicationResult {
    return this.executeCommand(request);
  }

  public supersedePublication(request: SupersedePublicationRequest): PublicationApplicationResult {
    return this.executeCommand(request);
  }

  public terminatePublication(request: TerminatePublicationRequest): PublicationApplicationResult {
    return this.executeCommand(request);
  }

  public execute(request: PublicationLifecycleCoordinationRequest): PublicationApplicationResult {
    switch (request.action) {
      case "CORRECT": return this.correctPublication(request);
      case "REPUBLISH": return this.republishPublication(request);
      case "REQUEST_WITHDRAWAL": return this.requestWithdrawal(request);
      case "RESOLVE_WITHDRAWAL": return this.resolveWithdrawal(request);
      case "SUSPEND": return this.suspendPublication(request);
      case "RESUME": return this.resumePublication(request);
      case "SUPERSEDE": return this.supersedePublication(request);
      case "TERMINATE": return this.terminatePublication(request);
    }
  }

  private executeCommand(request: CorrectPublicationRequest | RepublishPublicationRequest | RequestWithdrawalLifecycleRequest
    | ResolveWithdrawalLifecycleRequest | SuspendPublicationRequest | ResumePublicationRequest
    | SupersedePublicationRequest | TerminatePublicationRequest): PublicationApplicationResult {
    return this.dependencies.application.executeAuthorized({
      kind: "MODIFY_PUBLICATION",
      identity: request.identity,
      input: request.input,
    }, request.context, (authorization) => {
      requireEffectivePublicationApproval(
        this.dependencies.effectiveApproval,
        request.identity,
        request.context,
        authorization.actorId,
        authorization.binding,
      );
    });
  }
}
