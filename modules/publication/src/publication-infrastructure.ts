import { PublicationApplicationService } from "./publication-application-service.js";
import type { PublicationAuditStore } from "./publication-audit-store.js";
import {
  InMemoryPublicationAuthorizationEvidenceStore,
  PublicationAuthorizationGuard,
  type PublicationAuthorizationEvidenceStore,
} from "./publication-authorization.js";
import type { PublicationClock } from "./publication-clock.js";
import {
  CreatePublicationHandler,
  ModifyPublicationHandler,
  type PublicationApplicationDependencies,
} from "./publication-command-handlers.js";
import type { PublicationIdempotencyStore } from "./publication-idempotency-store.js";
import {
  createPublicationInfrastructureConfiguration,
  type PublicationInfrastructureConfiguration,
  type PublicationInfrastructureConfigurationInput,
} from "./publication-infrastructure-configuration.js";
import type { PublicationInputPort } from "./publication-interface-service.js";
import { DeterministicPublicationPresenter } from "./publication-interface-presenter.js";
import { PublicationInterfaceService } from "./publication-interface-service.js";
import { StructuralPublicationInterfaceValidator } from "./publication-interface-validation.js";
import { DefaultPublicationRequestMapper } from "./publication-request-mapper.js";
import { InMemoryPublicationUnitOfWork } from "./publication-unit-of-work.js";
import type { PublicationRepository } from "./publication-repository.js";
import { PublicationLifecycleService } from "./publication-lifecycle-service.js";
import { PublicationReconciliationService } from "./publication-reconciliation-service.js";
import {
  PublicationCoordinationService,
  unavailablePublicationConnectorDispatcher,
  unavailablePublicationEffectiveApprovalPort,
  type PublicationConnectorDispatcher,
} from "./publication-service.js";
import { PublicationEventCoordinator } from "./publication-event-coordinator.js";
import type { PublicationEventJournal } from "./publication-event-journal.js";
import { denyPublicationEventReplayAuthority, PublicationEventReplayService } from "./publication-event-replay-service.js";
import { InMemoryPublicationConnectorDispatchEvidenceStore, type PublicationConnectorDispatchEvidenceStore } from "./publication-connector-dispatch-evidence-store.js";
import { InMemoryPublicationGovernanceContextStore, type PublicationGovernanceContextStore } from "./publication-governance-context.js";
import { StoredPublicationEventSourceContextResolver, type PublicationEventSourceContextResolver } from "./publication-event-source-context.js";
import { InMemoryListingProjectionAuditStore, InMemoryListingProjectionStore } from "./in-memory-listing-projection-store.js";
import { ListingProjectionConsumer, ListingProjectionReadService } from "./listing-projection.js";
import { denyListingProjectionRebuildAuthority, ListingProjectionRebuildCoordinator } from "./listing-projection-rebuild.js";

export interface PublicationInfrastructure {
  readonly configuration: PublicationInfrastructureConfiguration;
  readonly inputPort: PublicationInputPort;
  readonly unitOfWork: InMemoryPublicationUnitOfWork;
  readonly repository: PublicationRepository;
  readonly idempotency: PublicationIdempotencyStore;
  readonly audit: PublicationAuditStore;
  readonly clock: PublicationClock;
  readonly authorization: PublicationAuthorizationGuard;
  readonly authorizationEvidence: PublicationAuthorizationEvidenceStore;
  readonly coordination: PublicationCoordinationService;
  readonly lifecycle: PublicationLifecycleService;
  readonly reconciliation: PublicationReconciliationService;
  readonly connectorDispatcher: PublicationConnectorDispatcher;
  readonly eventJournal: PublicationEventJournal;
  readonly eventCoordinator: PublicationEventCoordinator;
  readonly eventReplay: PublicationEventReplayService;
  readonly dispatchEvidence: PublicationConnectorDispatchEvidenceStore;
  readonly eventGovernanceContextStore: PublicationGovernanceContextStore;
  readonly eventSourceContextResolver: PublicationEventSourceContextResolver;
  readonly listingProjectionStore: InMemoryListingProjectionStore;
  readonly listingProjectionAudit: InMemoryListingProjectionAuditStore;
  readonly listingProjectionConsumer: ListingProjectionConsumer;
  readonly listingProjectionRebuild: ListingProjectionRebuildCoordinator;
  readonly listingProjectionRead: ListingProjectionReadService;
}

