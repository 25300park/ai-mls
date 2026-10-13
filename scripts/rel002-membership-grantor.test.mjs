import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { prepareBootstrapControl,GOVERNED_MEMBERSHIP_ROLES,assertExactFixtureMemberships,provisionFixtureMemberships,EXACT_MEMBERSHIP_QUERY } from './rel002-membership-grantor.mjs';
const expected=[...GOVERNED_MEMBERSHIP_ROLES].sort().map(granted_role=>({granted_role,member_role:'postgres',grantor_role:'supabase_admin',admin_option:true,inherit_option:false,set_option:false}));
test('direct bootstrap supabase_admin provisions exact three rows without SET ROLE',async()=>{
 const queries=[];const client={query:async sql=>{queries.push(sql);return{rows:sql===EXACT_MEMBERSHIP_QUERY?expected:sql.startsWith('SELECT current_user')?[{current_user:'supabase_admin',session_user:'supabase_admin',role_oid:10}]:[]};}};
 assert.deepEqual(await provisionFixtureMemberships(client),expected);
 assert.equal(queries.filter(sql=>sql.startsWith('GRANT ')).length,3);
 assert.ok(queries.filter(sql=>sql.startsWith('GRANT ')).every(sql=>sql.endsWith('WITH ADMIN TRUE, INHERIT FALSE, SET FALSE GRANTED BY supabase_admin')));
 assert.ok(queries.every(sql=>!sql.includes('SET ROLE')));
});
for(const identity of [{current_user:'postgres',session_user:'postgres',role_oid:10},{current_user:'supabase_admin',session_user:'postgres',role_oid:10},{current_user:'supabase_admin',session_user:'supabase_admin',role_oid:123}])test(`reject grant session ${JSON.stringify(identity)}`,async()=>{
 const queries=[];await assert.rejects(provisionFixtureMemberships({query:async sql=>{queries.push(sql);return{rows:[identity]};}}));assert.equal(queries.length,1);
});
for(const change of [{grantor_role:'postgres'},{member_role:'supabase_admin'},{admin_option:false},{inherit_option:true},{set_option:true}])test(`catalog contract rejects ${JSON.stringify(change)}`,()=>assert.throws(()=>assertExactFixtureMemberships(expected.map((row,i)=>i===0?{...row,...change}:row))));
test('extra and missing memberships fail',()=>{assert.throws(()=>assertExactFixtureMemberships(expected.slice(1)));assert.throws(()=>assertExactFixtureMemberships([...expected,expected[0]]));});
test('full harness must initialize bootstrap grantor and use exact helper',async()=>{
 const source=await readFile('scripts/rel002-local-registration-live.mjs','utf8');
 assert.ok(source.includes("'-U','supabase_admin'"));assert.ok(source.includes('provisionFixtureMemberships(grantor)'));
 assert.ok(!source.includes('CREATE ROLE supabase_admin'));
});

test('bootstrap physical identity is verified before control-role mutation',async()=>{
 const base={current_user:'supabase_admin',session_user:'supabase_admin',oid:10,database:'postgres',port:55469,address:'127.0.0.1/32',version:'170011',directory:'C:/owned/cluster'};
 for(const change of [{port:5432},{address:'127.0.0.2'},{directory:'C:/other/cluster'},{oid:123},{version:'180004'},{session_user:'postgres'}]){
  const queries=[];const client={query:async sql=>{queries.push(sql);return {rows:[{...base,...change}]};}};
  await assert.rejects(()=>prepareBootstrapControl(client,{dataDirectory:base.directory,port:55469,password:'a'.repeat(64)}));assert.equal(queries.length,1);
 }
 const queries=[];const client={query:async sql=>{queries.push(sql);return{rows:[base]};}};
 await prepareBootstrapControl(client,{dataDirectory:base.directory,port:55469,password:'a'.repeat(64)});
 assert.equal(queries.length,4);assert.ok(!queries.some(sql=>/SET ROLE/.test(sql)));
});
