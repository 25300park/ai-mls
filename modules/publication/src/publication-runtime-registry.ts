import { hasConsistentPublicationOperationsInfrastructure, type PublicationInfrastructure } from "./publication-infrastructure.js";
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
  "lifecycle",
  "reconciliation",
  "connectorDispatcher",
  "eventJournal",
  "eventCoordinator",
  "eventReplay",
  "eventGovernanceContextStore",
  "eventSourceContextResolver",
  "listingProjectionStore",
  "listingProjectionConsumer",
  "listingProjectionRebuild",
  "listingProjectionRead",
  "operationsEvidence",
  "operationsMetrics",
  "operationsStatus",
  "operationsRead",
  "operationsRetry",
  "operationsProjectionRead",
  "operationsControl",
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
  readonly lifecycle: PublicationInfrastructure["lifecycle"];
  readonly reconciliation: PublicationInfrastructure["reconciliation"];
  readonly connectorDispatcher: PublicationInfrastructure["connectorDispatcher"];
  readonly eventJournal: PublicationInfrastructure["eventJournal"];
  readonly eventCoordinator: PublicationInfrastructure["eventCoordinator"];
  readonly eventReplay: PublicationInfrastructure["eventReplay"];
  readonly eventGovernanceContextStore: PublicationInfrastructure["eventGovernanceContextStore"];
  readonly eventSourceContextResolver: PublicationInfrastructure["eventSourceContextResolver"];
  readonly listingProjectionStore: PublicationInfrastructure["listingProjectionStore"];
  readonly listingProjectionConsumer: PublicationInfrastructure["listingProjectionConsumer"];
  readonly listingProjectionRebuild: PublicationInfrastructure["listingProjectionRebuild"];
  readonly listingProjectionRead: PublicationInfrastructure["listingProjectionRead"];
  readonly operationsEvidence: PublicationInfrastructure["operationsEvidence"];
  readonly operationsMetrics: PublicationInfrastructure["operationsMetrics"];
  readonly operationsStatus: PublicationInfrastructure["operationsStatus"];
  readonly operationsRead: PublicationInfrastructure["operationsRead"];
  readonly operationsRetry: PublicationInfrastructure["operationsRetry"];
  readonly operationsProjectionRead: PublicationInfrastructure["operationsProjectionRead"];
  readonly operationsControl: PublicationInfrastructure["operationsControl"];
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
    lifecycle: infrastructure.lifecycle,
    reconciliation: infrastructure.reconciliation,
    connectorDispatcher: infrastructure.connectorDispatcher,
    eventJournal: infrastructure.eventJournal,
    eventCoordinator: infrastructure.eventCoordinator,
    eventReplay: infrastructure.eventReplay,
    eventGovernanceContextStore: infrastructure.eventGovernanceContextStore,
    eventSourceContextResolver: infrastructure.eventSourceContextResolver,
    listingProjectionStore: infrastructure.listingProjectionStore,
    listingProjectionConsumer: infrastructure.listingProjectionConsumer,
    listingProjectionRebuild: infrastructure.listingProjectionRebuild,
    listingProjectionRead: infrastructure.listingProjectionRead,
    operationsEvidence: infrastructure.operationsEvidence,
    operationsMetrics: infrastructure.operationsMetrics,
    operationsStatus: infrastructure.operationsStatus,
    operationsRead: infrastructure.operationsRead,
    operationsRetry: infrastructure.operationsRetry,
    operationsProjectionRead: infrastructure.operationsProjectionRead,
    operationsControl: infrastructure.operationsControl,
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
    || !hasMethods(value["eventJournal"], ["append", "appendAll", "findByEventId", "listByAggregate", "getLastSequence"])
    || !hasMethods(value["clock"], ["now"])) {
    throw new PublicationRuntimeError("RUNTIME_DEPENDENCY_MISSING", "A mandatory runtime port is unavailable.");
  }
  if (!hasMethods(value["authorization"], ["authorize"])
    || !hasMethods(value["authorizationEvidence"], ["append", "list"])
    || !hasMethods(value["coordination"], ["create", "publish"])
    || !hasMethods(value["lifecycle"], ["correctPublication", "republishPublication", "requestWithdrawal", "resolveWithdrawal", "suspendPublication", "resumePublication", "supersedePublication", "terminatePublication", "execute"])
    || !hasMethods(value["reconciliation"], ["reconcile", "recover", "execute"])
    || !hasMethods(value["connectorDispatcher"], ["dispatch"])
    || !hasMethods(value["eventReplay"], ["replay"])
    || !hasMethods(value["listingProjectionStore"], ["getServing", "save", "compareAndSwapServingGeneration", "validateServingGenerationCutover", "commitServingGenerationCutover"])
    || !hasMethods(value["listingProjectionConsumer"], ["consume"])
    || !hasMethods(value["listingProjectionRebuild"], ["rebuild"])
    || !hasMethods(value["listingProjectionRead"], ["getServing"])
    || !hasMethods(value["operationsEvidence"], ["append", "list"])
    || !hasMethods(value["operationsMetrics"], ["increment", "snapshot"])
    || !hasMethods(value["operationsStatus"], ["observe", "getComponentStatus"])
    || !hasMethods(value["operationsRead"], ["getSystemOperationalStatus", "getComponentStatus", "getOperationalMetrics", "getJournalOperationalStatus"])
    || !hasMethods(value["operationsRetry"], ["decide"])
    || !hasMethods(value["operationsProjectionRead"], ["getProjectionOperationalStatus"])
    || !hasMethods(value["operationsControl"], ["requestProjectionRebuild"])) {
    throw new PublicationRuntimeError("RUNTIME_DEPENDENCY_MISSING", "A mandatory runtime authorization port is unavailable.");
  }
  const configuration = value["configuration"];
  const unitOfWork = value["unitOfWork"];
  if (!isRecord(configuration) || !isRecord(unitOfWork)
    || configuration["clock"] !== value["clock"]
    || unitOfWork["repository"] !== value["repository"]
    || unitOfWork["idempotency"] !== value["idempotency"]
    || unitOfWork["audit"] !== value["audit"]
    || unitOfWork["eventJournal"] !== value["eventJournal"]
    || !hasMethods(value["eventCoordinator"], ["appendAcceptedTransition", "observeCommitted"])
    || !hasMethods(value["eventGovernanceContextStore"], ["findCurrentByPublicationId", "findById"])
    || !hasMethods(value["eventSourceContextResolver"], ["resolve"])
    || !isRecord(value["listingProjectionConsumer"])
    || !isRecord(value["listingProjectionRebuild"])
    || value["listingProjectionConsumer"]["journalIdentity"] !== value["eventJournal"]
    || value["listingProjectionRebuild"]["journalIdentity"] !== value["eventJournal"]
    || value["operationsStatus"] !== value["operationsRead"]
    || !hasConsistentPublicationOperationsInfrastructure(value)) {
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
