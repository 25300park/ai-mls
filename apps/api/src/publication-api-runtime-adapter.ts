import type { PublicationCanonicalApiExecutionPort } from "../../../modules/publication/src/publication-runtime-canonical-api-port.js";
import {
  PUBLICATION_API_COMMAND_OPERATIONS,
  PUBLICATION_API_QUERY_OPERATIONS,
  type PublicationCommandRequest,
  type PublicationCommandResponse,
  type PublicationQueryRequest,
  type PublicationQueryResponse,
} from "./publication-api-contracts.js";
import { PublicationApiError } from "./publication-api-error-mapper.js";

export interface PublicationApiExecutionBoundary {
  executeCommand(request: PublicationCommandRequest): Promise<PublicationCommandResponse>;
  executeQuery(request: PublicationQueryRequest): Promise<PublicationQueryResponse>;
}

export type PublicationApiRuntimeRequest =
  | Readonly<{ readonly kind: "COMMAND"; readonly request: PublicationCommandRequest }>
  | Readonly<{ readonly kind: "QUERY"; readonly request: PublicationQueryRequest }>;

const operations = Object.freeze([
  ...PUBLICATION_API_COMMAND_OPERATIONS,
  ...PUBLICATION_API_QUERY_OPERATIONS,
]);

export class PublicationApiRuntimeAdapter implements PublicationCanonicalApiExecutionPort {
  public readonly operations = operations;

  public constructor(private readonly api: PublicationApiExecutionBoundary) {
    Object.freeze(this);
  }

  public async execute(input: unknown): Promise<PublicationCommandResponse | PublicationQueryResponse> {
    if (!isRecord(input) || !hasExactKeys(input, ["kind", "request"]) || !isRecord(input["request"])) {
      throw new PublicationApiError("VALIDATION_ERROR");
    }
    const request = input["request"];
    const operation = request["operation"];
    if (input["kind"] === "COMMAND"
      && typeof operation === "string"
      && PUBLICATION_API_COMMAND_OPERATIONS.includes(operation as never)) {
      return await this.api.executeCommand(request as unknown as PublicationCommandRequest);
    }
    if (input["kind"] === "QUERY"
      && typeof operation === "string"
      && PUBLICATION_API_QUERY_OPERATIONS.includes(operation as never)) {
      return await this.api.executeQuery(request as unknown as PublicationQueryRequest);
    }
    throw new PublicationApiError("VALIDATION_ERROR");
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
