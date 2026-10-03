import assert from "node:assert/strict";
import test from "node:test";
import { assertFresh, hasFreshProductionMfa, ProductionTrustedBindingResolver } from "./production-trusted-binding.js";
import type { ProductionBoundSessionRecord } from "../../../modules/identity/src/production-session-binding.js";
import { AuthenticationError } from "../../../modules/identity/src/session-service.js";
import { AuditLog } from "../../../modules/audit/src/audit-log.js";
const freshness={IDLE_TIMEOUT_MILLISECONDS:60000,ABSOLUTE_LIFETIME_MILLISECONDS:120000,MFA_FRESHNESS_MILLISECONDS:30000};
const record:ProductionBoundSessionRecord={id:"s",principalId:"p",principalType:"HUMAN",roles:[],state:"ACTIVE",assurance:"SINGLE_FACTOR",isMfaVerified:false,familyId:"f",refreshReference:"private",sessionVersion:1,tenantId:"tenant",teamId:"team",tenantBindingOrigin:"AUTHENTICATED_PRINCIPAL_TENANT",teamBindingOrigin:"EXPLICIT_TEAM_SELECTION_VALIDATED",issuedAt:"2026-10-03T00:00:00.000Z",lastAccessedAt:"2026-10-03T00:00:00.000Z",auditEvidenceRef:"audit"};
test("bound Session freshness rejects revoked, expired, idle, absolute and future timestamps",()=>{
  assertFresh(record,new Date("2026-10-03T00:00:01.000Z"),freshness);
  for(const state of ["REVOKED","EXPIRED"] as const)assert.throws(()=>assertFresh({...record,state},new Date(record.issuedAt),freshness));
  for(const instant of ["2026-10-03T00:01:00.000Z","2026-10-03T00:02:00.000Z","2026-10-02T23:59:59.000Z"])assert.throws(()=>assertFresh(record,new Date(instant),freshness));
  assert.throws(()=>assertFresh({...record,lastAccessedAt:"2026-10-03T00:02:00.000Z"},new Date(record.issuedAt),freshness));
});
test("initial Session read and acquisition failures are safe authentication failures",async()=>{
  const options={expectedTenantId:"tenant",freshness,clock:()=>new Date(record.issuedAt),auditSink:new AuditLog({clock:()=>new Date(record.issuedAt),idFactory:()=>"audit"}),authorizationPolicyVersion:"policy"};
  const request={sessionId:"s",action:"property.read",resource:{type:"Property",id:"property",tenantId:"tenant",teamId:"team"},purpose:"PROPERTY_ADMINISTRATION",correlationId:"correlation"};
  const failures=[{connect:()=>Promise.reject(new Error("private database details")),close:()=>Promise.resolve()}, {connect:()=>Promise.resolve({query:()=>Promise.reject(new Error("private SQL")),release(){return;}}),close:()=>Promise.resolve()}];
  for(const pool of failures){
    const resolver=new ProductionTrustedBindingResolver({...options,pool});
    await assert.rejects(resolver.resolveAuthorized(request),error=>error instanceof AuthenticationError && error.code==="AUTHENTICATION_REQUIRED" && !error.message.includes("private"));
  }
  assert.throws(()=>new ProductionTrustedBindingResolver({...options,pool:failures[0]!,freshness:{...freshness,IDLE_TIMEOUT_MILLISECONDS:0}}));
});
test("MFA assurance and explicit Production freshness are revalidated without defaults",()=>{
  const mfa={...record,assurance:"MFA" as const,isMfaVerified:true,lastMfaVerifiedAt:record.issuedAt};
  assert.equal(hasFreshProductionMfa(mfa,new Date("2026-10-03T00:00:30.000Z"),freshness),true);
  assert.equal(hasFreshProductionMfa(mfa,new Date("2026-10-03T00:00:30.001Z"),freshness),false);
  assert.equal(hasFreshProductionMfa(mfa,new Date("2026-10-02T23:59:59.000Z"),freshness),false);
  assert.equal(hasFreshProductionMfa(record,new Date(record.issuedAt),freshness),false);
  assert.equal(hasFreshProductionMfa({...mfa,isMfaVerified:false},new Date(record.issuedAt),freshness),false);
});
