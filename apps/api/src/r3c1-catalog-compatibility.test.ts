import assert from "node:assert/strict";
import test from "node:test";
import { R3C1_CATALOG_QUERY, R3C1_PERSISTENCE_CONTRACTS } from "./r3c1-postgresql-readiness.js";
import { R3C1_COMPATIBILITY_QUERY, R3C1_PG17_COMPONENT_CONTRACTS, r3c1CompatibleRowsReady, assertR3C1CatalogCompatibility } from "./r3c1-catalog-compatibility.js";
import type { PostgreSqlClientPort } from "../../../modules/identity/src/postgresql-pool.js";

function canonical(major = 17): Record<string,unknown>[] {
 return R3C1_PERSISTENCE_CONTRACTS.map(c=>({schema_name:c.schemaName,table_name:c.tableName,server_version_num:String(major*10000+11),authority_ok:true,fingerprint:major===18?c.fingerprint:"deliberately-unused-root-hash",component_hashes:{...R3C1_PG17_COMPONENT_CONTRACTS[c.schemaName]}}));
}
test("PG17 readiness proves every component without whitelisting alternate root hashes",()=>assert.equal(r3c1CompatibleRowsReady(canonical()),true));
test("PG18 retains historical exact hashes",()=>{ const rows=canonical(18); assert.equal(r3c1CompatibleRowsReady(rows),true); rows[0]!["fingerprint"]="c1c786ff6f6cdf844795a09a550a99f0"; assert.equal(r3c1CompatibleRowsReady(rows),false); });
for(const component of Object.keys(R3C1_PG17_COMPONENT_CONTRACTS["app_administration"]!)) {
 test(`PG17 rejects ${component} drift on every root`,()=>{
  for(let i=0;i<3;i++){const rows=canonical();(rows[i]!["component_hashes"] as Record<string,string>)[component]="00000000000000000000000000000000";assert.equal(r3c1CompatibleRowsReady(rows),false);}
 });
}
test("unknown, malformed and mixed server versions fail closed",()=>{
 for(const version of ["160011","190001",null,170011,"17","170011x","-170011"]){const rows=canonical();rows[0]!["server_version_num"]=version;assert.equal(r3c1CompatibleRowsReady(rows),false);}
});
test("missing, duplicate, extra and wrong root fail closed",()=>{
 const rows=canonical();assert.equal(r3c1CompatibleRowsReady(rows.slice(1)),false);assert.equal(r3c1CompatibleRowsReady([...rows,rows[0]!]),false);
 rows[0]!["table_name"]="unexpected";assert.equal(r3c1CompatibleRowsReady(rows),false);
 assert.equal(r3c1CompatibleRowsReady(canonical(),["unknown"]),false);
});
test("malformed or incomplete component contract fails closed",()=>{
 for(const value of [null,[],{},"hashes"]){const rows=canonical();rows[0]!["component_hashes"]=value;assert.equal(r3c1CompatibleRowsReady(rows),false);}
 const rows=canonical();(rows[0]!["component_hashes"] as Record<string,string>)["unexpected"]="hash";assert.equal(r3c1CompatibleRowsReady(rows),false);
});
test("authority and registration gate remain mandatory",()=>{
 const rows=canonical();rows[0]!["authority_ok"]=false;assert.equal(r3c1CompatibleRowsReady(rows),false);assert.equal(r3c1CompatibleRowsReady([]),false);
});
test("R3C2 child-root scope preserves separate post-014 Identity authority",()=>{
 const rows=canonical();rows[1]!["component_hashes"]={};assert.equal(r3c1CompatibleRowsReady(rows,["app_administration","app_organization"]),true);assert.equal(r3c1CompatibleRowsReady(rows),false);
});
test("malformed row fails closed",()=>assert.equal(r3c1CompatibleRowsReady([null] as unknown as Record<string,unknown>[]),false));
test("SQL preserves historical material and registration gate with only version-bounded constraints delta",()=>{
 const material=R3C1_CATALOG_QUERY.replace("md5(jsonb_build_object(","jsonb_build_object(").replace(")::text) AS fingerprint",") AS root_json").replace("WHERE k.conrelid=c.oid)","WHERE k.conrelid=c.oid AND (current_setting('server_version_num')::integer >= 180000 OR k.contype <> 'n'))");
 assert.ok(R3C1_COMPATIBILITY_QUERY.startsWith(`WITH material AS (${material})\n`));
 assert.ok(R3C1_COMPATIBILITY_QUERY.includes("a.attnotnull"));
 assert.ok(R3C1_COMPATIBILITY_QUERY.includes("registration_acl_ok"));
});
test("composition boundary performs one catalog read and fails closed on invalid readiness",async()=>{
 let rows=canonical();const queries:string[]=[];
 const client:PostgreSqlClientPort={query:async<R extends Record<string,unknown>>(sql:string)=>{await Promise.resolve();queries.push(sql);return {rows:rows as readonly R[],rowCount:rows.length};},release:()=>{throw Error("caller owns lease");}};
 await assertR3C1CatalogCompatibility(client,["app_administration","app_organization"]);
 assert.deepEqual(queries,[R3C1_COMPATIBILITY_QUERY]);
 rows=[];await assert.rejects(assertR3C1CatalogCompatibility(client));
});
