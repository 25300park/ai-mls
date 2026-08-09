import { immutableDomain } from "./publication-contracts.js";
import { PublicationDomainError } from "./publication-domain-error.js";
import { PublicationPersistenceError } from "./publication-persistence-error.js";
import { PublicationAuthorizationError } from "./publication-authorization.js";
import type { PublicationApplicationErrorResult } from "./publication-application-contracts.js";
import { PublicationEventError, safePublicationEventErrorCode } from "./publication-event-error.js";

export class PublicationApplicationError extends Error {
  public constructor(
    public readonly code: string,
    public readonly category: PublicationApplicationErrorResult["error"]["category"],
    message: string,
  ) {
    super(message);
    this.name = "PublicationApplicationError";
  }
}

export function mapPublicationApplicationError(error: unknown, commitFailed = false): PublicationApplicationErrorResult {
  if (error instanceof PublicationAuthorizationError) {
    const category = error.code === "PUBLICATION_VERSION_CONFLICT" ? "CONFLICT" : "DOMAIN_REJECTION";
    return failure(error.code, category, error.message);
  }
  if (error instanceof PublicationApplicationError) return failure(error.code, error.category, error.message);
  if (error instanceof PublicationEventError) return failure(safePublicationEventErrorCode(error), "INFRASTRUCTURE", "Canonical Event evidence could not be committed.");
  if (error instanceof PublicationDomainError) {
    if (error.code === "PUBLICATION_VERSION_CONFLICT") return failure(error.code, "CONFLICT", "Publication version conflict.");
    return failure(error.code, error.category === "VALIDATION" ? "VALIDATION" : "DOMAIN_REJECTION", "Publication command was rejected.");
  }
  if (error instanceof PublicationPersistenceError) {
    if (error.code === "PUBLICATION_NOT_FOUND") return failure(error.code, "NOT_FOUND", "Publication was not found.");
    if (error.code === "PUBLICATION_VERSION_CONFLICT" || error.code === "PUBLICATION_ALREADY_EXISTS") {
      return failure(error.code, "CONFLICT", "Publication version conflict.");
    }
    if (error.code === "IDEMPOTENCY_CONFLICT") {
      return failure(error.code, "CONFLICT", "Idempotency key conflicts with an earlier command.");
    }
  }
  if (commitFailed) return failure("APPLICATION_COMMIT_FAILED", "INFRASTRUCTURE", "Publication command could not be committed.");
  return failure("APPLICATION_EXECUTION_FAILED", "INFRASTRUCTURE", "Publication command could not be completed.");
}

function failure(code: string, category: PublicationApplicationErrorResult["error"]["category"], message: string): PublicationApplicationErrorResult {
  return immutableDomain({ ok: false as const, error: { code, category, message } });
}
