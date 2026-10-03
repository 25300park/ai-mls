# REL-002 R3-C3B3 Inventory / Blocker Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-275 |
| Version | v0.1 |
| Status | DRAFT |
| Owner | Architecture Owner |
| Completion date | 2026-10-03 |
| Brief | REL-002 R3-C3B3 — Concrete Production Trusted-Binding Composition |
| Baseline | f6f602d6f08915009b637d05dd35d54b36884825 |

## 1. Objective

기존 canonical request-time 계약을 조사했다. B3 brief의 exact trusted team / tenant binding 요구를 만족하는 Production 계약이 충분하지 않아 stop condition에서 구현을 중단했다. Runtime success behavior, schema, migration, ACL 또는 새로운 trusted-binding authority를 구현하지 않았다.

## 2. Documents read

- 현재 R3-C3B3 brief와 [B2B closeout 보고서](REL002_R3C3B2B_COMPLETION.md).
- [DEC-128/129/130](../00_DECISION_REGISTER.md), [Canonical Session Record DOC-DEV-058](../implementation/REL001_PHASE1C_CANONICAL_SESSION_RECORD_CONTRACT.md), [Session Resolution DOC-DEV-060](../implementation/REL001_PHASE1C_SESSION_RESOLUTION_FLOW.md).
- [Session ownership](../implementation/REL001_PHASE1C_SESSION_CREATION_REVOCATION_OWNERSHIP.md), [Security readiness](../implementation/REL001_PHASE1C_SESSION_SECURITY_READINESS_MATRIX.md), [Session and Access Control](../book-8/09_SESSION_AND_ACCESS_CONTROL.md).
- 아래 inventory의 직접 관련 source와 Session trusted-binding tests. 기존 역사적 보고서 4개는 읽기만 허용하며 수정하지 않았다.

## 3. Files created

이 inventory/blocker 보고서만 생성했다.

## 4. Files modified

None. 기존 source, tests, 승인 migrations, historical fingerprint, primary checkout을 변경하지 않았다.

## 5. Key decisions added

새 canonical 결정은 없다. 다음 existing authority를 확인했다.

| 경계 | 정확한 source / identifier | 소유권과 현재 구현 | B3 판단 |
|---|---|---|---|
| Durable Session | [session-persistence.ts](../../modules/identity/src/session-persistence.ts), `DurableSessionRecord`, lines 9–28 | Identity. principal/type, optional teamId, ACTIVE/REVOKED/EXPIRED, immutable tenantBindingOrigin, version/time/evidence | durable model FOUND; tenantId는 없고 teamId는 optional |
| Async exact Session read | [session-postgresql-persistence.ts](../../modules/identity/src/session-postgresql-persistence.ts), `PostgreSqlSessionReader.find`, line 36 | app_identity.identity_sessions, exact sessionId 조회, 기존 strict decoder, pool owner 아님 | FOUND. arbitrary/latest Session 선택 불필요 |
| Principal/tenant source | [first-party-credential-contracts.ts](../../modules/identity/src/first-party-credential-contracts.ts), `IdentityHumanPrincipalRecord`, lines 16–24 | Identity. principalId/userId/tenantId/loginIdentifier/status ACTIVE 또는 DISABLED | authoritative durable source FOUND. 기존 reader는 tenant+login lookup이며 Session principalId용 concrete read 연결은 아직 없음 |
| First-party identity result | [first-party-credential-adapter.ts](../../modules/identity/src/first-party-credential-adapter.ts), `verify`, line 26 | exact authenticated HUMAN principal, SINGLE_FACTOR, roles=[], teamId 없음 | 성공 authentication만으로 exact trusted active team을 결정할 수 없음 |
| Session issuance linkage | [session-service.ts](../../modules/identity/src/session-service.ts), `#createSessionSnapshot`, lines 375–391 | adapter의 optional team만 복사; tenantBindingOrigin은 composition dependency로 공급 | B2B-issued Session에는 team이 없으며 origin의 Production dereference 계약도 미구성 |
| Trusted-binding port | [session-persistence.ts](../../modules/identity/src/session-persistence.ts), `TrustedSessionBindingRequest` / `TrustedSessionBindingResolver`, lines 55–70 | Session + requested tenant/resource/purpose/team을 받아 trusted actor/tenant/origin을 반환하는 sync port | contract FOUND, concrete Production implementation NOT_CONFIGURED |
| Current request-time coordinator | [session-access-coordinator.ts](../../modules/identity/src/session-access-coordinator.ts), `resolveAuthorizedWithDecision` / `#resolveBinding`, lines 62–143 | Identity Session 조회→effective state/freshness→trusted binding→live authorization→successful lastAccessedAt/version update | 기존 의미 FOUND. injected resolver이며 async Production composition은 없음 |
| Effective revocation | 같은 coordinator lines 66–69, `DurableSessionRecord.state` | ACTIVE 아니면 fail closed. durable Session effective state 사용 | FOUND. revocation ledger 직접 SELECT 불필요 |
| Freshness / MFA | 같은 coordinator lines 194–216; [Production freshness](../../apps/api/src/production-human-identity-contracts.ts), `parseProductionHumanFreshnessPolicy`, lines 49–64 | 기존 idle/absolute/MFA 공식, MFA obligation 때 freshness 평가. B1은 explicit Production milliseconds parsing 제공 | canonical semantics FOUND. 기존 coordinator의 Staging 숫자를 Production fallback으로 사용할 수 없음 |
| Role / live authorization | [live-assignment-adapter.ts](../../modules/administration/src/live-assignment-adapter.ts), `createAsyncAdministrationBackedAuthorizationService`, lines 94–110 | Administration RoleAssignment/Role/proposal/decision authority를 읽어 기존 AuthorizationService에 전달. exact tenant/principal/type/resource/purpose/team context | async canonical authority FOUND. RoleAssignment 배열에서 active team을 선택하는 계약은 없음 |
| Production dependency boundary | [production-human-identity-composition.ts](../../apps/api/src/production-human-identity-composition.ts), `composeProductionHumanRequestDependencies`, lines 14–21 | approved Production resolver와 async authorization의 주입 계약만 검증 | 실제 trusted resolver/readiness proof 아님 |

