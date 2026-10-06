# REL-002 R3-G1B Current Logical Backup Evidence

| 항목 | 값 |
|---|---|
| Evidence ID | REL002-R3G1B-CURRENT-LOGICAL-BACKUP-001 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 범위 | Human-reported backup binding / isolated restore design only |
| Backup artifact classification | RESTRICTED |
| Restore validation | PENDING |

## 1. Authority / provenance

현재 Human이 제공한 사실을 [logical backup plan](../implementation/REL002_R3G1B_CURRENT_LOGICAL_BACKUP_EXECUTION_PLAN.md) 및 [controlled execution packet](../implementation/REL002_R3G1B_PRODUCTION_MISSING_MIGRATION_CONTROLLED_EXECUTION_PACKET.md)에 연결한다. archive를 열거나 복사하지 않았으며 bytes/hash를 독립적으로 재측정하지 않았다. BACKUP_BINDING=PASS는 아래 exact candidate/artifact 식별 사실의 문서 연결에 한정한다. backup completeness, currentness 승인, restore 성공 또는 Production 실행 승인을 의미하지 않는다. historical evidence는 변경하지 않는다.

## 2. Human-confirmed backup binding

| Field | Value |
|---|---|
| CANDIDATE_HEAD | 976a1de1b4dbbd6fe8958fec9239a8178aae0990 |
| PROPOSED_WINDOW | REL002-R3G1B-013-AUDIT001-976a1de1b4db-PROPOSED-01 |
| WINDOW_APPROVED | NO |
| SOURCE_PROJECT | ai-mls-production |
| SOURCE_PROJECT_REF | mfonujjeokvpsfucfxuq |
| SOURCE_DATABASE | postgres |
| SOURCE_DATABASE_VERSION | 17.6 |
| PG_DUMP_VERSION | 18.4 |
| BACKUP_FILE_NAME | ai-mls-production-pre013-audit001-20261005-223349.dump |
| BACKUP_SIZE_BYTES | 391501 |
| BACKUP_SHA256 | CD16C5E5E61A65551DE7E497A1B2D3E3621F3C65A547A895BB7DC98E6BDE587F |
| ARCHIVE_CREATED_AT | 2026-10-05 22:33:53 |
| TIMESTAMP_TIMEZONE | NOT_VERIFIED — Human 제공 없음 |
| BACKUP_FORMAT | CUSTOM |
| TOC_ENTRIES | 608 |
| PG_RESTORE_LIST_EXIT | 0 — Human-reported |
| BACKUP_OPERATOR | NOT_VERIFIED |
| ACTUAL_TLS_MODE | NOT_VERIFIED |
| ACTUAL_CA_REFERENCE | NOT_VERIFIED |
| INTENDED_TLS_MODE | verify-full — approved design, 실제 실행 증명과 구분 |
| PROTECTED_ARTIFACT_REFERENCE | NOT_SUPPLIED — 파일명만 기록 |
| BACKUP_COMPLETENESS / PRE_POST_DRIFT | NOT_VERIFIED |
| RESTORE_VALIDATION | PENDING |

Human이 확인한 부분 TOC: app_identity schema/ACL, auth schema/ACL, extensions schema. 608 entry 또는 list exit=0만으로 data completeness나 restore 성공을 증명하지 않는다. source project binding은 Human provenance이며 archive 내부 독립 확인 결과가 아니다. timezone, operator, TLS/CA 증명 및 전체 inventory evidence를 후속 승인 단계에서 연결해야 한다.

CUSTOM compression은 encryption이 아니다. auth/session/hash/vault 등 민감한 내용의 포함 가능성을 배제하지 않는다. archive는 접근 통제된 저장소에 RESTRICTED로 유지하며 repository, shared logs, 문서에 contents/credential/CA body를 저장하지 않는다.

## 3. Isolated target / compatibility

