import type { DataClassification } from "../../../packages/security-contracts/src/index.js";
import type {
  DeliveryAttempt,
  PendingPublicationOperation,
  PublicationAuthorizationState,
  PublicationBinding,
  PublicationLifecycleState,
  PublicationSuspensionStatus,
  PublicationTransitionRecord,
  PublicationVersionRecord,
  ReconciliationCase,
  RepublishStatus,
  WithdrawalStatus,
} from "./publication-contracts.js";

/** Logical persistence representation only; it deliberately defines no physical schema. */
export interface PublicationPersistenceRecord {
  readonly identity: {
    readonly publicationId: string;
    readonly aggregateId: string;
    readonly tenantScopeId: string;
  };
  readonly versions: {
    readonly aggregateVersion: number;
    readonly publicationVersion: number;
    readonly effectiveVersion?: number;
  };
  readonly binding: PublicationBinding;
  readonly state: {
    readonly lifecycle: PublicationLifecycleState;
    readonly suspension: PublicationSuspensionStatus;
    readonly authorization: PublicationAuthorizationState;
    readonly withdrawal: WithdrawalStatus;
    readonly republish: RepublishStatus;
    readonly current: boolean;
  };
  readonly classification: DataClassification;
  readonly children: {
    readonly attempts: readonly DeliveryAttempt[];
    readonly reconciliationCases: readonly ReconciliationCase[];
    readonly transitionHistory: readonly PublicationTransitionRecord[];
    readonly bindingHistory: readonly PublicationVersionRecord[];
  };
  readonly pendingOperation?: PendingPublicationOperation;
  readonly effect: {
    readonly effectiveAt?: string;
    readonly externalObjectReference?: string;
  };
  readonly lineage: {
    readonly predecessorPublicationId?: string;
    readonly successorPublicationId?: string;
  };
  readonly timestamps: {
    readonly createdAt: string;
    readonly updatedAt: string;
  };
  readonly auditCorrelationId: string;
}
