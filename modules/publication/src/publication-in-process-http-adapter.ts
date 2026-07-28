import {
  immutablePublicationHttpValue,
  PublicationHttpAdapterError,
  type PublicationHttpRequest,
  type PublicationHttpResponse,
} from "./publication-http-contracts.js";
import type { PublicationExecutableResult } from "./publication-executable-contracts.js";
import { PublicationHttpErrorMapper } from "./publication-http-error-mapper.js";
import {
  PublicationExecutableInvocationAdapter,
  type PublicationExecutableInvoker,
} from "./publication-http-executable-invocation-adapter.js";
import { PublicationHttpRequestMapper } from "./publication-http-request-mapper.js";
import { PublicationHttpResponseMapper } from "./publication-http-response-mapper.js";
import { createDefaultPublicationHttpRouteRegistry } from "./publication-http-route-registry.js";
import { PublicationHttpBoundaryValidator } from "./publication-http-validation.js";

export class InProcessPublicationHttpAdapter {
  public constructor(
    private readonly validator: PublicationHttpBoundaryValidator,
    private readonly requestMapper: PublicationHttpRequestMapper,
    private readonly invocation: PublicationExecutableInvocationAdapter,
    private readonly responseMapper: PublicationHttpResponseMapper,
    private readonly errors: PublicationHttpErrorMapper,
  ) {}

  public async handle(input: unknown): Promise<PublicationHttpResponse> {
    const requestId = this.validator.safeRequestId(input);
    let executableRequest;
    try {
      const request: PublicationHttpRequest = this.validator.validateRequest(input);
      executableRequest = this.requestMapper.map(request);
    } catch (error) {
      if (error instanceof PublicationHttpAdapterError) {
        return this.errors.map(requestId, error.code);
      }
      return this.errors.mapUnknown(requestId);
    }
    try {
      const invoked = await Promise.resolve(this.invocation.invoke(executableRequest));
      const result = immutablePublicationHttpValue(invoked) as unknown as PublicationExecutableResult;
      if (result.executionId !== executableRequest.executionId) {
        return this.errors.mapUnknown(executableRequest.executionId);
      }
      return this.validator.validateResponse(this.responseMapper.map(result));
    } catch {
      return this.errors.mapUnknown(requestId);
    }
  }
}

export function createInProcessPublicationHttpAdapter(
  executable: PublicationExecutableInvoker,
): InProcessPublicationHttpAdapter {
  const validator = new PublicationHttpBoundaryValidator();
  const errors = new PublicationHttpErrorMapper();
  return new InProcessPublicationHttpAdapter(
    validator,
    new PublicationHttpRequestMapper(createDefaultPublicationHttpRouteRegistry()),
    new PublicationExecutableInvocationAdapter(executable),
    new PublicationHttpResponseMapper(errors),
    errors,
  );
}
