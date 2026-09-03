import type { ExternalIntegrationUnresolvedConflictCaseWriter, ExternalIntegrationUnresolvedConflictLink } from "./external-integration-application.js";

type ExternalIntegrationRecoveryCaseStore = Readonly<{
  createCase(input: Readonly<{
    resourceType: "ExternalIntegrationMapping";
    resourceId: string;
    originDomain: "EXTERNAL_INTEGRATION";
    originIdentity: Readonly<{integrationContractId:string;mappingId:string;observationId?:string;conflictEvidenceId:string}>;
    tenantId: string;
    scopeRef: string;
    evidenceRefs: readonly string[];
    createdBy: string;
    createdAt: string;
  }>): unknown;
}>;

export class ExternalIntegrationUnresolvedConflictCaseWriterAdapter implements ExternalIntegrationUnresolvedConflictCaseWriter {
  public constructor(private readonly store: ExternalIntegrationRecoveryCaseStore) {}

  public linkUnresolvedConflict(input: ExternalIntegrationUnresolvedConflictLink): void {
    try {
      this.store.createCase(Object.freeze({
        resourceType: "ExternalIntegrationMapping",
        resourceId: input.mappingId,
        originDomain: "EXTERNAL_INTEGRATION",
        originIdentity: Object.freeze({ integrationContractId: input.integrationContractId, mappingId: input.mappingId, ...(input.observationId === undefined ? {} : { observationId: input.observationId }), conflictEvidenceId: input.conflictEvidenceId }),
        tenantId: input.tenantId,
        scopeRef: input.scopeRef,
        evidenceRefs: input.evidenceRefs,
        createdBy: input.createdBy,
        createdAt: input.createdAt,
      }));
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "DUPLICATE_ORIGIN") throw error;
    }
  }
}
