# REL-002 R3-G1B Registration Operator / Command

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-403 |
| 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Identity / Architecture Owner |
| Baseline | 34527fe6a7c450e958fb632ba9ecc6335ee70e09 |

## 승인 범위

사용자 R3-G1B/B0/B1 및 provisioning/scopeRef 최종 결정을 적용한다. [완료 보고서](../reviews/REL002_R3G1B_COMPLETION.md)와 연결한다. 새 public API, worker, deployment hook, runtime authority를 추가하지 않는다. 등록 command는 Identity, Audit projection 검증/INSERT는 기존 Audit materializer가 소유한다.

## 경계와 실행

- [017 role artifact](../../modules/identity/migrations/postgresql/production/017_registration_operator_role.sql): controlled administrative `postgres` boundary가 NOINHERIT/NOCREATEROLE의 registration operator를 생성하고 CONNECT를 부여한다. password/member/ownership을 생성하지 않는다.
- [018 ACL artifact](../../modules/identity/migrations/postgresql/production/018_registration_operator_grants.sql): migration operator의 exact schema/table ownership을 먼저 검증한 후 app_identity/app_audit USAGE와 세 테이블 SELECT/INSERT만 부여한다. runtime ACL은 변경하지 않는다.
- [ACL verifier](../../modules/identity/migrations/postgresql/production/018_registration_operator_grants.verify.sql): `ready=true`를 요구한다. attributes/membership/ownership/table/column/schema/sequence/function 권한을 확인하고 PUBLIC column write와 reachable SECURITY DEFINER 우회도 거부한다.
- [Identity command](../../modules/identity/src/register-service-workload.ts): current_user와 session_user 모두 registration operator인 경우만 실행한다. migration/runtime credential은 거부한다.
- [one-shot runner](../../tools/production/register-service-workload.ts): `--dry-run --manifest <path>` 또는 `--execute --manifest <path>`만 허용한다. mode 생략/중복/추가 secret argument는 실패한다. 기본 권장 모드는 DRY_RUN이지만 implicit 실행/default mode는 없다.

빌드 후 runner entry는 `node dist/tools/production/register-service-workload.js`다. 이는 현재 Production 실행 지시가 아니다.

## 전용 credential contract

PG_REGISTRATION_OPERATOR_POOL은 one-shot process의 전용 pool이다. 연결과 CA는 각각 `AI_MLS_PRODUCTION_REGISTRATION_DATABASE_CONNECTION_V1`, `AI_MLS_PRODUCTION_REGISTRATION_DATABASE_CA_CERT_V1` process-environment binding만 사용한다. runtime secret, raw DATABASE_URL, CLI/manifest credential, migration credential은 사용하지 않는다. 운영 binding은 controlled execution boundary에서만 공급하며 Railway ai-mls-api에 넣지 않는다.

대상은 `db.mfonujjeokvpsfucfxuq.supabase.co:5432/postgres`, projectRef `mfonujjeokvpsfucfxuq`, approved region `ap-southeast-1`이다. URI username/host/database/query/hash를 제한하고 VERIFY_FULL CA와 max=1을 사용한다. 실제 region/Production DB 접속을 이번 단계에서 검증하지 않았다. pool closure는 runner finally의 소유이며 장기 runtime PG_PRODUCTION_POOL topology를 변경하지 않는다.

## Manifest와 timestamp

ProductionWorkloadRegistrationManifestV1은 schemaVersion, registrationId/version, tenantId, principalId, environment, purpose, audience, scopeRef, identityEvidenceRef, auditEvidenceRef, expectedDatabaseTarget, expectedExecutionRole, expectedWrites, timestampPolicy만 허용한다. getter/extra fields와 감지 가능한 secret-bearing reference는 거부한다.

environment=PRODUCTION, purpose=AI_MLS_PRODUCTION_API_RUNTIME, audience=ai-mls-api, expectedWrites=3, expectedExecutionRole=ai_mls_production_registration_operator, timestampPolicy=GENERATED_AT_EXECUTION이다. SERVICE/WORKLOAD와 eligible ACTIVE는 이 승인 command의 고정 classification이다. LONG_RUNNING_API는 운영 classification이며 기존 physical model에 임의 column을 추가하지 않는다.

scopeRef는 `registered-service-workload:${registrationId}:${registrationVersion}` exact equality를 요구한다. business Scope, TEAM/POLICY/SOURCE/TARGET 조회와 연결하지 않는다. operation clock은 execute 시 한 번 event time을 기록한다. RegisteredServiceWorkload.created_at/updated_at과 Audit.occurred_at은 동일하다. Identity proof에는 timestamp column이 없다. Audit.materialized_at은 실제 materialization clock이며 occurred_at 이상이어야 한다.

## Atomicity / replay

하나의 client transaction에서 registration, immutable Identity proof, final Audit event를 생성한다. registration identity advisory lock과 기존 uniqueness가 concurrency를 직렬화한다. partial/preexisting mismatched evidence는 fail closed다. exact replay는 기존 timestamp를 재사용해 비교하고 어떤 INSERT도 실행하지 않는다. version/tuple/ref/status/profile conflict는 overwrite/UPDATE/DELETE 없이 거부한다.

Dry-run은 READ ONLY repeatable-read transaction으로 ACL과 exact conflict state를 확인하며 writes=0이다. Execute COMMIT acknowledgement가 ambiguous하면 client를 destroy하고 command instance를 quarantine한다. 새 controlled attempt는 exact replay로 결과를 확인해야 하며 자동 retry하지 않는다. 모든 failure는 bounded code로 정규화되고 CLI에는 raw DB error/URL/password/stack을 출력하지 않는다.

## Production approval gate와 제한

등록 identifiers는 UNASSIGNED다. real tenant/principal/evidence identifiers를 임의 생성하지 않았다. exact runnable approval manifest는 아직 없다. 다음은 실행 전 필요한 순서이며 이번 단계에서 수행하지 않았다: target/backup 검증 → 별도 승인된 role/ACL provisioning → operator binding → exact manifest dry-run → manifest freeze/Human approval → 단일 execute → exact read-back → process/credential 종료.

중요: 기존 R3-C2 aggregate catalog fingerprints는 schema/table ACL 전체를 포함한다. 새 operator grants는 그 fingerprint를 바꾸므로 실제 provisioning 전 별도 bounded aggregate readiness compatibility 검증/승인이 필요하다. 기존 verifier/approved migrations/historical evidence를 수정하거나 완화하지 않았다. 이 단계는 command 구현을 검증했으며 Production readiness를 승인하지 않는다.

PRODUCTION_EXECUTION=NOT_PERFORMED. PRODUCTION_READINESS=NOT_VERIFIED. PRODUCTION_DEPLOYABILITY=BLOCKED. Production/Railway/Supabase mutation=0/0/0. Commit=NOT_CREATED. Push=NOT_PERFORMED.
