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
  const dependencies: PublicationApplicationDependencies = {
    unitOfWork,
    repository: unitOfWork.repository,
    idempotency: unitOfWork.idempotency,
    audit: unitOfWork.audit,
    clock: configuration.clock,
    authorization,
  };
  const application = new PublicationApplicationService(
    new CreatePublicationHandler(dependencies),
    new ModifyPublicationHandler(dependencies),
  );
  const inputPort = new PublicationInterfaceService(
    application,
    new DefaultPublicationRequestMapper(),
    new DeterministicPublicationPresenter(),
    new StructuralPublicationInterfaceValidator(),
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
  });
}
