import type { AdvisoryValidationDecision } from "../../../modules/ai/src/advisory-ai-service.js";
import type { Client, ClientRequirementService, Requirement } from "../../../modules/client/src/client-requirement-service.js";
import type { Contact, ContactChannel, ContactService } from "../../../modules/contact/src/contact-service.js";
import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import { executeBoundary, requireSessionId, type ApiResponse, type RequestContext } from "./contracts.js";

type ContactPort = Pick<ContactService, "createContact" | "correctContact" | "addChannel" | "revokeChannel" | "openCase" | "recordAttempt" | "setDoNotContact" | "readContact" | "readContactHistory" | "revealChannel">;
type ClientPort = Pick<ClientRequirementService, "createClient" | "readClient" | "createRequirement" | "activateRequirement" | "reviseRequirement" | "transitionRequirement" | "readRequirement" | "readRequirementHistory" | "validateRequirementProposal" | "validateSearchInterpretation">;
export interface ContactClientApiDependencies { readonly contactService: ContactPort; readonly clientRequirementService: ClientPort; readonly sessionReader: (sessionId: string) => SessionContext }
type Contextual<T> = Omit<T, "actor" | "requestId" | "correlationId"> & { readonly context: RequestContext };

export interface ContactViewState { readonly presentationState: "MASKED"; readonly record: Contact }
export interface ChannelViewState { readonly presentationState: "MASKED"; readonly record: ContactChannel }
export interface ClientViewState { readonly presentationState: "READY"; readonly record: Client }
export interface RequirementViewState { readonly presentationState: "DRAFT" | "READY" | "INACTIVE"; readonly canonicalState: Requirement["status"]; readonly readiness: Requirement["readiness"]; readonly staleMatchSignal: boolean; readonly record: Requirement }

function contactView(record: Contact): ContactViewState { return Object.freeze({ presentationState: "MASKED", record }); }
function channelView(record: ContactChannel): ChannelViewState { return Object.freeze({ presentationState: "MASKED", record }); }
function clientView(record: Client): ClientViewState { return Object.freeze({ presentationState: "READY", record }); }
function requirementView(record: Requirement): RequirementViewState { return Object.freeze({ presentationState: record.status === "DRAFT" ? "DRAFT" : record.readiness === "READY" ? "READY" : "INACTIVE", canonicalState: record.status, readiness: record.readiness, staleMatchSignal: record.staleMatchSignal, record }); }

export class ContactClientApi {
  public constructor(private readonly dependencies: ContactClientApiDependencies) {}

