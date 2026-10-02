import { EXTERNAL_INTEGRATION_OPERATIONS,type ExternalIntegrationRequestKind } from "./external-integration-api-contracts.js";
import type { ExternalIntegrationApplicationResult,ExternalIntegrationEvidenceApplication } from "./external-integration-application.js";
export class ExternalIntegrationRuntime{
 #status:"CREATED"|"READY"|"STOPPED"="CREATED";
 public constructor(private readonly application:Pick<ExternalIntegrationEvidenceApplication,"execute">){if(typeof application?.execute!=="function")throw new Error("External Integration Application is unavailable.");}
 public get status():Readonly<{status:"CREATED"|"READY"|"STOPPED"}>{return Object.freeze({status:this.#status});} public get operations():readonly string[]{return EXTERNAL_INTEGRATION_OPERATIONS;}
 public start():Readonly<{status:"CREATED"|"READY"|"STOPPED"}>{if(this.#status!=="CREATED")throw new Error("External Integration Runtime lifecycle is invalid.");this.#status="READY";return this.status;}
 public execute(kind:ExternalIntegrationRequestKind,input:unknown,sessionId:string):Promise<ExternalIntegrationApplicationResult>{if(this.#status!=="READY")throw new Error("External Integration Runtime is not ready.");return this.application.execute(kind,input,sessionId);}
 public stop():Readonly<{status:"CREATED"|"READY"|"STOPPED"}>{if(this.#status!=="READY")throw new Error("External Integration Runtime lifecycle is invalid.");this.#status="STOPPED";return this.status;}
}