## 6. Open decisions

**OPEN DECISION — AO / Identity / Administration:** first-party Human Session의 exact trusted active-team authority와 전달 경로가 필요하다. 현재 credential evidence에는 team이 없고, principal은 team authority를 소유하지 않으며, adapter는 teamId를 반환하지 않는다. Optional Session team field의 존재만으로 새 team-selection 계약이 승인된 것은 아니다. RoleAssignment의 첫 값, 배열 순서, 유일한 후보를 임의로 선택하지 않는다. Organization/Project/login에서 team을 추론하지 않는다.

**OPEN DECISION — AO / Identity:** Session tenant 일치 요구를 기존 DEC-129의 actor + current trusted assignment derivation 및 immutable tenantBindingOrigin과 어떻게 연결할지 정확한 Production 계약이 필요하다. DOC-DEV-058 section 4는 `tenantId`를 Session grant로 추가하지 않도록 명시한다. 따라서 새 Session tenant 필드를 추가하거나 opaque origin 문자열을 tenant authority로 파싱하지 않는다. 기존 immutable origin이 참조하는 승인 source와 exact consistency validation을 지정해야 한다.

두 결정 전에는 ProductionTrustedBindingResolver를 구현하지 않는다. 기존 주입형 test/Staging resolver를 Production으로 승격하지 않는다.

## 7. Inconsistencies found

- B3의 exact trusted team 요구에 비해 승인된 B2B 결과에는 team이 없다. 이를 새 팀 선택 의미 없이 채울 existing concrete Production path를 찾지 못했다.
- B3의 “Session tenant = principal tenant = expected trusted context”와 기존 Session 계약의 “tenantId not added / derived live” 사이에 적용 해석이 필요하다. 이는 기존 모델의 결함으로 단정하지 않으며 AO가 연결 계약을 확정해야 한다.
- Service workload의 authorizationTeamId / startup binding은 Human Session authority의 대체 source가 아니다.

## 8. Validation performed

Baseline HEAD 일치, staged/tracked dirty change 없음, 보존 대상 untracked 보고서 4개만 존재함을 확인했다. Exact symbols/source/document 계약으로 inventory를 수행했다. Runtime source 수정은 0이다.

| 검사 | 결과 |
|---|---|
| Focused / Disposable PostgreSQL / Affected / Full regression | NOT_RUN — inventory stop condition, 구현 없음 |
| Build / Lint / Typecheck | NOT_RUN — source 변경 없음 |
| git diff --check / report whitespace / links / secret scan | PASS |
| Independent review | BLOCK_CONFIRMED — exact trusted team 및 origin/tenant 연결 계약 부족을 독립 검토로 확인 |
| Historical fingerprint / approved migrations / primary checkout | UNCHANGED |

