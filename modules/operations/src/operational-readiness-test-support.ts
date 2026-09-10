import {
  validateOperationalReadinessEvidence,
  type OperationalReadinessEvidence,
  type OperationalReadinessEvidenceAdmissionPort,
} from "./operational-readiness-evidence.js";

export function createTestOperationalReadinessEvidenceAdmission(): OperationalReadinessEvidenceAdmissionPort {
  return Object.freeze({
    admit(candidate: unknown): OperationalReadinessEvidence {
      return validateOperationalReadinessEvidence(candidate);
    },
  });
}
