import type {
  RegisteredServiceWorkloadEvidenceVerifier,
  RegisteredServiceWorkloadRecord,
} from "./registered-service-workload.js";

export interface RegisteredServiceWorkloadIdentityEvidence {
  readonly evidenceRef: string;
  readonly schemaVersion: 1;
  readonly registrationId: string;
  readonly registrationVersion: number;
  readonly tenantId: string;
  readonly principalId: string;
  readonly immutable: true;
}

export interface RegisteredServiceWorkloadAuditEvidence extends RegisteredServiceWorkloadIdentityEvidence {
  readonly final: true;
}

export interface RegisteredServiceWorkloadIdentityEvidenceQueryPort {
  findIdentityEvidence(reference: string): RegisteredServiceWorkloadIdentityEvidence | undefined;
}

export interface ReadOnlyAuditEvidenceQueryPort {
  findFinalAuditEvidence(reference: string): RegisteredServiceWorkloadAuditEvidence | undefined;
}

export class RegisteredServiceWorkloadEvidenceAuthorityAdapter implements RegisteredServiceWorkloadEvidenceVerifier {
  public constructor(
    private readonly identityEvidence: RegisteredServiceWorkloadIdentityEvidenceQueryPort,
    private readonly auditEvidence: ReadOnlyAuditEvidenceQueryPort,
  ) {}

  public assertRegisteredWorkloadEvidence(record: RegisteredServiceWorkloadRecord): void {
    try {
      const identity = this.identityEvidence.findIdentityEvidence(record.identityEvidenceRef);
      const audit = this.auditEvidence.findFinalAuditEvidence(record.auditEvidenceRef);
      if (!matches(identity, record, false) || !matches(audit, record, true)) throw new Error("unavailable");
    } catch {
      throw new Error("Registered service workload evidence is unavailable.");
    }
  }
}

function matches(
  evidence: RegisteredServiceWorkloadIdentityEvidence | RegisteredServiceWorkloadAuditEvidence | undefined,
  record: RegisteredServiceWorkloadRecord,
  requireFinal: boolean,
): boolean {
  if (evidence === undefined) return false;
  const keys = Object.keys(evidence).sort();
  const expectedKeys = [
    "evidenceRef", "immutable", "principalId", "registrationId", "registrationVersion", "schemaVersion", "tenantId",
    ...(requireFinal ? ["final"] : []),
  ].sort();
  return JSON.stringify(keys) === JSON.stringify(expectedKeys)
    && evidence.evidenceRef === (requireFinal ? record.auditEvidenceRef : record.identityEvidenceRef)
    && evidence.schemaVersion === 1
    && evidence.registrationId === record.registrationId
    && evidence.registrationVersion === record.registrationVersion
    && evidence.tenantId === record.tenantId
    && evidence.principalId === record.principalId
    && evidence.immutable === true
    && (!requireFinal || (evidence as RegisteredServiceWorkloadAuditEvidence).final === true);
}
