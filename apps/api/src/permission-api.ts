import type { AdvisoryValidationDecision } from "../../../modules/ai/src/advisory-ai-service.js";
import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import type { EffectivePermissionDecision, Permission, PermissionService } from "../../../modules/permission/src/permission-service.js";
import { executeBoundary, requireSessionId, type ApiResponse, type RequestContext } from "./contracts.js";

type PermissionPort = Pick<PermissionService, "requestPermission" | "beginReview" | "recordReviewSupport" | "decide" | "revoke" | "evaluateExpiry" | "checkEffective" | "readPermission" | "readHistory" | "listQueue" | "listExpiry" | "validateEvidence">;
export interface PermissionApiDependencies { readonly permissionService: PermissionPort; readonly sessionReader: (sessionId: string) => SessionContext }
type Contextual<T> = Omit<T, "actor" | "requestId" | "correlationId"> & { readonly context: RequestContext };
export type PermissionUiAction = "READ" | "REQUEST" | "REVIEW" | "REVIEW_EVIDENCE" | "GRANT" | "DENY" | "REVOKE" | "CHECK_EFFECTIVE";
export interface PermissionAccessibility { readonly landmarkLabel: string; readonly listLabel: string; readonly liveRegion: "polite"; readonly keyboardOperable: true; readonly errorSummaryLinked: true }
export interface PermissionQueueView { readonly screenId: "UI-026"; readonly presentationState: "READY" | "EMPTY"; readonly permissions: readonly Permission[]; readonly allowedActions: readonly PermissionUiAction[]; readonly accessibility: PermissionAccessibility }
export interface PermissionDetailView { readonly screenId: "UI-028"; readonly presentationState: Permission["status"]; readonly permission: Permission; readonly allowedActions: readonly PermissionUiAction[]; readonly accessibility: PermissionAccessibility }
export interface PermissionExpiryView { readonly screenId: "UI-032"; readonly presentationState: "ACTION_REQUIRED" | "EMPTY"; readonly permissions: readonly Permission[]; readonly allowedActions: readonly PermissionUiAction[]; readonly accessibility: PermissionAccessibility }

const accessibility = (landmarkLabel: string, listLabel: string): PermissionAccessibility => Object.freeze({ landmarkLabel, listLabel, liveRegion: "polite", keyboardOperable: true, errorSummaryLinked: true });
const queueAccessibility = accessibility("Permission queue", "Assigned permission work");
const detailAccessibility = accessibility("Permission review", "Scope, audience, purpose and immutable history");
const expiryAccessibility = accessibility("Permission expiration", "Expiring and restricted permission work");

function detailActions(actor: SessionContext): readonly PermissionUiAction[] {
  if (actor.roles.includes("PMR")) return Object.freeze(["READ", "REQUEST", "REVIEW", "GRANT", "DENY", "REVOKE", "CHECK_EFFECTIVE"]);
  if (actor.roles.includes("REV")) return Object.freeze(["READ", "REVIEW_EVIDENCE"]);
  if (actor.roles.includes("AGT")) return Object.freeze(["READ"]);
  return Object.freeze(["READ"]);
}
function queueActions(actor: SessionContext): readonly PermissionUiAction[] { if (actor.roles.includes("PMR")) return Object.freeze(["READ", "REQUEST", "REVIEW"]); if (actor.roles.includes("REV")) return Object.freeze(["READ", "REVIEW_EVIDENCE"]); return Object.freeze(["READ"]); }
function expiryActions(actor: SessionContext): readonly PermissionUiAction[] { return actor.roles.includes("PMR") ? Object.freeze(["READ", "REVOKE", "CHECK_EFFECTIVE"]) : Object.freeze(["READ"]); }
function detailView(permission: Permission, actor: SessionContext): PermissionDetailView { return Object.freeze({ screenId: "UI-028", presentationState: permission.status, permission, allowedActions: detailActions(actor), accessibility: detailAccessibility }); }