export function createPublicationInfrastructure(
  configurationInput: PublicationInfrastructureConfigurationInput = {},
): PublicationInfrastructure {
  const configuration = createPublicationInfrastructureConfiguration(configurationInput);
  const unitOfWork = new InMemoryPublicationUnitOfWork();
  const authorizationEvidence = new InMemoryPublicationAuthorizationEvidenceStore();
  const authorization = new PublicationAuthorizationGuard({
    ...(configuration.sessionResolver === undefined ? {} : { sessionResolver: configuration.sessionResolver }),
    ...(configuration.authorizationEvaluator === undefined ? {} : { authorizationEvaluator: configuration.authorizationEvaluator }),
    ...(configuration.liveContextResolver === undefined ? {} : { liveContextResolver: configuration.liveContextResolver }),
    evidence: authorizationEvidence,
    clock: configuration.clock,
    ...(configuration.publicationPolicyVersion === undefined ? {} : { publicationPolicyVersion: configuration.publicationPolicyVersion }),
  });
  const eventGovernanceContextStore = configuration.eventGovernanceContextStore ?? new InMemoryPublicationGovernanceContextStore();
  const eventSourceContextResolver = new StoredPublicationEventSourceContextResolver(eventGovernanceContextStore, configuration.clock);
  const eventCoordinator = new PublicationEventCoordinator(configuration.clock, eventSourceContextResolver);
  const dispatchEvidence = new InMemoryPublicationConnectorDispatchEvidenceStore();
  const eventReplay = new PublicationEventReplayService({
    repository: unitOfWork.repository,
    journal: unitOfWork.eventJournal,
    unitOfWork,
    audit: unitOfWork.audit,
    clock: configuration.clock,
    authority: denyPublicationEventReplayAuthority,
    sourceContextResolver: eventSourceContextResolver,
  });
  const listingProjectionStore = new InMemoryListingProjectionStore();
  const listingProjectionAudit = new InMemoryListingProjectionAuditStore();
  const listingProjectionConsumer = new ListingProjectionConsumer({
    journal: unitOfWork.eventJournal,
    store: listingProjectionStore,
    audit: listingProjectionAudit,
    clock: configuration.clock,
  });
  const listingProjectionRebuild = new ListingProjectionRebuildCoordinator({
    journal: unitOfWork.eventJournal,
    store: listingProjectionStore,
    audit: listingProjectionAudit,
    clock: configuration.clock,
    authority: configuration.listingProjectionRebuildAuthority ?? denyListingProjectionRebuildAuthority,
  });
  const listingProjectionRead = new ListingProjectionReadService(listingProjectionStore);
  const dependencies: PublicationApplicationDependencies = {
    unitOfWork,
    repository: unitOfWork.repository,
    idempotency: unitOfWork.idempotency,
    audit: unitOfWork.audit,
    clock: configuration.clock,
    authorization,
    eventCoordinator,
  };
  const application = new PublicationApplicationService(
    new CreatePublicationHandler(dependencies),
    new ModifyPublicationHandler(dependencies),
  );
  const connectorDispatcher = configuration.connectorDispatcher ?? unavailablePublicationConnectorDispatcher;
  const coordination = new PublicationCoordinationService({
    application,
    repository: unitOfWork.repository,
    effectiveApproval: configuration.effectiveApprovalPort ?? unavailablePublicationEffectiveApprovalPort,
    connector: connectorDispatcher,
    unitOfWork,
    audit: unitOfWork.audit,
    clock: configuration.clock,
    eventCoordinator,
    dispatchEvidence,
  });
  const lifecycle = new PublicationLifecycleService({
    application,
    effectiveApproval: configuration.effectiveApprovalPort ?? unavailablePublicationEffectiveApprovalPort,
  });
  const reconciliation = new PublicationReconciliationService({
    application,
    repository: unitOfWork.repository,
    authorization,
    effectiveApproval: configuration.effectiveApprovalPort ?? unavailablePublicationEffectiveApprovalPort,
    unitOfWork,
    idempotency: unitOfWork.idempotency,
    audit: unitOfWork.audit,
    clock: configuration.clock,
  });
  const inputPort = new PublicationInterfaceService(
    application,
    new DefaultPublicationRequestMapper(),
    new DeterministicPublicationPresenter(),
    new StructuralPublicationInterfaceValidator(),
    coordination,
    lifecycle,
    reconciliation,
  );

  return Object.freeze({
    configuration,
    inputPort,
    unitOfWork,
    repository: unitOfWork.repository,
    idempotency: unitOfWork.idempotency,
    audit: unitOfWork.audit,
    clock: configuration.clock,
    authorization,
    authorizationEvidence,
    coordination,
    lifecycle,
    reconciliation,
    connectorDispatcher,
    eventJournal: unitOfWork.eventJournal,
    eventCoordinator,
    eventReplay,
    dispatchEvidence,
    eventGovernanceContextStore,
    eventSourceContextResolver,
    listingProjectionStore,
    listingProjectionAudit,
    listingProjectionConsumer,
    listingProjectionRebuild,
    listingProjectionRead,
  });
}
