import {
  createPublicationNodeHttpServer,
  type PublicationNodeHttpServer,
} from "../../../modules/publication/src/publication-node-http-server.js";
import type { PublicationNodeHttpServerRequestIdFactory } from "../../../modules/publication/src/publication-node-http-contracts.js";
import { createCoreIdentityAuthorizationHttpHandler } from "./core-identity-authorization-http.js";
import type { CoreIdentityAuthorizationApplication } from "./core-identity-authorization-http.js";

const APPROVED_MAXIMUM_BODY_BYTES = 16 * 1024;

export interface CoreApi001002NodeHttpCompositionOptions {
  readonly application: CoreIdentityAuthorizationApplication;
  readonly configuration: unknown;
  readonly requestIdFactory?: PublicationNodeHttpServerRequestIdFactory;
}

export function composeCoreApi001002NodeHttpServer(
  options: CoreApi001002NodeHttpCompositionOptions,
): PublicationNodeHttpServer {
  assertApprovedBodyBound(options.configuration);
  return createPublicationNodeHttpServer({
    configuration: options.configuration,
    httpAdapter: createCoreIdentityAuthorizationHttpHandler(options.application),
    ...(options.requestIdFactory === undefined ? {} : { requestIdFactory: options.requestIdFactory }),
  });
}

function assertApprovedBodyBound(configuration: unknown): void {
  if (typeof configuration !== "object" || configuration === null || Array.isArray(configuration)
    || (configuration as Record<string, unknown>)["maximumBodyBytes"] !== APPROVED_MAXIMUM_BODY_BYTES) {
    throw new Error("CORE_API_001_002_CONFIGURATION_INVALID");
  }
}
