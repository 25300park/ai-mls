import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getSystemErrorMap } from "node:util";
import { classifyPhysicalConnectionFailure, diagnoseProductionDatabaseDnsFamilies } from "./production-connection-diagnostics.js";

for (const [code, expected] of [
  ["ENOTFOUND", "DNS_NOT_FOUND"], ["EAI_AGAIN", "DNS_TEMPORARY_FAILURE"],
  ["ENETUNREACH", "NETWORK_UNREACHABLE"], ["EHOSTUNREACH", "NETWORK_UNREACHABLE"],
  ["ECONNREFUSED", "CONNECTION_REFUSED"], ["ETIMEDOUT", "CONNECTION_TIMEOUT"], ["ECONNRESET", "CONNECTION_RESET"],
  ["CERT_HAS_EXPIRED", "TLS_CERTIFICATE_FAILURE"], ["ERR_TLS_CERT_ALTNAME_INVALID", "TLS_CERTIFICATE_FAILURE"],
  ["UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "TLS_CERTIFICATE_FAILURE"], ["ERR_SSL_WRONG_VERSION_NUMBER", "TLS_HANDSHAKE_FAILURE"],
  ["EPROTO", "TLS_HANDSHAKE_FAILURE"], ["28P01", "POSTGRES_SERVER_ERROR"],
]) test(`physical connection allowlist: ${code}`, () => {
  const result = classifyPhysicalConnectionFailure({ code, message: "DO_NOT_LOG", address: "DO_NOT_LOG", hostname: "DO_NOT_LOG" });
  assert.equal(result.transportCode, expected);
  assert.equal(result.sqlstate, code === "28P01" ? code : null);
  assert.doesNotMatch(JSON.stringify(result), /DO_NOT_LOG/u);
});

test("nested and aggregate errors are bounded, code-only and ambiguity fails closed", () => {
  assert.equal(classifyPhysicalConnectionFailure({cause:{code:"ENETUNREACH"}}).transportCode,"NETWORK_UNREACHABLE");
  assert.equal(classifyPhysicalConnectionFailure(new AggregateError([{code:"ENETUNREACH"},{code:"ENETUNREACH"}])).transportCode,"NETWORK_UNREACHABLE");
  assert.equal(classifyPhysicalConnectionFailure(new AggregateError([{code:"ENETUNREACH"},{code:"ETIMEDOUT"}])).transportCode,"UNKNOWN_CONNECTION_FAILURE");
  assert.equal(classifyPhysicalConnectionFailure({cause:{code:"42501"}}).sqlstate,"42501");
  assert.equal(classifyPhysicalConnectionFailure({errno:"ECONNRESET"}).transportCode,"CONNECTION_RESET");
  const cyclic:{cause?:unknown}={};cyclic.cause=cyclic;
  assert.equal(classifyPhysicalConnectionFailure(cyclic).transportCode,"UNKNOWN_CONNECTION_FAILURE");
  assert.equal(classifyPhysicalConnectionFailure(new AggregateError(Array.from({length:20},()=>({code:"ENETUNREACH"})))).transportCode,"UNKNOWN_CONNECTION_FAILURE");
});

test("unknown errors and accessors never expose raw properties", () => {
  for(const code of ["DO_NOT_LOG", "toString", "__proto__", undefined]) {
    const result=classifyPhysicalConnectionFailure({code,message:"DO_NOT_LOG_PASSWORD",stack:"DO_NOT_LOG_URI",address:"DO_NOT_LOG_IP",hostname:"DO_NOT_LOG_HOST",cause:{code:"DO_NOT_LOG_CA"}});
    assert.deepEqual(result,{transportCode:"UNKNOWN_CONNECTION_FAILURE",sqlstate:null});
    assert.doesNotMatch(JSON.stringify(result),/DO_NOT_LOG/u);
  }
  let accessed=false;
  const error=Object.defineProperties({}, {code:{get:()=>{accessed=true;throw Error("DO_NOT_LOG");}},message:{get:()=>{accessed=true;throw Error("DO_NOT_LOG");}}});
  assert.equal(classifyPhysicalConnectionFailure(error).transportCode,"UNKNOWN_CONNECTION_FAILURE");assert.equal(accessed,false);
});

test("native numeric errno is classified through the platform error-name map only", () => {
  const errno=[...getSystemErrorMap()].find(([, value])=>value[0]==="ENETUNREACH")?.[0];
  assert.ok(typeof errno==="number");
  assert.deepEqual(classifyPhysicalConnectionFailure({errno}),{transportCode:"NETWORK_UNREACHABLE",sqlstate:null});
});

test("DNS family diagnostics return only booleans and never resolved addresses", async () => {
  for(const [families,ipv4,ipv6] of [[[],false,false],[[4],true,false],[[6],false,true],[[4,6],true,true]] as const) {
    const result=await diagnoseProductionDatabaseDnsFamilies(()=>Promise.resolve(families.map(family=>({family,address:"DO_NOT_LOG_IP"}))));
    assert.deepEqual(result,{dnsIPv4Available:ipv4,dnsIPv6Available:ipv6});assert.doesNotMatch(JSON.stringify(result),/DO_NOT_LOG/u);
  }
  assert.deepEqual(await diagnoseProductionDatabaseDnsFamilies(()=>Promise.reject(Error("DO_NOT_LOG_HOST"))),{dnsIPv4Available:null,dnsIPv6Available:null});
});

test("DNS inspection is separate from pool and readiness decisions", () => {
  const pool=readFileSync("apps/api/src/production-runtime-pool.ts","utf8");
  assert.doesNotMatch(pool,/setDefaultResultOrder|autoSelectFamily/u);
  assert.match(pool,/classifyPhysicalConnectionFailure/u);
});

test("DNS observation deadline returns null for unresolved lookup", async()=>{ assert.deepEqual(await diagnoseProductionDatabaseDnsFamilies(()=>new Promise(()=>undefined)),{dnsIPv4Available:null,dnsIPv6Available:null}); });
