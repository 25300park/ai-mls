import { resolve } from 'node:path';
// Local fixture only: the bootstrap grantor is required to avoid extra ADMIN memberships.
import assert from 'node:assert/strict';
export const GOVERNED_MEMBERSHIP_ROLES=Object.freeze(['ai_mls_production_migration_operator','ai_mls_production_runtime','ai_mls_production_registration_operator']);
export const EXACT_MEMBERSHIP_QUERY=`SELECT r.rolname AS granted_role,u.rolname AS member_role,g.rolname AS grantor_role,
 m.admin_option,m.inherit_option,m.set_option FROM pg_auth_members m
 JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles u ON u.oid=m.member JOIN pg_roles g ON g.oid=m.grantor
 WHERE r.rolname=ANY($1) OR u.rolname=ANY($1) ORDER BY r.rolname`;
export function assertExactFixtureMemberships(rows){
 assert.equal(rows.length,3,'EXACT_THREE_MEMBERSHIPS_REQUIRED');
 assert.deepEqual(rows.map(row=>({...row})),[...GOVERNED_MEMBERSHIP_ROLES].sort().map(granted_role=>({granted_role,member_role:'postgres',grantor_role:'supabase_admin',admin_option:true,inherit_option:false,set_option:false})),'EXACT_MEMBERSHIP_CONTRACT_REQUIRED');
}
export async function provisionFixtureMemberships(grantor){
 const rows=(await grantor.query('SELECT current_user,session_user,(SELECT oid FROM pg_roles WHERE rolname=current_user) AS role_oid')).rows;
 assert.equal(rows.length,1,'DIRECT_GRANTOR_REQUIRED');
 assert.equal(rows[0].current_user,'supabase_admin','DIRECT_GRANTOR_REQUIRED');
 assert.equal(rows[0].session_user,'supabase_admin','DIRECT_GRANTOR_REQUIRED');
 assert.equal(rows[0].role_oid,10,'BOOTSTRAP_GRANTOR_REQUIRED');
 for(const role of GOVERNED_MEMBERSHIP_ROLES)await grantor.query(`GRANT ${role} TO postgres WITH ADMIN TRUE, INHERIT FALSE, SET FALSE GRANTED BY supabase_admin`);
 const memberships=(await grantor.query(EXACT_MEMBERSHIP_QUERY,[GOVERNED_MEMBERSHIP_ROLES])).rows;
 assertExactFixtureMemberships(memberships);return memberships;
}

export async function prepareBootstrapControl(bootstrap,{dataDirectory,port,password}){
 const rows=(await bootstrap.query("SELECT current_user,session_user,current_database() AS database,current_setting('data_directory') AS directory,current_setting('server_version_num') AS version,inet_server_addr()::text AS address,inet_server_port() AS port,(SELECT oid FROM pg_roles WHERE rolname=current_user) AS oid")).rows;
 assert.equal(rows.length,1);const row=rows[0];
 assert.equal(row.current_user,'supabase_admin');assert.equal(row.session_user,'supabase_admin');assert.equal(row.oid,10);
 assert.equal(row.database,'postgres');assert.equal(row.port,port);assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535&&port!==5432);
 assert.ok(['127.0.0.1','127.0.0.1/32'].includes(row.address));assert.match(row.version,/^17\d{4}$/);
 assert.equal(resolve(row.directory).toLowerCase(),resolve(dataDirectory).toLowerCase());assert.match(password,/^[a-f0-9]{64}$/);
 await bootstrap.query('CREATE ROLE postgres LOGIN SUPERUSER CREATEDB CREATEROLE INHERIT REPLICATION BYPASSRLS');
 await bootstrap.query('ALTER DATABASE postgres OWNER TO postgres');
 await bootstrap.query(`ALTER ROLE supabase_admin NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
 return row;
}
