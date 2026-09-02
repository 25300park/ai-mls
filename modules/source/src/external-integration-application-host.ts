import type { ExternalIntegrationRequestKind } from "./external-integration-api-contracts.js";
import type { ExternalIntegrationApplicationResult } from "./external-integration-application.js";
import type { ExternalIntegrationRuntime } from "./external-integration-runtime.js";
export class ExternalIntegrationApplicationHost{
 #runtime:ExternalIntegrationRuntime|undefined;#status:"CREATED"|"READY"|"STOPPED"="CREATED";
 public constructor(private readonly factory:()=>ExternalIntegrationRuntime){} public get status():Readonly<{status:"CREATED"|"READY"|"STOPPED"}>{return Object.freeze({status:this.#status});}
 public start():Readonly<{status:"CREATED"|"READY"|"STOPPED"}>{if(this.#status!=="CREATED")throw new Error("External Integration Host lifecycle is invalid.");this.#runtime=this.factory();this.#runtime.start();this.#status="READY";return this.status;}
 public execute(kind:ExternalIntegrationRequestKind,input:unknown,sessionId:string):ExternalIntegrationApplicationResult{if(this.#status!=="READY"||this.#runtime===undefined)throw new Error("External Integration Host is not ready.");return this.#runtime.execute(kind,input,sessionId);}
 public stop():Readonly<{status:"CREATED"|"READY"|"STOPPED"}>{if(this.#status!=="READY"||this.#runtime===undefined)throw new Error("External Integration Host lifecycle is invalid.");this.#runtime.stop();this.#status="STOPPED";return this.status;}
}
