export type PublicationPersistenceErrorCode =
  | "PUBLICATION_ALREADY_EXISTS"
  | "PUBLICATION_NOT_FOUND"
  | "PUBLICATION_VERSION_CONFLICT"
  | "PUBLICATION_REVISION_INVALID"
  | "PERSISTENCE_SCOPE_VIOLATION"
  | "IDEMPOTENCY_CONFLICT"
  | "AUDIT_RECORD_DUPLICATE"
  | "AUDIT_RECORD_INVALID"
  | "TRANSACTION_ALREADY_ACTIVE"
  | "TRANSACTION_ALREADY_COMPLETED";

export class PublicationPersistenceError extends Error {
  public readonly code: PublicationPersistenceErrorCode;

  public constructor(code: PublicationPersistenceErrorCode, message: string) {
    super(message);
    this.name = "PublicationPersistenceError";
    this.code = code;
  }
}

export function persistenceError(code: PublicationPersistenceErrorCode, message: string): PublicationPersistenceError {
  return new PublicationPersistenceError(code, message);
}
