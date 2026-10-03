import { assertValidDurableSessionRecord, SessionPersistenceError, type DurableSessionRecord } from "./session-persistence.js";

export interface ProductionBoundSessionRecord extends DurableSessionRecord {
  readonly tenantId: string;
  readonly teamId: string;
  readonly tenantBindingOrigin: "AUTHENTICATED_PRINCIPAL_TENANT";
  readonly teamBindingOrigin: "EXPLICIT_TEAM_SELECTION_VALIDATED";
}
export function assertProductionSessionBinding(value: unknown, expectedTenantId: string): asserts value is ProductionBoundSessionRecord {
  assertValidDurableSessionRecord(value);
  if (value.principalType !== "HUMAN" || value.tenantId !== expectedTenantId || !exactId(expectedTenantId)
    || !exactId(value.teamId) || value.tenantBindingOrigin !== "AUTHENTICATED_PRINCIPAL_TENANT"
    || value.teamBindingOrigin !== "EXPLICIT_TEAM_SELECTION_VALIDATED") throw new SessionPersistenceError("SESSION_RECORD_INVALID");
}
function exactId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && value.trim() === value && !/[\u0000-\u001f\u007f\\]/u.test(value);
}