export class PermissionApi {
  public constructor(private readonly dependencies: PermissionApiDependencies) {}
  public requestPermission(input: Contextual<Parameters<PermissionService["requestPermission"]>[0]>): ApiResponse<PermissionDetailView> { return executeBoundary(input.context, () => { const actor = this.#actor(input.context); return detailView(this.dependencies.permissionService.requestPermission(this.#request(input, actor)), actor); }); }
  public beginReview(input: Contextual<Parameters<PermissionService["beginReview"]>[0]>): ApiResponse<PermissionDetailView> { return executeBoundary(input.context, () => { const actor = this.#actor(input.context); return detailView(this.dependencies.permissionService.beginReview(this.#request(input, actor)), actor); }); }
  public recordReviewSupport(input: Contextual<Parameters<PermissionService["recordReviewSupport"]>[0]>): ApiResponse<PermissionDetailView> { return executeBoundary(input.context, () => { const actor = this.#actor(input.context); return detailView(this.dependencies.permissionService.recordReviewSupport(this.#request(input, actor)), actor); }); }
  public decide(input: Contextual<Parameters<PermissionService["decide"]>[0]>): ApiResponse<PermissionDetailView> { return executeBoundary(input.context, () => { const actor = this.#actor(input.context); return detailView(this.dependencies.permissionService.decide(this.#request(input, actor)), actor); }); }
  public revoke(input: Contextual<Parameters<PermissionService["revoke"]>[0]>): ApiResponse<PermissionDetailView> { return executeBoundary(input.context, () => { const actor = this.#actor(input.context); return detailView(this.dependencies.permissionService.revoke(this.#request(input, actor)), actor); }); }
  public evaluateExpiry(input: Contextual<Parameters<PermissionService["evaluateExpiry"]>[0]>): ApiResponse<PermissionDetailView> { return executeBoundary(input.context, () => { const actor = this.#actor(input.context); return detailView(this.dependencies.permissionService.evaluateExpiry(this.#request(input, actor)), actor); }); }
  public checkEffective(input: Contextual<Parameters<PermissionService["checkEffective"]>[0]>): ApiResponse<EffectivePermissionDecision> { return executeBoundary(input.context, () => this.dependencies.permissionService.checkEffective(this.#request(input, this.#actor(input.context)))); }
  public readPermission(input: Contextual<Parameters<PermissionService["readPermission"]>[0]>): ApiResponse<PermissionDetailView> { return executeBoundary(input.context, () => { const actor = this.#actor(input.context); return detailView(this.dependencies.permissionService.readPermission(this.#request(input, actor)), actor); }); }
  public readHistory(input: Contextual<Parameters<PermissionService["readHistory"]>[0]>): ApiResponse<ReturnType<PermissionService["readHistory"]>> { return executeBoundary(input.context, () => this.dependencies.permissionService.readHistory(this.#request(input, this.#actor(input.context)))); }
  public readQueue(input: Readonly<{ readonly context: RequestContext; readonly purpose: Parameters<PermissionService["listQueue"]>[0]["purpose"] }>): ApiResponse<PermissionQueueView> { return executeBoundary(input.context, () => { const actor = this.#actor(input.context); const permissions = this.dependencies.permissionService.listQueue(this.#request(input, actor)); return Object.freeze({ screenId: "UI-026", presentationState: permissions.length === 0 ? "EMPTY" : "READY", permissions, allowedActions: queueActions(actor), accessibility: queueAccessibility }); }); }
  public readExpiry(input: Readonly<{ readonly context: RequestContext; readonly purpose: Parameters<PermissionService["listExpiry"]>[0]["purpose"] }>): ApiResponse<PermissionExpiryView> { return executeBoundary(input.context, () => { const actor = this.#actor(input.context); const permissions = this.dependencies.permissionService.listExpiry(this.#request(input, actor)); return Object.freeze({ screenId: "UI-032", presentationState: permissions.length === 0 ? "EMPTY" : "ACTION_REQUIRED", permissions, allowedActions: expiryActions(actor), accessibility: expiryAccessibility }); }); }
  public validateEvidence(input: Contextual<Parameters<PermissionService["validateEvidence"]>[0]>): ApiResponse<AdvisoryValidationDecision> { return executeBoundary(input.context, () => this.dependencies.permissionService.validateEvidence(this.#request(input, this.#actor(input.context)))); }
  #request<T extends Readonly<Record<string, unknown>>>(input: T & { readonly context: RequestContext }, actor: SessionContext): Omit<T, "context"> & { readonly actor: SessionContext; readonly correlationId: string; readonly requestId?: string } { const { context, ...fields } = input; return { ...fields, actor, correlationId: context.correlationId, ...(context.requestId === undefined ? {} : { requestId: context.requestId }) }; }
  #actor(context: RequestContext): SessionContext { return this.dependencies.sessionReader(requireSessionId(context)); }
}
