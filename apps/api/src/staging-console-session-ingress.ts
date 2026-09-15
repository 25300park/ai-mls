import type { AuthorizationResource } from "../../../modules/authorization/src/authorization-service.js";
import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import type { ResolveAuthorizedSessionRequest } from "../../../modules/identity/src/session-access-coordinator.js";
import type {
  ConsoleSessionIngressPort,
  ConsoleSessionIngressRequest,
} from "../../admin-console/src/console-server.js";

interface Phase1dSessionAccessPort {
  resolveAuthorized(request: ResolveAuthorizedSessionRequest): SessionContext;
}

export function createStagingConsoleSessionIngress(
  sessionAccess: Phase1dSessionAccessPort,
): ConsoleSessionIngressPort {
  if (typeof sessionAccess?.resolveAuthorized !== "function") {
    throw new Error("STAGING_CONSOLE_SESSION_INGRESS_UNAVAILABLE");
  }
  return Object.freeze({
    authorize(request: ConsoleSessionIngressRequest): void {
      const command = request.commandOperation !== undefined;
      const resource: AuthorizationResource = Object.freeze({
        type: "AdminConsole",
        id: request.page,
        tenantId: request.tenantId,
        teamId: request.scopeRef,
      });
      sessionAccess.resolveAuthorized({
        sessionId: request.sessionId,
        action: command ? "security.admin" : request.page === "UI-035" ? "audit.query" : "resource.view",
        resource,
        purpose: command || request.page === "UI-036" ? "ACCESS_GOVERNANCE"
          : request.page === "UI-035" ? "SECURITY_MONITORING" : request.purpose,
        ...(request.reason === undefined ? {} : { reason: request.reason }),
        correlationId: request.correlationId,
      });
    },
  });
}
