import assert from "node:assert/strict";
import test from "node:test";
import { AdvisoryRuntime } from "./advisory-runtime.js";
import { DurableAdvisoryStore } from "./advisory-durable-persistence.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { advisoryTestPrompt as prompt, acceptedAdvisoryFixture } from "./advisory-persistence.test-fixtures.js";
import { adaptSynchronousAdvisoryPersistence } from "./advisory-async-persistence.js";

test("R3-B6 runtime waits for asynchronous persistence before generating and retains human-review evidence",async()=>{
 const directory=mkdtempSync(join(tmpdir(),"r3b6-runtime-"));const durable=new DurableAdvisoryStore({databasePath:join(directory,"advisory.sqlite")});const persistence=adaptSynchronousAdvisoryPersistence(durable);await persistence.registerPrompt(prompt);let generated=0;const fixture=acceptedAdvisoryFixture();const runtime=new AdvisoryRuntime({persistence,snapshotResolver:{resolve:()=>({tenantId:fixture.tenantId,scopeRef:fixture.scopeRef,subjectRef:fixture.envelope.subjectRef,provenance:fixture.envelope.provenance,inputClassifications:fixture.inputClassifications,inputFingerprint:fixture.inputFingerprint,evidenceFingerprint:fixture.evidenceFingerprint})},adapter:{adapterVersion:fixture.adapterVersion,generate:()=>{generated++;return fixture.envelope;}},clock:()=>new Date(fixture.generatedAt)});
 try{const request={tenantId:fixture.tenantId,scopeRef:fixture.scopeRef,capabilityId:fixture.capabilityId,schemaId:fixture.schemaId,inputReference:fixture.envelope.subjectRef,promptId:prompt.promptId,promptVersion:prompt.promptVersion,idempotencyKey:"r3b6-runtime"};const first=await runtime.execute(request);assert.equal(first.authority,"ADVISORY");assert.equal(first.reviewRequired,true);assert.ok(first.reviewEvidenceRef);assert.deepEqual(await runtime.execute(request),first);assert.equal(generated,1);assert.deepEqual(await runtime.read(first.tenantId,first.scopeRef,first.advisoryId),first);}finally{await persistence.close();rmSync(directory,{recursive:true,force:true});}
});

test("R3-B6 runtime snapshots request and trusted evidence before the first persistence await", async () => {
 const fixture = acceptedAdvisoryFixture();
 const snapshot = { tenantId: fixture.tenantId, scopeRef: fixture.scopeRef, subjectRef: structuredClone(fixture.envelope.subjectRef), provenance: fixture.envelope.provenance, inputClassifications: fixture.inputClassifications, inputFingerprint: fixture.inputFingerprint, evidenceFingerprint: fixture.evidenceFingerprint };
 const request = { tenantId: fixture.tenantId, scopeRef: fixture.scopeRef, capabilityId: fixture.capabilityId, schemaId: fixture.schemaId, inputReference: structuredClone(fixture.envelope.subjectRef), promptId: prompt.promptId, promptVersion: prompt.promptVersion, idempotencyKey: "mutable-runtime" };
 let resolve!: (value: typeof prompt) => void; const pendingPrompt = new Promise<typeof prompt>(r => { resolve = r; });
 const persistence = { findPrompt: () => pendingPrompt, findReplay: () => Promise.resolve(undefined), recordAccepted: (record: typeof fixture) => Promise.resolve(record), findAdvisory: () => Promise.resolve(undefined), registerPrompt: () => Promise.resolve(prompt), close: () => Promise.resolve() };
 const runtime = new AdvisoryRuntime({ persistence, snapshotResolver: { resolve: () => snapshot }, adapter: { adapterVersion: fixture.adapterVersion, generate: () => fixture.envelope }, clock: () => new Date(fixture.generatedAt) });
 const pending = runtime.execute(request); request.tenantId = "changed-tenant"; snapshot.inputFingerprint = "changed-evidence"; resolve(prompt);
 const result = await pending; assert.equal(result.tenantId, fixture.tenantId); assert.equal(result.inputFingerprint, fixture.inputFingerprint);
});

test("R3-B6 application results retain the validated principal evidence while runtime persistence waits", async () => {
 const { Ai001ListingParseApplicationService } = await import("./advisory-application-services.js"); const fixture = acceptedAdvisoryFixture();
 let resolve!: (value: typeof fixture) => void; const accepted = new Promise<typeof fixture>(r => { resolve = r; });
 const runtime = new AdvisoryRuntime({persistence:{} as never,snapshotResolver:{} as never,adapter:{} as never,clock:()=>new Date()});runtime.execute=()=>accepted;
 const service = new Ai001ListingParseApplicationService({runtime,binding:{capabilityVersion:"v1.0",promptId:prompt.promptId,promptVersion:prompt.promptVersion}});
 const input = {tenantId:fixture.tenantId,scopeRef:fixture.scopeRef,inputReference:fixture.envelope.subjectRef,correlationId:"correlation",idempotencyKey:"principal",initiatingPrincipalEvidenceRef:"principal-evidence:original",initiatingPrincipalProvenance:{kind:"IMMUTABLE_REFERENCE" as const,principalId:"user-a",evidenceRef:"principal-evidence:original"}};
 const pending=service.execute(input);input.initiatingPrincipalEvidenceRef="principal-evidence:changed";resolve(fixture);assert.equal((await pending).evidenceRefs.includes("principal-evidence:original"),true);assert.equal((await service.execute({...input,initiatingPrincipalEvidenceRef:"principal-evidence:next"})).evidenceRefs.includes("principal-evidence:next"),true);
});
