import type { PublicationExecutableResult } from "./publication-executable-contracts.js";
import {
  createPublicationHttpResponse,
  type PublicationHttpResponse,
} from "./publication-http-contracts.js";
import type { PublicationHttpErrorMapper } from "./publication-http-error-mapper.js";

const statusByCategory = Object.freeze({
  SUCCESS: 200,
  VALIDATION: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  APPLICATION_REJECTION: 422,
  INTERNAL_ERROR: 500,
} as const);

export class PublicationHttpResponseMapper {
  public constructor(private readonly errors: PublicationHttpErrorMapper) {}

  public map(result: PublicationExecutableResult): PublicationHttpResponse {
    try {
      if (result.error !== null) {
        if (result.error.code === "EXECUTABLE_NOT_READY" || result.error.code === "EXECUTABLE_STOPPED") {
          return this.errors.map(result.executionId, "EXECUTABLE_UNAVAILABLE");
        }
        return this.errors.map(result.executionId, "REQUEST_EXECUTION_FAILED");
      }
      const presentation = inspectPresentation(result.result, result.executionId, result.success);
      return createPublicationHttpResponse({
        statusCode: statusByCategory[presentation.category],
        headers: { "content-type": "application/json" },
        body: presentation.value,
        requestId: result.executionId,
      });
    } catch {
      return this.errors.mapUnknown(safeExecutionId(result));
    }
  }
}

function inspectPresentation(
  value: unknown,
  executionId: string,
  executableSuccess: boolean,
): Readonly<{ category: keyof typeof statusByCategory; value: unknown }> {
  if (!isPlainObject(value)) throw new TypeError("Invalid presentation result.");
  const category = value["category"];
  const presentationResult = value["presentationResult"];
  const metadata = value["metadata"];
  if (typeof category !== "string" || !Object.hasOwn(statusByCategory, category)
    || !isPlainObject(metadata) || metadata["requestId"] !== executionId) {
    throw new TypeError("Invalid presentation result.");
  }
  const isSuccessPresentation = presentationResult === "SUCCESS" && category === "SUCCESS";
  const isFailurePresentation = presentationResult === "ERROR" && category !== "SUCCESS";
  if ((executableSuccess && !isSuccessPresentation) || (!executableSuccess && !isFailurePresentation)) {
    throw new TypeError("Invalid presentation result.");
  }
  return Object.freeze({ category: category as keyof typeof statusByCategory, value });
}

function safeExecutionId(value: unknown): string {
  try {
    if (!isPlainObject(value)) return "unavailable";
    const executionId = value["executionId"];
    return typeof executionId === "string" && executionId.trim().length > 0
      ? executionId
      : "unavailable";
  } catch {
    return "unavailable";
  }
}

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}
