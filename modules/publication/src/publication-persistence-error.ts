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
  | "TRANSACTION_ALREADY_COMPLETED"
  | "PERSISTENCE_INPUT_INVALID"
  | "PERSISTENCE_WRITE_FAILED"
  | "EXECUTION_INTENT_NOT_FOUND"
  | "EXECUTION_DISPATCH_NOT_STARTED"
  | "EXECUTION_RECEIPT_CONFLICT"
  | "EXECUTION_RECEIPT_INVALID"
  | "EXECUTION_EVIDENCE_INVALID";

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
