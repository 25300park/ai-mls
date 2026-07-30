import {
  PublicationNodeHttpServerError,
  type PublicationNodeHttpServerConfiguration,
} from "./publication-node-http-contracts.js";

export const defaultPublicationNodeHttpServerConfiguration: PublicationNodeHttpServerConfiguration =
  Object.freeze({
    host: "127.0.0.1",
    port: 0,
    maximumBodyBytes: 1_048_576,
    shutdownTimeout: 5_000,
  });

export function createPublicationNodeHttpServerConfiguration(
  input: unknown = defaultPublicationNodeHttpServerConfiguration,
): PublicationNodeHttpServerConfiguration {
  try {
    if (!isPlainRecord(input)) throw invalidConfiguration();
    const keys = Object.keys(input).sort();
    if (keys.length !== 4
      || keys[0] !== "host"
      || keys[1] !== "maximumBodyBytes"
      || keys[2] !== "port"
      || keys[3] !== "shutdownTimeout") {
      throw invalidConfiguration();
    }
    const host = input["host"];
    const port = input["port"];
    const maximumBodyBytes = input["maximumBodyBytes"];
    const shutdownTimeout = input["shutdownTimeout"];
    if (!isLoopbackHost(host)
      || !isIntegerInRange(port, 0, 65_535)
      || !isIntegerInRange(maximumBodyBytes, 1, Number.MAX_SAFE_INTEGER)
      || !isIntegerInRange(shutdownTimeout, 1, Number.MAX_SAFE_INTEGER)) {
      throw invalidConfiguration();
    }
    return Object.freeze({ host, port, maximumBodyBytes, shutdownTimeout });
  } catch {
    throw invalidConfiguration();
  }
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function isLoopbackHost(value: unknown): value is PublicationNodeHttpServerConfiguration["host"] {
  return value === "127.0.0.1" || value === "::1" || value === "localhost";
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

function invalidConfiguration(): PublicationNodeHttpServerError {
  return new PublicationNodeHttpServerError(
    "INVALID_NODE_REQUEST",
    "Node HTTP server configuration is invalid.",
  );
}
