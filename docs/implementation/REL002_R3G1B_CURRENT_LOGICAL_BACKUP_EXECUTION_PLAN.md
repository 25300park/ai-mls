# REL-002 R3-G1B Current Logical Backup Execution Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-406 |
| 버전 / 상태 | v0.1 / DRAFT |
| 소유 역할 | Data/Backup / Operations / Security Owner |
| CANDIDATE_HEAD | 7f860258b3e4d290cf41c0e904d45e7d9c7985d6 |
| PROPOSED_WINDOW | REL002-R3G1B-013-AUDIT001-7f860258b3e4-PROPOSED-01 |
| 경로 | CONTROLLED_LOGICAL_PG_DUMP — AO 선택 |
| BACKUP_CREATION_AUTHORIZED / RESTORE_TEST_AUTHORIZED | NO / NO |

## 1. Objective / documents read / current facts

Human-confirmed provider facts: scheduled physical backups AVAILABLE, latest observed `2026-10-04 22:53:30 +00:00`; PITR NOT_ENABLED이며 add-on 활성화는 승인되지 않았다. 이 계획은 logical backup 설계이며 해당 scheduled backup을 새 logical backup 증거로 사용하지 않는다. Production query/backup/restore/migration 또는 Railway/Supabase config mutation을 수행하지 않는다.

Canonical authority:

- [Backup prerequisites](REL002_PHASE2C_BACKUP_RESTORE_PREREQUISITES.md)
- [Failure policy](REL002_PHASE2C_ROLLBACK_FAILURE_POLICY.md)
- [Role separation](REL002_PHASE2D0E_POSTGRESQL_ROLE_SEPARATION.md)
- [Direct connection contract](REL002_PHASE2D0B_RAILWAY_SUPABASE_RUNTIME_BINDING_DESIGN.md)
- [Current execution packet](REL002_R3G1B_PRODUCTION_MISSING_MIGRATION_CONTROLLED_EXECUTION_PACKET.md)
- [006/007 evidence](../evidence/REL002_PRODUCTION_HISTORICAL_ATTESTATION_EXECUTION_EVIDENCE.md)
- [011 evidence](../evidence/REL002_PRODUCTION_ROLE_BOUNDARY_EXECUTION_EVIDENCE.md)

