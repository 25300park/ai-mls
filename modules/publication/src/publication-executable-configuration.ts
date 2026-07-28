import { PublicationExecutableError } from "./publication-executable-contracts.js";

export interface PublicationExecutableConfiguration {
  readonly executionMode: "IN_PROCESS";
}

export const defaultPublicationExecutableConfiguration: PublicationExecutableConfiguration =
  Object.freeze({ executionMode: "IN_PROCESS" });

export function createPublicationExecutableConfiguration(
  input: unknown = defaultPublicationExecutableConfiguration,
): PublicationExecutableConfiguration {
  try {
    if (typeof input !== "object"
      || input === null
      || Array.isArray(input)
      || Object.getPrototypeOf(input) !== Object.prototype) {
      throw invalidConfiguration();
    }
    const entries = Object.entries(input);
    if (entries.length !== 1 || entries[0]?.[0] !== "executionMode"
      || entries[0][1] !== "IN_PROCESS") {
      throw invalidConfiguration();
    }
    return Object.freeze({ executionMode: "IN_PROCESS" });
  } catch {
    throw invalidConfiguration();
  }
}

function invalidConfiguration(): PublicationExecutableError {
  return new PublicationExecutableError(
    "INVALID_CONFIGURATION",
    "Executable configuration is invalid.",
  );
}
