import { immutableDomain, type PublicationSnapshot } from "./publication-contracts.js";
import type { PublicationPersistenceRecord } from "./publication-persistence-model.js";

export function mapPublicationToPersistence(snapshot: PublicationSnapshot): PublicationPersistenceRecord {
  return immutableDomain({
    identity: { publicationId: snapshot.publicationId, aggregateId: snapshot.aggregateId, tenantScopeId: snapshot.tenantScopeId },
    versions: {
      aggregateVersion: snapshot.aggregateVersion,
      publicationVersion: snapshot.publicationVersion,
      ...(snapshot.effectiveVersion === undefined ? {} : { effectiveVersion: snapshot.effectiveVersion }),
    },
    binding: snapshot.binding,
    state: {
      lifecycle: snapshot.lifecycleState,
      suspension: snapshot.suspensionStatus,
      authorization: snapshot.authorizationState,
      withdrawal: snapshot.withdrawalStatus,
      republish: snapshot.republishStatus,
      current: snapshot.currentFlag,
    },
    classification: snapshot.classification,
    children: {
      attempts: snapshot.attempts,
      reconciliationCases: snapshot.reconciliationCases,
      transitionHistory: snapshot.transitionHistory,
      bindingHistory: snapshot.bindingHistory,
    },
    ...(snapshot.pendingOperation === undefined ? {} : { pendingOperation: snapshot.pendingOperation }),
    effect: {
      ...(snapshot.effectiveAt === undefined ? {} : { effectiveAt: snapshot.effectiveAt }),
      ...(snapshot.externalObjectReference === undefined ? {} : { externalObjectReference: snapshot.externalObjectReference }),
    },
    lineage: {
      ...(snapshot.predecessorPublicationId === undefined ? {} : { predecessorPublicationId: snapshot.predecessorPublicationId }),
      ...(snapshot.successorPublicationId === undefined ? {} : { successorPublicationId: snapshot.successorPublicationId }),
    },
    timestamps: { createdAt: snapshot.createdAt, updatedAt: snapshot.updatedAt },
    auditCorrelationId: snapshot.auditCorrelationId,
  });
}

export function mapPersistenceToPublication(record: PublicationPersistenceRecord): PublicationSnapshot {
  return immutableDomain({
    publicationId: record.identity.publicationId,
    aggregateId: record.identity.aggregateId,
    tenantScopeId: record.identity.tenantScopeId,
    aggregateVersion: record.versions.aggregateVersion,
    publicationVersion: record.versions.publicationVersion,
    ...(record.versions.effectiveVersion === undefined ? {} : { effectiveVersion: record.versions.effectiveVersion }),
    binding: record.binding,
    lifecycleState: record.state.lifecycle,
    suspensionStatus: record.state.suspension,
    authorizationState: record.state.authorization,
    withdrawalStatus: record.state.withdrawal,
    republishStatus: record.state.republish,
    currentFlag: record.state.current,
    classification: record.classification,
    attempts: record.children.attempts,
    reconciliationCases: record.children.reconciliationCases,
    transitionHistory: record.children.transitionHistory,
    bindingHistory: record.children.bindingHistory,
    ...(record.pendingOperation === undefined ? {} : { pendingOperation: record.pendingOperation }),
    ...(record.effect.effectiveAt === undefined ? {} : { effectiveAt: record.effect.effectiveAt }),
    ...(record.effect.externalObjectReference === undefined ? {} : { externalObjectReference: record.effect.externalObjectReference }),
    ...(record.lineage.predecessorPublicationId === undefined ? {} : { predecessorPublicationId: record.lineage.predecessorPublicationId }),
    ...(record.lineage.successorPublicationId === undefined ? {} : { successorPublicationId: record.lineage.successorPublicationId }),
    createdAt: record.timestamps.createdAt,
    updatedAt: record.timestamps.updatedAt,
    auditCorrelationId: record.auditCorrelationId,
  });
}