Technical semantics checked against official PostgreSQL [pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html), [pg_dumpall](https://www.postgresql.org/docs/18/app-pg-dumpall.html), plus local client help. Technical capability is distinct from repository execution authority. Client/server major version compatibility must be confirmed before execution.

## 2. Backup operator authority — OPEN DECISION

BACKUP_OPERATOR=NOT_CANONICALIZED. Candidate is existing Human-controlled `postgres` administrative boundary, subject to explicit Data/Operations/Security approval and read-coverage preflight. No new role/grant is proposed. Existing administrative account/session does not itself approve backup execution. Repository role separation limits migration operator to separately approved controlled migrations, not generic full-database backup authority.

MIGRATION_OPERATOR_SUFFICIENT_FOR_FULL_BACKUP=NOT_VERIFIED. POSTGRES_ADMIN_REQUIRED=NOT_VERIFIED. A sufficiently authorized non-superuser can dump readable objects; managed postgres must not be assumed to bypass every Supabase-owned object or RLS boundary. Runtime/registration credentials must not be repurposed.

Required visibility includes all dumpable non-system schemas, schema definitions, application data, sequences/large objects where relevant, functions, constraints, indexes and owner/ACL metadata. SELECT/USAGE coverage and RLS/forced-RLS completeness must be reviewed without data/secret output. Any inaccessible required object or silently omitted rows makes the backup unsuitable. No automatic schema exclusions, row-security relaxation, privilege repair or credentials rotation.

Database/global coverage is separate. Database ownership does not imply access to cluster roles/password catalogs or other provider-managed resources. A new operational backup role or grant requires separate AO decision.

## 3. Coverage and format

| Item | Coverage by proposed full custom pg_dump |
|---|---|
| DATABASE_SCHEMA_DATA | COVERED — logical dumpable database contents; actual completeness pending authority/restore validation |
| DATABASE_OBJECT_OWNERS | COVERED as metadata; referenced roles must be separately present at restore |
| OBJECT_ACLS | COVERED; no --no-acl/--no-privileges suppression |
| DATABASE_ROLES | NOT_COVERED |
| ROLE_MEMBERSHIPS | NOT_COVERED |
| ROLE_PASSWORDS | NOT_COVERED; deliberately not captured separately |
| DATABASE_LEVEL_PRIVILEGES | COVERED in archive database metadata when restored using pg_restore --create; separately captured/compared in this plan |

pg_dump is not a physical provider backup and does not copy cluster configuration/provider control-plane/credential-manager state. Extensions and provider-managed objects require compatibility review; archive success alone does not establish full recovery coverage.

| Format | Assessment |
|---|---|
| custom | Recommended: one artifact SHA, pg_restore listing/selective inspection, Windows handling, retained owner/ACL metadata |
| directory | Valid technical alternative; multiple files require immutable manifest and per-file hashes; parallel dump adds connections/load |
| plain SQL | Inspectable but exposes data as text and less convenient selective restore; not preferred |

RECOMMENDED_FORMAT=CUSTOM. This is proposed for AO approval, not a previously frozen repository default. Compression is not encryption.

## 4. Secret-safe PowerShell command template — DO NOT EXECUTE

All placeholder inputs must be owner-approved. Destination, CA and passfile are protected operator-local files outside repository/sync/shared locations. The passfile is preprovisioned securely by Human/Ops; this script does not write passwords. Local file permissions and encryption/key availability are verified before execution. No password/URI or CA content is printed, no --verbose, and diagnostics remain protected rather than copied to shareable logs.

```powershell
$pgDumpExe = '<approved-pg_dump.exe>'
$backupRole = '<AO-approved-backup-account>'
$backupFile = '<protected-local-destination>/current-production.dump'
$passFile = '<existing-protected-passfile>'
$caFile = '<approved-protected-CA-file>'

# Run only in an approved dedicated operator environment.
# Refuse unexpected routing/configuration or environment password sources.
foreach ($key in @('PGSERVICE','PGSERVICEFILE','PGHOSTADDR','PGOPTIONS','PGPASSWORD')) {
    if ([Environment]::GetEnvironmentVariable($key)) {
        throw 'BACKUP_ENVIRONMENT_NOT_APPROVED'
    }
}
if (Test-Path -LiteralPath $backupFile) { throw 'BACKUP_DESTINATION_EXISTS' }
if (-not (Test-Path -LiteralPath $passFile)) { throw 'PASSFILE_MISSING' }
if (-not (Test-Path -LiteralPath $caFile)) { throw 'CA_FILE_MISSING' }
$previousPassFile = $env:PGPASSFILE
$previousSslMode = $env:PGSSLMODE
$previousSslRoot = $env:PGSSLROOTCERT
try {
    $env:PGPASSFILE = $passFile
    $env:PGSSLMODE = 'verify-full'
    $env:PGSSLROOTCERT = $caFile
    $startedAt = [DateTimeOffset]::UtcNow
    & $pgDumpExe --host='db.mfonujjeokvpsfucfxuq.supabase.co' `
        --port=5432 --username=$backupRole --dbname=postgres `
        --format=custom --no-password --file=$backupFile
    $dumpExitCode = $LASTEXITCODE
    $completedAt = [DateTimeOffset]::UtcNow
    if ($dumpExitCode -ne 0) { throw 'LOGICAL_BACKUP_FAILED' }
    $backupSha256 = (Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash
    $backupSize = (Get-Item -LiteralPath $backupFile).Length
    # Record only approved non-secret evidence fields/protected reference.
    # Do not print archive contents, connection URI, credentials or passfile.
} finally {
    $env:PGPASSFILE = $previousPassFile
    $env:PGSSLMODE = $previousSslMode
    $env:PGSSLROOTCERT = $previousSslRoot
}
```

No --no-owner/--no-acl/schema/table/data exclusions. Backup performs reads and locks; it is not migration DDL/DML and not zero operational load. Output status/warnings must be reviewed; exit 0 alone is insufficient. Failed/partial artifacts are quarantined, not labeled valid. No automatic retry.

Security prerequisite: full database data may contain identity/session material, password hashes or provider configuration. Never claim the archive is secret-free. Data/Backup/Security owner must establish that plaintext credentials are not being exported. If that cannot be shown, STOP for a governed backup/privacy decision; do not silently redact consistency-critical rows. Classify the archive as SECRET/RESTRICTED, protect at rest, and never commit/share it. Connection secrets/role passwords are not deliberately added to dump output.

## 5. Global role / ACL preservation

Preferred GLOBAL_STATE_CAPTURE_METHOD=read-only allowlisted catalog evidence, without role passwords. Capture:

- pg_roles: rolname, login/super/createDB/createRole/inherit/replication/bypassRLS flags, rolconnlimit, rolvaliduntil; only a boolean for nonempty rolconfig, never raw configuration values or rolpassword.
- pg_auth_members: exact role/member/grantor/admin/inherit/set tuples touching approved AI-MLS roles, and all additional roles referenced by database owner/ACL metadata.
- pg_database: postgres owner plus exploded database ACL, direct versus PUBLIC privileges; settings only under non-secret allowlist.
- Object owners/ACL/default privileges and inventory needed to validate 011; schema/table/routine/sequence metadata compared with archive restore.

Unexpected membership/configuration or unidentified referenced roles require review. Evidence is non-password RESTRICTED operational metadata, stored under protected reference with SHA; not automatically public or committed. GLOBAL_STATE_CONTAINS_SECRETS=NO for this strict selected-field mechanism. Missing role properties cannot be interpreted as defaults.

Optional pg_dumpall --globals-only --no-role-passwords can produce a separate protected artifact after explicit approval. It covers broader cluster objects and can contain other sensitive settings/paths; it is not automatically shareable or executable. Without --no-role-passwords, password hashes may be included: classify SECRET and do not capture in this plan. Neither option supplies database contents. No Production globals command is executed or approved here.

017 is preserved through exact registration-role attributes, CONNECT/database ACL and observed memberships, not by replaying 017. 011 is preserved through its final canonical ACL/membership state, not rerunning historical recovery SQL. Roles needed to restore owners/ACLs are re-established only in the approved isolated target with no Production passwords. Original runtime credential/binding availability remains a separate Human/Ops protected recovery responsibility.

## 6. Preflight probes — read-only design, NOT EXECUTED

First, Human verifies external project/ref/direct endpoint/CA and candidate/window binding. SQL database name alone cannot prove Supabase project identity or client verify-full. Use the same approved backup account for coverage probes and dump; pg_dump opens its own connection, so no claim of same backend PID.

```sql
SELECT pg_backend_pid() AS backend_pid, current_user, session_user,
       current_database(), current_setting('server_version') AS server_version;
SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid();

SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='app_identity')
         AS identity_schema_present,
       NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='app_audit')
         AS audit_schema_absent,
       EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='app_identity'
                 AND c.relname='identity_registered_service_workloads'
                 AND c.relkind='r') AS registration_table_present,
       NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                    WHERE n.nspname='app_identity'
                      AND c.relname='identity_workload_evidence') AS identity_proof_absent;

SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,
       rolreplication,rolbypassrls,rolconnlimit,rolvaliduntil,
       rolconfig IS NOT NULL AS has_role_configuration
FROM pg_roles WHERE rolname IN (
 'ai_mls_production_runtime','ai_mls_production_migration_operator',
 'ai_mls_production_registration_operator');

SELECT n.nspname,c.relname,pg_get_userbyid(n.nspowner) AS schema_owner,
       pg_get_userbyid(c.relowner) AS object_owner,c.relkind,
       c.relrowsecurity,c.relforcerowsecurity,
       has_schema_privilege(current_user,n.oid,'USAGE') AS schema_read_path,
       has_table_privilege(current_user,c.oid,'SELECT') AS table_read_path
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
  AND c.relkind IN ('r','p','m','f') ORDER BY n.nspname,c.relname;

SELECT n.nspname,c.relname,
       has_sequence_privilege(current_user,c.oid,'SELECT') AS sequence_read_path
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind='S' AND n.nspname !~ '^pg_';

-- No direct registration operator schema/table ACL from 018 is expected.
SELECT n.nspname,a.privilege_type,a.is_grantable
FROM pg_namespace n CROSS JOIN LATERAL aclexplode(
 coalesce(n.nspacl,acldefault('n',n.nspowner))) a
JOIN pg_roles r ON r.oid=a.grantee
WHERE n.nspname IN ('app_identity','app_audit')
  AND r.rolname='ai_mls_production_registration_operator';
SELECT n.nspname,c.relname,a.privilege_type,a.is_grantable
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
JOIN pg_roles r ON r.oid=a.grantee
WHERE n.nspname IN ('app_identity','app_audit')
  AND r.rolname='ai_mls_production_registration_operator';
```

Baseline booleans must pass, roles exactly match canonical attributes, and two registration direct-ACL queries return zero rows. Missing 013/Audit roots means 018 is not ready; do not call its verifier against missing relations and interpret an error as evidence. Inspect column ACL and effective inherited privileges as part of final ACL evidence; direct grant absence alone does not prove every privilege is denied.

006/007: first verify the attestation table/function inventory exists. Then use the approved read-only [008 verifier](../../modules/identity/migrations/postgresql/production/008_historical_identity_migration_attestation_v1.verify.sql) and bounded canonical attestation tuple:

```sql
SELECT migration_id,artifact_checksum,contract_id,schema_version,database_engine,
       contract_fingerprint,target_environment,historical_applied_at_known,
       evidence_recorded_at,operator_evidence_ref,backup_evidence_ref,
       schema_verification_evidence_ref,reason,result
FROM app_identity.identity_historical_migration_attestations
WHERE migration_id='REL002-P2D0B-IDENTITY-PG-V1';
```

Exactly one expected immutable tuple must match committed evidence; don't dump arbitrary human/session rows. 011: capture exact final role/database/object ACL and managed membership tuples using the relevant SELECT blocks of [004 verifier](../../modules/identity/migrations/postgresql/production/004_production_role_privilege_verification.sql) and canonical role-boundary evidence. 017: registration role must exist with LOGIN and prohibited attributes absent. Nothing recreates schema/roles/grants in Production.

Snapshot/currentness: preflight/globals and pg_dump are not automatically one transaction-consistent snapshot. Record timestamps and arrange an approved quiet schema/role/ACL window, compare pre/post inventories and relevant 007 tuple. Concurrent or unexplained changes require reconciliation before evidence finalization. No inferred TTL or unapproved locking/mutation to force consistency.

## 7. Backup artifact evidence design

All fields remain NOT_CREATED / NOT_EXECUTED until actual separately approved execution:

BACKUP_ID; CANDIDATE_HEAD; EXECUTION_WINDOW_ID; SOURCE_PROJECT_REF; SOURCE_DATABASE;
BACKUP_OPERATOR; STARTED_AT; COMPLETED_AT; FORMAT; FILE_PATH_OR_PROTECTED_REFERENCE;
FILE_SIZE; SHA256; PG_DUMP_VERSION; SERVER_VERSION; TLS_MODE; CA_REFERENCE;
EXIT_CODE; PREFLIGHT_RESULT; GLOBAL_STATE_EVIDENCE_REF/SHA256; PRE_POST_DRIFT_RESULT;
CLASSIFICATION; RECOVERY_KEY_AVAILABILITY; OWNER_APPROVAL_REF; RESTORE_EVIDENCE_REF.

Shared documentation stores protected reference only, not local backup path, password, connection URI, CA body, raw rows or credentials. BACKUP_ID is assigned at approved preparation, not invented executed evidence. Hash each evidence artifact and immutable manifest; integrity hash does not encrypt data or prove restore success.

## 8. Isolated restore validation design

1. Separate authorization selects fresh non-Production isolated target, approved compatible PostgreSQL/extensions, protected storage and network isolation. Production endpoints/credentials/listener/workers/provider calls are prohibited.
2. Verify archive/global-evidence SHA and protected recovery-key access. pg_restore --list is local archive readability/TOC inspection only, not successful restore proof. Review source code/extensions before executing restored functions.
3. Account for referenced roles from selected non-password global evidence. Establish exact role/ACL/membership state under isolated-target approval; do not blindly run provider-global SQL, 011 or 017. No source passwords are restored. Provider-only roles/objects that cannot be faithfully represented require documented gap and gate BLOCKED.
4. Restore full custom archive with owners/ACLs retained and fail-on-error. pg_restore --create also restores database metadata/ACL; use only a fresh isolated target where archived database name postgres is absent, with a separately prepared maintenance database. If postgres already exists, STOP: no automatic --clean/drop. Alternative empty-database restore requires explicitly mapping/re-establishing database-level owner/ACL from globals evidence and separate approval.
5. Compare complete relevant inventories/constraints/indexes/functions/triggers/owners/ACLs and approved data integrity evidence, including sequences/large objects if present. 006 schema/function and exact 007 tuple must match. Account separately for 011 final global topology and 017 role/CONNECT. Confirm identity_workload_evidence and app_audit remain absent: no 013/Audit001 execution in this rehearsal.
6. Verify current candidate/window/recovery point consistency and zero unexplained drift. Capture elapsed time, operator/result, artifact hashes, limitations and protected evidence refs. Isolated-target cleanup/retention is separately approved. No Production restore.

RESTORE_VALIDATION_PLAN_READY=YES — design only, dependencies and actual restore eligibility NOT_VERIFIED.

## 9. Validation / open decisions / next prerequisites

One design document created; no runtime source, historical evidence, migration, verifier or index modified. Checks: local CLI help, official primary technical documentation, relative links, whitespace, secret-literal scan and task scope. No Production/local database backup or restore performed.

OPEN DECISION: named backup account approval/read completeness, protected destination/key/retention, plaintext credential export prohibition evidence, actual server version, managed extension/global compatibility, quiet window and separate backup/restore execution authorization. No policy, role/grant or numeric freshness threshold is invented.

BACKUP_GATE=BLOCKED_BACKUP_NOT_CREATED. BACKUP_CREATION_AUTHORIZED=NO. RESTORE_TEST_AUTHORIZED=NO. EXECUTION_AUTHORIZED=NO. SAFE_TO_EXECUTE=NO. SAFE_TO_RETRY_018=NO. Production mutation=NONE. Commit=NOT_CREATED. Push=NOT_PERFORMED.
