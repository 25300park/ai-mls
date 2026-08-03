import type { PublicationInfrastructure } from "./publication-infrastructure.js";
import {
  PublicationRuntimeError,
  type PublicationRuntimeServiceName,
} from "./publication-runtime-contracts.js";

export const publicationRuntimeServiceNames: readonly PublicationRuntimeServiceName[] = Object.freeze([
  "inputPort",
  "unitOfWork",
  "repository",
  "idempotency",
  "audit",
  "clock",
  "authorization",
  "authorizationEvidence",
  "coordination",
  "connectorDispatcher",
]);

export interface PublicationRuntimeServiceRegistry {
  readonly serviceNames: readonly PublicationRuntimeServiceName[];
  readonly inputPort: PublicationInfrastructure["inputPort"];
  readonly unitOfWork: PublicationInfrastructure["unitOfWork"];
  readonly repository: PublicationInfrastructure["repository"];
  readonly idempotency: PublicationInfrastructure["idempotency"];
  readonly audit: PublicationInfrastructure["audit"];
  readonly clock: PublicationInfrastructure["clock"];
  readonly authorization: PublicationInfrastructure["authorization"];
  readonly authorizationEvidence: PublicationInfrastructure["authorizationEvidence"];
  readonly coordination: PublicationInfrastructure["coordination"];
  readonly connectorDispatcher: PublicationInfrastructure["connectorDispatcher"];
}

export function createPublicationRuntimeServiceRegistry(
  infrastructure: PublicationInfrastructure,
): PublicationRuntimeServiceRegistry {
  validatePublicationRuntimeInfrastructure(infrastructure);
  return Object.freeze({
    serviceNames: publicationRuntimeServiceNames,
    inputPort: infrastructure.inputPort,
    unitOfWork: infrastructure.unitOfWork,
    repository: infrastructure.repository,
    idempotency: infrastructure.idempotency,
    audit: infrastructure.audit,
    clock: infrastructure.clock,
    authorization: infrastructure.authorization,
    authorizationEvidence: infrastructure.authorizationEvidence,
    coordination: infrastructure.coordination,
    connectorDispatcher: infrastructure.connectorDispatcher,
  });
}

export function validatePublicationRuntimeInfrastructure(
  value: unknown,
): asserts value is PublicationInfrastructure {
  if (!isRecord(value)) {
    throw new PublicationRuntimeError("RUNTIME_DEPENDENCY_MISSING", "Mandatory runtime infrastructure is missing.");
  }
  const required = ["configuration", ...publicationRuntimeServiceNames] as const;
  if (required.some((key) => value[key] === undefined || value[key] === null)) {
    throw new PublicationRuntimeError("RUNTIME_DEPENDENCY_MISSING", "A mandatory runtime dependency is missing.");
  }
  if (!hasMethods(value["inputPort"], ["execute"])
    || !hasMethods(value["unitOfWork"], ["begin"])
    || !hasMethods(value["repository"], ["save", "update", "find", "exists", "checkVersion", "readHistory"])
    || !hasMethods(value["idempotency"], ["record", "find"])
    || !hasMethods(value["audit"], ["append", "list"])
    || !hasMethods(value["clock"], ["now"])) {
    throw new PublicationRuntimeError("RUNTIME_DEPENDENCY_MISSING", "A mandatory runtime port is unavailable.");
  }
  if (!hasMethods(value["authorization"], ["authorize"])
    || !hasMethods(value["authorizationEvidence"], ["append", "list"])
    || !hasMethods(value["coordination"], ["create", "publish"])
    || !hasMethods(value["connectorDispatcher"], ["dispatch"])) {
    throw new PublicationRuntimeError("RUNTIME_DEPENDENCY_MISSING", "A mandatory runtime authorization port is unavailable.");
  }
  const configuration = value["configuration"];
  const unitOfWork = value["unitOfWork"];
  if (!isRecord(configuration) || !isRecord(unitOfWork)
    || configuration["clock"] !== value["clock"]
    || unitOfWork["repository"] !== value["repository"]
    || unitOfWork["idempotency"] !== value["idempotency"]
    || unitOfWork["audit"] !== value["audit"]) {
    throw new PublicationRuntimeError(
      "RUNTIME_CONFIGURATION_INCONSISTENT",
      "Runtime infrastructure configuration is inconsistent.",
    );
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object";
}

function hasMethods(value: unknown, methods: readonly string[]): boolean {
  return isRecord(value) && methods.every((method) => typeof value[method] === "function");
}
