import type { AuditPrincipal, AuditSink, Clock, IdFactory } from "../../../packages/security-contracts/src/index.js";
import type { AuthorizationService } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";

export type PropertyEntityType = "Location" | "Property" | "Building" | "Tower" | "Floor" | "Unit";
export interface PropertyReference { readonly entityType: PropertyEntityType | "AiResult" | "RawSource"; readonly entityId: string; readonly version: number }
export interface PropertyNode { readonly id: string; readonly version: number; readonly entityType: PropertyEntityType; readonly canonicalName: string; readonly parentRef?: PropertyReference; readonly status: "proposed" | "active" | "merged" | "split" | "superseded" | "retired"; readonly authority: "CANONICAL_MASTER"; readonly classification: "INTERNAL"; readonly proposedBy: string; readonly createdAt: string }
export interface PropertyAlias { readonly id: string; readonly version: number; readonly targetRef: PropertyReference; readonly alias: string; readonly language: string; readonly sourceRef: PropertyReference; readonly confidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN"; readonly status: "proposed" | "active" | "rejected" | "superseded"; readonly classification: "INTERNAL" }

interface Dependencies { readonly authorizationService: AuthorizationService; readonly auditSink: AuditSink; readonly clock: Clock; readonly idFactory: IdFactory; readonly policyVersion: string }
interface Context { readonly actor: SessionContext; readonly purpose: string; readonly correlationId: string; readonly requestId?: string }

function deepFreeze(value: unknown): void { if (value !== null && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); } }
function immutable<T>(value: T): T { const copy = structuredClone(value); deepFreeze(copy); return copy; }
function principal(session: SessionContext): AuditPrincipal { return { id: session.principalId, type: session.principalType, roles: session.roles, ...(session.teamId === undefined ? {} : { teamId: session.teamId }), sessionId: session.id }; }

export class PropertyService {
  readonly #authorization: AuthorizationService; readonly #audit: AuditSink; readonly #clock: Clock; readonly #idFactory: IdFactory; readonly #policyVersion: string;
  readonly #nodes = new Map<string, PropertyNode>(); readonly #aliases = new Map<string, PropertyAlias>();
  public constructor(dependencies: Dependencies) { this.#authorization = dependencies.authorizationService; this.#audit = dependencies.auditSink; this.#clock = dependencies.clock; this.#idFactory = dependencies.idFactory; this.#policyVersion = dependencies.policyVersion; }

  public propose(request: Context & { readonly entityType: PropertyEntityType; readonly canonicalName: string; readonly parentRef?: PropertyReference; readonly reason: string }): PropertyNode {
    if (request.canonicalName.trim().length === 0 || request.reason.trim().length === 0) throw new Error("PROPERTY_INPUT_INVALID");
    this.#authorize(request, "property.propose", "Property", "new");
    const node = immutable({ id: this.#idFactory(), version: 1, entityType: request.entityType, canonicalName: request.canonicalName.trim(), ...(request.parentRef === undefined ? {} : { parentRef: request.parentRef }), status: "proposed" as const, authority: "CANONICAL_MASTER" as const, classification: "INTERNAL" as const, proposedBy: request.actor.principalId, createdAt: this.#clock().toISOString() });
    this.#nodes.set(node.id, node); this.#record("PROPERTY_PROPOSED", "property.propose", node, request, request.reason); return node;
  }

  public decide(request: Context & { readonly nodeId: string; readonly expectedVersion: number; readonly decision: "ACTIVATE" | "RETIRE" | "SUPERSEDE"; readonly reason: string }): PropertyNode {
    const current = this.read(request.nodeId); if (current.version !== request.expectedVersion) throw new Error("VERSION_CONFLICT"); if (request.reason.trim().length === 0) throw new Error("REASON_REQUIRED");
    this.#authorize(request, "property.decide", "Property", current.id, current.version, current.proposedBy);
    const status: PropertyNode["status"] = request.decision === "ACTIVATE" ? "active" : request.decision === "RETIRE" ? "retired" : "superseded";
    const updated = immutable({ ...current, version: current.version + 1, status }); this.#nodes.set(updated.id, updated); this.#record("PROPERTY_DECIDED", "property.decide", updated, request, request.reason); return updated;
  }

  public proposeAlias(request: Context & { readonly targetRef: PropertyReference; readonly alias: string; readonly language: string; readonly sourceRef: PropertyReference; readonly confidence: PropertyAlias["confidence"] }): PropertyAlias {
    const target = this.read(request.targetRef.entityId); if (target.version !== request.targetRef.version) throw new Error("VERSION_CONFLICT"); if (request.alias.trim().length === 0 || request.language.trim().length === 0) throw new Error("PROPERTY_ALIAS_INVALID");
    this.#authorize(request, "property.propose", "PropertyAlias", "new");
    const alias = immutable({ id: this.#idFactory(), version: 1, targetRef: request.targetRef, alias: request.alias.trim(), language: request.language, sourceRef: request.sourceRef, confidence: request.confidence, status: "proposed" as const, classification: "INTERNAL" as const }); this.#aliases.set(alias.id, alias); this.#record("PROPERTY_ALIAS_PROPOSED", "property.propose", alias, request); return alias;
  }

  public read(nodeId: string): PropertyNode { const node = this.#nodes.get(nodeId); if (node === undefined) throw new Error("PROPERTY_NOT_FOUND"); return node; }

  public readForActor(request: Context & { readonly nodeId: string }): PropertyNode { const node = this.read(request.nodeId); this.#authorize(request, "property.read", "Property", node.id, node.version); return node; }

  public search(request: Context & { readonly query: string }): readonly PropertyNode[] {
    this.#authorize(request, "property.read", "Property", "search"); const query = request.query.trim().toLocaleLowerCase(); if (query.length === 0) return Object.freeze([]);
    const aliasTargets = new Set([...this.#aliases.values()].filter((alias) => alias.alias.toLocaleLowerCase().includes(query)).map((alias) => alias.targetRef.entityId));
    return Object.freeze([...this.#nodes.values()].filter((node) => node.canonicalName.toLocaleLowerCase().includes(query) || aliasTargets.has(node.id)));
  }

  #authorize(context: Context, action: string, type: string, id: string, version?: number, createdBy?: string): void {
    const decision = this.#authorization.evaluate({ session: context.actor, action, resource: { type, id, ...(version === undefined ? {} : { version }), ...(context.actor.teamId === undefined ? {} : { teamId: context.actor.teamId }), ...(createdBy === undefined ? {} : { createdBy }) }, purpose: context.purpose, ...(context.requestId === undefined ? {} : { requestId: context.requestId }), correlationId: context.correlationId }); if (decision.effect === "DENY") throw new Error(decision.reasonCode);
  }
  #record(eventType: string, action: string, subject: PropertyNode | PropertyAlias, context: Context, reason?: string): void {
    this.#audit.append({ eventType, principal: principal(context.actor), action, target: { type: "entityType" in subject ? subject.entityType : "PropertyAlias", id: subject.id, version: subject.version }, purpose: context.purpose, policyVersion: this.#policyVersion, classification: "INTERNAL", decision: "ALLOW", outcome: "COMPLETED", ...(reason === undefined ? {} : { reason }), ...(context.requestId === undefined ? {} : { requestId: context.requestId }), correlationId: context.correlationId, details: { status: subject.status } });
  }
}
