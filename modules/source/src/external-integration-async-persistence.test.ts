import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import * as source from "./index.js";
import type { DurableExternalIntegrationStore, IntegrationContract, ExternalMapping } from "./external-integration-durable-persistence.js";
const scope = { tenantId: "tenant-1", scopeType: "SOURCE" as const, scopeId: "source-1", connectorId: "connector-1", sourceId: "source-1" };
const binding = { ...scope, integrationContractId: "contract-1", providerNamespace: "provider-1", governedBindingRef: "governance:1", evidenceRef: "evidence:1", provisionedAt: "2026-10-02T00:00:00.000Z" };
const mapping = { ...scope, integrationContractId: "contract-1", providerNamespace: "provider-1", externalObjectId: "external-1", internalResourceType: "SOURCE", internalResourceId: "source-1", expectedVersion: 0, idempotencyKey: "mapping-1", inputFingerprint: "fp-1", evidenceRef: "evidence:mapping", recordedAt: binding.provisionedAt };
test("R3-B5 async SQLite persistence retains mapping replay across restart and rejects fingerprint reuse", async () => {
 const constructor = (source as unknown as Record<string, unknown>)["AsyncDurableExternalIntegrationStore"];
 assert.equal(typeof constructor, "function", "canonical async External persistence is required");
 interface Store { provisionContract(input: Parameters<DurableExternalIntegrationStore["provisionContract"]>[0]): Promise<IntegrationContract>; registerMapping(input: Parameters<DurableExternalIntegrationStore["registerMapping"]>[0]): Promise<ExternalMapping>; close(): Promise<void> };
 const Store = constructor as new (options: { databasePath: string }) => Store;
 const directory = mkdtempSync(join(tmpdir(), "r3b5-async-"));
 let store = new Store({ databasePath: join(directory, "external.sqlite") });
 try { await store.provisionContract(binding); const first = await store.registerMapping(mapping); assert.equal(first.version, 1); await store.close(); store = new Store({ databasePath: join(directory, "external.sqlite") }); assert.deepEqual(await store.registerMapping(mapping), first); await assert.rejects(store.registerMapping({ ...mapping, inputFingerprint: "different" }), { code: "IDEMPOTENCY_CONFLICT" }); }
 finally { await store.close(); rmSync(directory, { recursive: true, force: true }); }
});
test("R3-B5 PostgreSQL External persistence is available through the canonical module boundary", () => { assert.equal(typeof (source as unknown as Record<string, unknown>)["PostgreSqlExternalIntegrationStore"], "function"); });

test("R3-B5 SQLite async parity rejects moving an established external mapping to another contract",async()=>{
 const Constructor=(source as unknown as Record<string,unknown>)["AsyncDurableExternalIntegrationStore"] as new(options:{databasePath:string})=>{provisionContract(input:Parameters<DurableExternalIntegrationStore["provisionContract"]>[0]):Promise<IntegrationContract>;registerMapping(input:Parameters<DurableExternalIntegrationStore["registerMapping"]>[0]):Promise<ExternalMapping>;close():Promise<void>};
 const directory=mkdtempSync(join(tmpdir(),"r3b5-binding-"));const store=new Constructor({databasePath:join(directory,"external.sqlite")});try{await store.provisionContract(binding);await store.registerMapping(mapping);await store.provisionContract({...binding,integrationContractId:"other-contract"});await assert.rejects(store.registerMapping({...mapping,integrationContractId:"other-contract",expectedVersion:1,idempotencyKey:"other-contract-map",inputFingerprint:"other-contract-map"}),{code:"CONFLICT"});}finally{await store.close();rmSync(directory,{recursive:true,force:true});}
});