## 9. Known limitations

기존 의미의 존재와 concrete Production composition readiness는 다르다. 발견한 Session/principal/RoleAssignment/freshness 구현을 B3 전체 PASS로 분류하지 않는다. 실제 Production은 query/mutation하지 않았다. 새로운 pool이나 DB connection을 생성하지 않았다. 기존 physical runtime pool count 1의 계약은 보존했으며 이번 inventory에서 runtime pool을 실행하지 않았다.

## 10. Next brief prerequisites

AO가 exact active-team source 및 trusted binding origin/tenant validation 계약을 확정한 뒤 B3의 bounded composition design과 테스트를 진행해야 한다. New Session model/schema/migration/authority가 필요하다면 별도 승인이 필요하다. R3-C3 Final, Required Secrets, listener/workers, R3-D는 시작하지 않는다.

## Completion statement

BLOCK_REL002_R3C3B3_PRODUCTION_TRUSTED_BINDING_COMPOSITION. B3 inventory는 수행했지만 구현 gate는 충족하지 못했다. Human Identity authority gate 및 full Production startup은 BLOCKED, Required Secrets는 UNCHANGED_FAIL_CLOSED이다. Production readiness NOT_VERIFIED, deployability BLOCKED, Production/Railway/Supabase mutation 0/0/0, Commit NOT_CREATED, Push NOT_PERFORMED.

## AO 계약 확정 후 구현·검증 — 2026-10-03

위 inventory와 BLOCK 결론은 당시의 역사적 조사 결과이며 수정하지 않는다. 이후 HUMAN/AO가 `TRUSTED TENANT / ACTIVE TEAM BINDING CONTRACT`를 명시 승인하여 기존 blockers를 해소했다. 아래 결과는 그 승인 이후의 bounded 구현에만 적용한다.

### 1. Objective

Exact trusted `expectedTenantId`와 post-authentication `requestedTeamId`를 검증한 immutable Session binding 및 request-time live authority composition을 구현했다. Production startup gate는 활성화하지 않았다.

### 2. Documents read

현재 AO contract, 위 inventory의 canonical Session/Administration/Authorization 계약, [구현 계획](../implementation/REL002_R3C3B3_IMPLEMENTATION_PLAN.md), B1/B2B 구현 및 승인 migration을 사용했다. B1의 sync dependency contract는 그대로 두고 concrete async request coordinator가 기존 SessionContext와 AuthorizationRequest를 사용한다.

### 3. Files created

- `apps/api/src/production-trusted-binding.ts`, `production-trusted-binding-readiness.ts`, `production-trusted-binding.test.ts`, `rel002-r3c3b3-postgresql.integration.test.ts`.
- `modules/administration/src/production-team-binding.ts`, `production-team-binding.test.ts`.
- `modules/identity/src/production-session-binding.ts`, `production-session-binding.test.ts`.
- `modules/identity/migrations/postgresql/production/016_production_session_binding_v1.up.sql`, `.up.sql.sha256`, `.verify.sql`.
- 구현 계획. 이 기존 inventory 보고서에는 이 후속 결과만 추가했다.

### 4. Files modified

`apps/api/src/r3c2-aggregate-readiness.ts`; Administration PostgreSQL read participant와 live-assignment adapter; Identity principal reader, Session persistence/async persistence/issuance service; 기존 Session coordinator의 동일 denial normalizer export. 합계 8 tracked 변경과 13 B3 신규 파일이다. 보존 대상 historical untracked reports 4개는 포함하지 않는다.

### 5. Key decisions added

AO 승인 bounded connection contract를 적용했다. `session.tenantId === principal.tenantId === expectedTenantId`; `tenantBindingOrigin=AUTHENTICATED_PRINCIPAL_TENANT`; `teamBindingOrigin=EXPLICIT_TEAM_SELECTION_VALIDATED`. 팀 선택은 명시적이며 live TEAM_SCOPE/RoleAssignment로 검증한다. Credential evidence 및 provider 계약은 변경하지 않았다.

동일 Session UoW/client에서 B2B principal/credential revalidation 뒤 팀 검증과 Session INSERT를 수행한다. Lock 순서는 exact Session row → 기존 principal advisory shared lock → 정렬된 Administration revision/resource shared locks이다. 기존 Administration single-resource writers의 FOR UPDATE와 상호 작용하며 cross-domain write나 새 grant는 없다. Lock snapshot 뒤에 생긴 assignment/role은 사용하지 않고 fail closed한다. Authorization은 동일 검증된 authority snapshot과 기존 AuthorizationService를 사용한다.

