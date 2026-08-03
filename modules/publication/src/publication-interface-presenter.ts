import type { PublicationApplicationResult } from "./publication-application-contracts.js";
import {
  immutableInterfaceValue,
  type PublicationInterfaceFailureResponse,
  type PublicationInterfaceResponse,
} from "./publication-interface-models.js";

export interface PublicationOutputPort {
  present(result: PublicationApplicationResult): PublicationInterfaceResponse;
  presentInterfaceFailure(failureCode: string): PublicationInterfaceFailureResponse;
}

export class DeterministicPublicationPresenter implements PublicationOutputPort {
  public present(result: PublicationApplicationResult): PublicationInterfaceResponse {
    return result.ok
      ? immutableInterfaceValue({
        operationResult: "SUCCEEDED" as const,
        publicationId: result.publicationId,
        version: result.aggregateVersion,
        replayed: result.replayed,
      })
      : this.presentInterfaceFailure(result.error.code);
  }

  public presentInterfaceFailure(failureCode: string): PublicationInterfaceFailureResponse {
    const exposedCode = exposedFailureCodes.has(failureCode) ? failureCode : "INTERFACE_EXECUTION_FAILED";
    return immutableInterfaceValue({ operationResult: "FAILED" as const, failureCode: exposedCode });
  }
}

const exposedFailureCodes = new Set([
  "AUTHENTICATION_REQUIRED",
  "AUTHORIZATION_DENIED",
  "PURPOSE_SCOPE_DENIED",
  "MFA_REQUIRED",
  "REASON_REQUIRED",
  "SEPARATION_OF_DUTIES_DENIED",
  "APPROVAL_NOT_EFFECTIVE",
  "VERIFICATION_NOT_EFFECTIVE",
  "PERMISSION_NOT_EFFECTIVE",
  "BINDING_MISMATCH",
  "POLICY_VERSION_STALE",
  "INTERFACE_REQUEST_INVALID",
  "INTERFACE_EXECUTION_FAILED",
  "APPLICATION_CONTEXT_INVALID",
  "APPLICATION_RESULT_REFERENCE_INVALID",
  "APPLICATION_COMMIT_FAILED",
  "APPLICATION_EXECUTION_FAILED",
  "PUBLICATION_INPUT_INVALID",
  "PUBLICATION_IDENTITY_INVALID",
  "PUBLICATION_BINDING_INVALID",
  "PUBLICATION_STATE_INVALID",
  "PUBLICATION_TRANSITION_INVALID",
  "PUBLICATION_VERSION_CONFLICT",
  "PUBLICATION_DUPLICATE_ENTITY",
  "PUBLICATION_INVARIANT_VIOLATION",
  "PUBLICATION_MATERIAL_CHANGE_REQUIRES_SUCCESSOR",
  "PUBLICATION_ALREADY_EXISTS",
  "PUBLICATION_NOT_FOUND",
  "IDEMPOTENCY_CONFLICT",
  "RECOVERY_REQUEST_INVALID",
]);