RESTORE_TARGET_CLASS=A — disposable local PostgreSQL, 외부 egress와 Production 접근을 OS/VM/container network 수준에서 차단한 새 isolated cluster를 권고한다. RESTORE_TARGET_CREATION_REQUIRED=YES. 기존 checkout의 DB나 기존 Production 연결 설정을 재사용하지 않는다. Application/listener/workers, cron/background jobs, net/http 호출, Railway binding 및 deployment는 금지한다. 복원된 configuration이나 credential이 유출되어도 외부 접속이 불가능한 격리가 선행되어야 한다.

[PostgreSQL pg_dump 18](https://www.postgresql.org/docs/18/app-pgdump.html)에 따르면 newer pg_dump는 older server를 dump할 수 있으나 output을 older major server로 restore하는 것은 보장되지 않는다. 따라서 17.6 source만을 근거로 17.x restore target을 승인하지 않는다. pg_restore 18.4와 PostgreSQL 18.x target을 version-compatible 후보로 사용하되 exact installed versions와 extension compatibility는 별도 확인한다. PostgreSQL major compatibility는 Supabase compatibility 증명이 아니다.

| Dependency | 현재 상태 / 후속 gate |
|---|---|
| auth / extensions | 부분 TOC에 존재; 전체 DDL/dependencies 보호된 검토 필요 |
| storage / realtime / vault | archive 존재/구조 NOT_VERIFIED; 없다고 가정 금지 |
| extensions / extension-owned objects | 이름/version/library/control file 및 background/external side effect 검토 필요 |
| owners / ACL role references | 전체 목록 NOT_VERIFIED; 별도 global evidence와 대조 필요 |
| provider-managed roles/functions | vanilla PostgreSQL 지원 NOT_VERIFIED |
| database owner/ACL/settings | --create 경로로 보존; 위험한 설정/외부 연결은 격리 및 실행 전 검토 |

호환 불가 객체 발견 시 STOP하고 gap을 AO에 반환한다. 임의 object 제외, extension 대체, --no-owner, --no-acl 또는 schema 수정으로 성공시키지 않는다. local target이 정확히 지원하지 못하면 isolation 요구를 만족하는 다른 target을 별도 승인받는다.

## 4. Restore command template — NOT AUTHORIZED

아래는 후속 승인 후 사용할 command shape이며 이번에는 실행하지 않는다. 승인된 isolated cluster에 별도 maintenance database `rel002_restore_control`을 준비하고 archived database `postgres`는 존재하지 않아야 한다. 기본 cluster의 postgres가 이미 존재하면 STOP한다. 자동 drop/--clean은 금지한다. 이 조건을 마련하는 target provisioning도 별도 승인 대상이다.

실행 전: protected archive size/SHA를 위 tuple과 비교한다. local 전용 tool/process 환경에서 PGHOSTADDR/PGSERVICE/PGSERVICEFILE 및 inherited connection options를 제거하고, Production credential을 사용하지 않는 isolated admin authentication을 구성한다. loopback port 독점성, 새 cluster data directory/system identity, maintenance DB, exact server version, postgres 부재를 확인한다. 외부 egress 차단과 extension/job side-effect 방지를 검증한 후에만 진행한다. loopback 자체만으로 target identity를 증명하지 않는다.

```powershell
# TEMPLATE ONLY; placeholders must be approved and resolved before execution.
$restoreArchive = '<protected-outside-repository-path>/ai-mls-production-pre013-audit001-20261005-223349.dump'
if ((Get-Item -LiteralPath $restoreArchive).Length -ne 391501) { throw 'BACKUP_SIZE_MISMATCH' }
if ((Get-FileHash -LiteralPath $restoreArchive -Algorithm SHA256).Hash -ne 'CD16C5E5E61A65551DE7E497A1B2D3E3621F3C65A547A895BB7DC98E6BDE587F') { throw 'BACKUP_CHECKSUM_MISMATCH' }
# Mandatory external preflight: isolated target identity/network/roles/compatibility gates PASS.
& '<approved-pg_restore-18.4-path>' --host=127.0.0.1 --port=<exclusive-isolated-port> --username=<isolated-admin> --dbname=rel002_restore_control --create --exit-on-error $restoreArchive
if ($LASTEXITCODE -ne 0) { throw 'RESTORE_FAILED_STOP' }
```

placeholder는 실행값이 아니다. password는 CLI에 넣지 않고 approved isolated-only protected authentication을 사용한다. restore는 archived database 이름 postgres를 생성한다.[pg_restore 18](https://www.postgresql.org/docs/18/app-pgrestore.html)의 --create는 database owner/ACL/settings를 포함하며 object ownership/ACL은 default로 유지한다. --single-transaction은 database creation과 함께 사용하지 않는다. 실패 시 격리 상태로 STOP하고 partial state를 기록한다. Production 변경, automatic rerun, clean/drop은 금지한다. no-create alternative는 database owner/ACL mapping의 별도 승인이 필요하므로 이 template에는 채택하지 않는다.

## 5. Validation / global state contract

DATABASE_DUMP_RESTORED_STATE와 GLOBAL_ROLE_STATE_RECONSTRUCTION은 독립된 증명으로 기록한다.

1. restore exit=0 및 source/archive hash/candidate/window exact 일치를 확인한다. 전체 TOC/object inventory와 restored catalogs를 비교하여 누락이나 임의 제외가 없음을 확인한다. extension, constraints, indexes, functions, triggers, owners, ACL 및 data integrity evidence를 포함한다. raw row/secret은 공유하지 않는다.
2. app_identity 및 identity_registered_service_workloads가 존재하고 expected owner/structure가 일치해야 한다. identity_workload_evidence 및 app_audit는 absent여야 한다. 다르면 pre-013/Audit001 baseline gate FAIL이다. restore 중 013/Audit001/018은 적용하지 않는다.
3. 006 attestation table/function 및 007 exact immutable attestation tuple을 historical evidence와 비교한다. 승인된 non-secret tuple의 read-only 비교만 수행한다. 006/007은 replay하지 않는다.
4. 011 roles/attributes/memberships/database/object ACL topology를 별도 secret-free global evidence와 대조한다. 017 registration role의 LOGIN 및 prohibited attributes absence, 018 direct grants absence와 effective privileges를 확인한다. 011/017은 replay하지 않는다.
5. global reconstruction은 isolated-only controlled operation으로 별도 승인받는다. Production passwords/role config 값은 옮기지 않는다. roles/membership/password는 pg_dump 대상이 아니다. restored owners/ACL은 role existence나 011/017 증명의 대체가 아니다.
6. target/operator/timestamps/version, network isolation, side effects absence, elapsed time, result/limitations 및 protected evidence refs/hash를 기록한다. retention/cleanup은 별도 승인받는다. restore 성공 후에도 Production migration 실행은 별도 AO 승인 대상이다.

GLOBAL_STATE_EVIDENCE_BOUND=NO. Human이 secret-free global artifact ref/hash/timestamp를 제공하지 않았으므로 evidence 존재를 작성하지 않는다. GLOBAL_STATE_RECONSTRUCTION_REQUIRED=YES. role attributes, exact memberships, database owner/direct/PUBLIC ACL 및 related object ACL evidence를 연결해야 한다. rolpassword, raw rolconfig 및 credential 값은 포함하지 않는다. backup과 quiet-window/pre-post drift, currentness 및 017 상태를 확정할 때까지 full recovery proof는 BLOCKED이다.

## 6. Gates / limitations / validation

RESTORE_VALIDATION_PLAN_READY=YES — design only. target/extension/global evidence 및 operator/TLS/CA/currentness가 미검증이므로 execution-ready가 아니다. 과거 backup/restore 승인이나 platform limitation exception을 새 archive에 자동 적용하지 않는다.

BACKUP_GATE=BACKUP_CREATED_PENDING_ISOLATED_RESTORE
RESTORE_TEST_AUTHORIZED=NO
EXECUTION_AUTHORIZED=NO
SAFE_TO_EXECUTE=NO
SAFE_TO_RETRY_018=NO
SOURCE_CHANGED=NO — documentation only
PRODUCTION_MUTATION=NONE
COMMIT=NOT_CREATED
PUSH=NOT_PERFORMED

이번 validation은 document links, exact Human tuple, whitespace, secret-literal scan 및 변경 scope에 한정한다. archive inspection, target creation, restore 및 Production query/mutation은 수행하지 않았다.