  public createContact(input: Contextual<Parameters<ContactService["createContact"]>[0]>): ApiResponse<ContactViewState> { return executeBoundary(input.context, () => contactView(this.dependencies.contactService.createContact(this.#request(input)))); }
  public correctContact(input: Contextual<Parameters<ContactService["correctContact"]>[0]>): ApiResponse<ContactViewState> { return executeBoundary(input.context, () => contactView(this.dependencies.contactService.correctContact(this.#request(input)))); }
  public addChannel(input: Contextual<Parameters<ContactService["addChannel"]>[0]>): ApiResponse<ChannelViewState> { return executeBoundary(input.context, () => channelView(this.dependencies.contactService.addChannel(this.#request(input)))); }
  public revokeChannel(input: Contextual<Parameters<ContactService["revokeChannel"]>[0]>): ApiResponse<ChannelViewState> { return executeBoundary(input.context, () => channelView(this.dependencies.contactService.revokeChannel(this.#request(input)))); }
  public openContactCase(input: Contextual<Parameters<ContactService["openCase"]>[0]>): ApiResponse<ReturnType<ContactService["openCase"]>> { return executeBoundary(input.context, () => this.dependencies.contactService.openCase(this.#request(input))); }
  public recordContactAttempt(input: Contextual<Parameters<ContactService["recordAttempt"]>[0]>): ApiResponse<ReturnType<ContactService["recordAttempt"]>> { return executeBoundary(input.context, () => this.dependencies.contactService.recordAttempt(this.#request(input))); }
  public setDoNotContact(input: Contextual<Parameters<ContactService["setDoNotContact"]>[0]>): ApiResponse<ReturnType<ContactService["setDoNotContact"]>> { return executeBoundary(input.context, () => this.dependencies.contactService.setDoNotContact(this.#request(input))); }
  public readContact(input: Contextual<Parameters<ContactService["readContact"]>[0]>): ApiResponse<ContactViewState> { return executeBoundary(input.context, () => contactView(this.dependencies.contactService.readContact(this.#request(input)))); }
  public readContactHistory(input: Contextual<Parameters<ContactService["readContactHistory"]>[0]>): ApiResponse<ReturnType<ContactService["readContactHistory"]>> { return executeBoundary(input.context, () => this.dependencies.contactService.readContactHistory(this.#request(input))); }
  public revealChannel(input: Contextual<Parameters<ContactService["revealChannel"]>[0]>): ApiResponse<ReturnType<ContactService["revealChannel"]>> { return executeBoundary(input.context, () => this.dependencies.contactService.revealChannel(this.#request(input))); }

  public createClient(input: Contextual<Parameters<ClientRequirementService["createClient"]>[0]>): ApiResponse<ClientViewState> { return executeBoundary(input.context, () => clientView(this.dependencies.clientRequirementService.createClient(this.#request(input)))); }
  public readClient(input: Contextual<Parameters<ClientRequirementService["readClient"]>[0]>): ApiResponse<ClientViewState> { return executeBoundary(input.context, () => clientView(this.dependencies.clientRequirementService.readClient(this.#request(input)))); }
  public createRequirement(input: Contextual<Parameters<ClientRequirementService["createRequirement"]>[0]>): ApiResponse<RequirementViewState> { return executeBoundary(input.context, () => requirementView(this.dependencies.clientRequirementService.createRequirement(this.#request(input)))); }
  public activateRequirement(input: Contextual<Parameters<ClientRequirementService["activateRequirement"]>[0]>): ApiResponse<RequirementViewState> { return executeBoundary(input.context, () => requirementView(this.dependencies.clientRequirementService.activateRequirement(this.#request(input)))); }
  public reviseRequirement(input: Contextual<Parameters<ClientRequirementService["reviseRequirement"]>[0]>): ApiResponse<RequirementViewState> { return executeBoundary(input.context, () => requirementView(this.dependencies.clientRequirementService.reviseRequirement(this.#request(input)))); }
  public transitionRequirement(input: Contextual<Parameters<ClientRequirementService["transitionRequirement"]>[0]>): ApiResponse<RequirementViewState> { return executeBoundary(input.context, () => requirementView(this.dependencies.clientRequirementService.transitionRequirement(this.#request(input)))); }
  public readRequirement(input: Contextual<Parameters<ClientRequirementService["readRequirement"]>[0]>): ApiResponse<RequirementViewState> { return executeBoundary(input.context, () => requirementView(this.dependencies.clientRequirementService.readRequirement(this.#request(input)))); }
  public readRequirementHistory(input: Contextual<Parameters<ClientRequirementService["readRequirementHistory"]>[0]>): ApiResponse<ReturnType<ClientRequirementService["readRequirementHistory"]>> { return executeBoundary(input.context, () => this.dependencies.clientRequirementService.readRequirementHistory(this.#request(input))); }
  public validateRequirementProposal(input: Contextual<Parameters<ClientRequirementService["validateRequirementProposal"]>[0]>): ApiResponse<AdvisoryValidationDecision> { return executeBoundary(input.context, () => this.dependencies.clientRequirementService.validateRequirementProposal(this.#request(input))); }
  public validateSearchInterpretation(input: Contextual<Parameters<ClientRequirementService["validateSearchInterpretation"]>[0]>): ApiResponse<AdvisoryValidationDecision> { return executeBoundary(input.context, () => this.dependencies.clientRequirementService.validateSearchInterpretation(this.#request(input))); }

  #request<T extends Readonly<Record<string, unknown>>>(input: T & { readonly context: RequestContext }): Omit<T, "context"> & { readonly actor: SessionContext; readonly correlationId: string; readonly requestId?: string } { const { context, ...fields } = input; return { ...fields, actor: this.#actor(context), correlationId: context.correlationId, ...(context.requestId === undefined ? {} : { requestId: context.requestId }) }; }
  #actor(context: RequestContext): SessionContext { return this.dependencies.sessionReader(requireSessionId(context)); }
}
