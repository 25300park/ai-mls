import type { AdministrationService } from "../../../modules/administration/src/administration-service.js";
import type { AuditLog } from "../../../modules/audit/src/audit-log.js";
import type { AuthorizationService } from "../../../modules/authorization/src/authorization-service.js";
import type { SessionService } from "../../../modules/identity/src/session-service.js";
import { AdminAuditApi } from "./admin-audit-api.js";
import { IdentityApi } from "./identity-api.js";

export interface ApiModuleDependencies {
  readonly sessionService: SessionService;
  readonly authorizationService: AuthorizationService;
  readonly administrationService: AdministrationService;
  readonly auditLog: AuditLog;
}

export function composeApiModules(dependencies: ApiModuleDependencies): Readonly<{
  readonly identity: IdentityApi;
  readonly administrationAndAudit: AdminAuditApi;
}> {
  return Object.freeze({
    identity: new IdentityApi({
      sessionService: dependencies.sessionService,
      authorizationService: dependencies.authorizationService,
    }),
    administrationAndAudit: new AdminAuditApi({
      administrationService: dependencies.administrationService,
      authorizationService: dependencies.authorizationService,
      auditLog: dependencies.auditLog,
      sessionReader: (sessionId) => dependencies.sessionService.readSession(sessionId),
    }),
  });
}