016은 nullable Session binding columns, exact payload consistency CHECK, immutable binding trigger만 추가한다. Historical row UPDATE/backfill은 없다. `tenantBindingOrigin`은 기존 JSONB payload에 그대로 저장한다. Composed base verifier에서 정확한 B3 artifacts만 projection하고 별도 exact B3 verifier를 요구한다. Partial extension도 fail closed한다. 이전 SQL/checksum/fingerprint는 변경하지 않는다.

### 6. Open decisions

B3 unresolved decisions = 0. R3-C3 Final startup integration과 Required Secrets는 별도 단계이며 시작하지 않았다.

### 7. Inconsistencies found

독립 리뷰의 초기 read-error normalization 및 concurrent assignment phantom 결함을 수정했다. 추가 partial-schema 관찰 조건과 기존 privileged action의 MFA freshness coverage도 완료했다. Disposable readiness drift 테스트의 DDL/read lock 교착은 catalog 응답 주입으로 교체했다. B1 empty-table fixture는 다른 DB tests와 동시에 실행하지 않고 빈 Session fixture에서 별도로 검증했다. 이 실패들은 최종 실행에 남지 않는다.

### 8. Validation performed

| 검사 | 최종 결과 |
|---|---|
| Focused | 6 PASS |
| Disposable PostgreSQL B3 | 12 PASS |
| B2B compatibility / B1 compatibility | 10 PASS / 1 PASS — 별도 순차 실행 |
| Affected | 65 PASS |
| Full regression | 1813 PASS / 1 authorized immutable historical fingerprint mismatch / 19 SKIP |
| Build / Typecheck | PASS / PASS |
| Lint | PASS |
| git diff --check / secret scan | PASS / PASS |
| Independent review | APPROVED — 원래 두 결함 및 두 추가 coverage 항목 해결 |
| 016 migration SHA256 / exact verifier | PASS / PASS — disposable only |
| Physical runtime pool | 1; 기존 주입 pool, 새 pool 생성 없음 |
| Historical fingerprint / approved migrations / primary checkout / historical reports | UNCHANGED |

Exact persisted tuple, origins, explicit team, live role/team removal, historical rejection, revocation/expiration/idle/absolute/MFA freshness, credential/principal race, INSERT rollback, client release, writer blocking, phantom rejection, partial readiness drift, zero-session readiness를 검증했다. Runtime credential read-only ACL과 기존 Session/Administration ACL을 재사용한다. Revocation ledger direct SELECT는 추가하지 않았다. Session effective state가 revocation decision source이다.

### 9. Known limitations

Readiness는 disposable PostgreSQL 18에서만 검증했다. Actual Production은 조회하지 않았다. Concrete B3 coordinator가 준비되었지만 `validateHumanIdentityAuthority`는 unchanged fail-closed이다. 신규 Session fields가 없는 historical Sessions는 Local/Test에서 decode되며 Production trusted binding에는 ineligible이다. MFA acceptance tests는 검증된 synthetic operator fixture이며 first-party provider의 SINGLE_FACTOR 계약을 변경하지 않는다.

### 10. Next brief prerequisites

이 B3 gate 완료 결과에 대한 별도 closeout authorization이 있어야 commit할 수 있다. R3-C3 Final과 Required Secrets는 각각 후속 승인 범위이며 자동 시작하지 않는다.

### 후속 완료 결론

`APPROVE_REL002_R3C3B3_PRODUCTION_TRUSTED_BINDING_COMPOSITION`.

Production trusted binding composition PASS; historical inferred backfill NO; new trusted-binding semantics YES — AO_APPROVED_BOUNDED_CONNECTION_CONTRACT. R3-C3 FINAL NOT_STARTED, HUMAN_IDENTITY_AUTHORITY_GATE BLOCKED, REQUIRED_SECRETS UNCHANGED_FAIL_CLOSED, FULL_PRODUCTION_STARTUP BLOCKED. Listener/workers/R3-D NOT_STARTED, Production readiness NOT_VERIFIED, deployability BLOCKED. Commit NOT_CREATED, Push NOT_PERFORMED, Production/Railway/Supabase mutation 0/0/0.
