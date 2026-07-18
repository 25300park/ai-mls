import type {
  AuthorizationRequest,
  AuthorizationResource,
  AuthorizationService,
} from "../../../modules/authorization/src/authorization-service.js";
import type {
  AuthenticationEvidence,
  SessionService,
} from "../../../modules/identity/src/session-service.js";
import {
  executeBoundary,
  requireSessionId,
  type ApiResponse,
  type RequestContext,
} from "./contracts.js";

interface IdentityApiDependencies {
  readonly sessionService: SessionService;
  readonly authorizationService: AuthorizationService;
}

interface CreateSessionInput {
  readonly context: RequestContext;
  readonly evidence: AuthenticationEvidence;
}

interface EvaluateAuthorizationInput {
  readonly context: RequestContext;
  readonly action: string;
  readonly resource: AuthorizationResource;
  readonly purpose: string;
  readonly reason?: string;
}

export class IdentityApi {
  public constructor(private readonly dependencies: IdentityApiDependencies) {}

  public createSession(
    input: CreateSessionInput,
  ): ApiResponse<ReturnType<SessionService["createSession"]>> {
    return executeBoundary(input.context, () =>
      this.dependencies.sessionService.createSession({
        evidence: input.evidence,
        ...(input.context.requestId === undefined
          ? {}
          : { requestId: input.context.requestId }),
        correlationId: input.context.correlationId,
      }),
    );
  }

  public evaluateAuthorization(
    input: EvaluateAuthorizationInput,
  ): ApiResponse<ReturnType<AuthorizationService["evaluate"]>> {
    return executeBoundary(input.context, () => {
      const session = this.dependencies.sessionService.readSession(
        requireSessionId(input.context),
      );
      const request: AuthorizationRequest = {
        session,
        action: input.action,
        resource: input.resource,
        purpose: input.purpose,
        ...(input.reason === undefined ? {} : { reason: input.reason }),
        ...(input.context.requestId === undefined
          ? {}
          : { requestId: input.context.requestId }),
        correlationId: input.context.correlationId,
      };
      return this.dependencies.authorizationService.evaluate(request);
    });
  }
}
