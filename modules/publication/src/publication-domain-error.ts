export type PublicationDomainErrorCode =
  | "PUBLICATION_INPUT_INVALID"
  | "PUBLICATION_IDENTITY_INVALID"
  | "PUBLICATION_BINDING_INVALID"
  | "PUBLICATION_STATE_INVALID"
  | "PUBLICATION_TRANSITION_INVALID"
  | "PUBLICATION_VERSION_CONFLICT"
  | "PUBLICATION_DUPLICATE_ENTITY"
  | "PUBLICATION_INVARIANT_VIOLATION"
  | "PUBLICATION_MATERIAL_CHANGE_REQUIRES_SUCCESSOR";

export type PublicationDomainErrorCategory = "VALIDATION" | "CONFLICT" | "INVARIANT";

export class PublicationDomainError extends Error {
  public readonly code: PublicationDomainErrorCode;
  public readonly category: PublicationDomainErrorCategory;
  public readonly context: Readonly<Record<string, string | number | boolean>>;

  public constructor(input: {
    readonly code: PublicationDomainErrorCode;
    readonly category: PublicationDomainErrorCategory;
    readonly message: string;
    readonly context?: Readonly<Record<string, string | number | boolean>>;
    readonly cause?: unknown;
  }) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = "PublicationDomainError";
    this.code = input.code;
    this.category = input.category;
    this.context = Object.freeze({ ...(input.context ?? {}) });
    Object.freeze(this);
  }
}

export function domainError(
  code: PublicationDomainErrorCode,
  category: PublicationDomainErrorCategory,
  message: string,
  context?: Readonly<Record<string, string | number | boolean>>,
): PublicationDomainError {
  return new PublicationDomainError({ code, category, message, ...(context === undefined ? {} : { context }) });
}
