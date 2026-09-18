import type {
  RegisteredServiceWorkloadAuthorityLease,
  RegisteredServiceWorkloadRecord,
} from "../../../modules/identity/src/index.js";

export interface ProductionServiceIdentityReference {
  readonly registrationId: string;
}

export interface ProductionServiceIdentityBinding {
  readonly registrationId: string;
  readonly tenantId: string;
  readonly principalId: string;
  readonly principalType: "SERVICE";
  readonly assurance: "WORKLOAD";
  readonly environment: "PRODUCTION";
  readonly workloadPurpose: string;
  readonly audience: string;
  readonly registrationVersion: number;
  readonly identityEvidenceRef: string;
  readonly auditEvidenceRef: string;
}

export type ProductionServiceIdentityErrorCode = "PRODUCTION_SERVICE_IDENTITY_UNAVAILABLE";

export class ProductionServiceIdentityError extends Error {
  public constructor(public readonly code: ProductionServiceIdentityErrorCode) {
    super("Production service identity is unavailable.");
    this.name = "ProductionServiceIdentityError";
  }
}

export interface ProductionServiceIdentityResolverDependencies {
  readonly authority: RegisteredServiceWorkloadAuthorityLease;
  readonly expectedWorkloadPurpose: string;
  readonly expectedAudience: string;
}

export class ProductionServiceIdentityResolver {
  readonly #authority: RegisteredServiceWorkloadAuthorityLease;
  readonly #expectedWorkloadPurpose: string;
  readonly #expectedAudience: string;

  public constructor(dependencies: ProductionServiceIdentityResolverDependencies) {
    if (!safeText(dependencies.expectedWorkloadPurpose) || !safeText(dependencies.expectedAudience)) throw unavailable();
    this.#authority = dependencies.authority;
    this.#expectedWorkloadPurpose = dependencies.expectedWorkloadPurpose;
    this.#expectedAudience = dependencies.expectedAudience;
  }

  public resolve(reference: ProductionServiceIdentityReference): Readonly<ProductionServiceIdentityBinding> {
    if (!exactReference(reference)) throw unavailable();
    try {
      const record = this.#authority.findByRegistrationId(reference.registrationId);
      if (record === undefined || !validActiveRecord(record, this.#expectedWorkloadPurpose, this.#expectedAudience)) throw unavailable();
      return binding(record);
    } catch { throw unavailable(); }
  }

  public assertStillActive(prior: ProductionServiceIdentityBinding): void {
    if (!exactBinding(prior)) throw unavailable();
    const current = this.resolve({ registrationId: prior.registrationId });
    for (const key of Object.keys(prior) as (keyof ProductionServiceIdentityBinding)[]) {
      if (prior[key] !== current[key]) throw unavailable();
    }
  }
}

function binding(record: RegisteredServiceWorkloadRecord): Readonly<ProductionServiceIdentityBinding> {
  return Object.freeze({
    registrationId: record.registrationId, tenantId: record.tenantId, principalId: record.principalId,
    principalType: record.principalType, assurance: record.assurance, environment: record.environment,
    workloadPurpose: record.workloadPurpose, audience: record.audience, registrationVersion: record.registrationVersion,
    identityEvidenceRef: record.identityEvidenceRef,
    auditEvidenceRef: record.auditEvidenceRef,
  });
}

function validActiveRecord(record: RegisteredServiceWorkloadRecord, purpose: string, audience: string): boolean {
  return record.status === "ACTIVE" && record.principalType === "SERVICE" && record.assurance === "WORKLOAD"
    && record.environment === "PRODUCTION" && record.workloadPurpose === purpose && record.audience === audience
    && safeText(record.registrationId) && safeText(record.tenantId) && safeText(record.principalId)
    && safeText(record.identityEvidenceRef) && safeText(record.auditEvidenceRef)
    && Number.isInteger(record.registrationVersion) && record.registrationVersion >= 1;
}

function exactReference(value: unknown): value is ProductionServiceIdentityReference {
  return typeof value === "object" && value !== null && Object.keys(value).length === 1
    && Object.hasOwn(value, "registrationId") && safeText((value as Record<string, unknown>)["registrationId"]);
}

function exactBinding(value: unknown): value is ProductionServiceIdentityBinding {
  if (typeof value !== "object" || value === null) return false;
  const keys = Object.keys(value).sort();
  return JSON.stringify(keys) === JSON.stringify([
    "assurance", "audience", "auditEvidenceRef", "environment", "identityEvidenceRef", "principalId", "principalType",
    "registrationId", "registrationVersion", "tenantId", "workloadPurpose",
  ]) && exactReference({ registrationId: (value as Record<string, unknown>)["registrationId"] });
}

function safeText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && value.trim() === value
    && !/[\u0000-\u001f\u007f\\]/u.test(value);
}

function unavailable(): ProductionServiceIdentityError {
  return new ProductionServiceIdentityError("PRODUCTION_SERVICE_IDENTITY_UNAVAILABLE");
}
