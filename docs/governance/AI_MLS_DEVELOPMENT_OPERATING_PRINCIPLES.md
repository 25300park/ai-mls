# AI-MLS 개발 운영 기본원칙 및 핵심 지침

**문서 ID:** `AI-MLS-DEV-OPS-PRINCIPLES-v1.0`  
**프로젝트:** AI-MLS  
**상태:** CANONICAL OPERATING PRINCIPLE  
**적용 대상:** Human Operator, ChatGPT / Architecture Owner, Codex, AIDOS 및 승인된 개발 에이전트  
**권장 저장 경로:** `D:\04. AI-MLS\docs\governance\AI_MLS_DEVELOPMENT_OPERATING_PRINCIPLES.md`

---

## 0. AGENTS.md 하위 구현 지침 / MVP-FIRST 우선

이 문서는 [root AGENTS.md](../../AGENTS.md)의 `AI-MLS MVP-FIRST EXECUTION AUTHORITY`를 구현하는 **하위 지침**이다. 독립적인 scope/authority source가 아니며 현재 Human 지시와 AGENTS.md가 우선한다. 아래 기존 절과 충돌하면 이 절을 적용한다. 경쟁하는 MVP 정책 문서를 만들지 않는다.

- `MVP_COMPLETION_IS_PRIMARY = TRUE`. 모든 작업은 먼저 `MVP_REQUIRED = YES / NO`를 판정한다.
- 구현은 `MVP_REQUIRED = YES`와 `ARCHITECTURE_CONFORMANT = YES`를 모두 만족해야 한다. MVP 속도는 canonical architecture 우회를 허용하지 않는다.
- MVP completion/deployment, Production startup, Human product testing, Human-requested MVP defect 또는 필수 data/security integrity를 직접 막지 않으면 `DEFER_POST_MVP`이다.
- Human을 로컬 test runner로 사용하지 않는다. 승인된 로컬 inspection/implementation/diagnostics/search/tests/build/typecheck/lint/diff/checksum/PowerShell-equivalent checks/migration analysis/regression/source verification 및 실패 후 correction은 Codex가 수행한다.
- Human Gate는 `PRODUCTION_MUTATION`, `DEPLOYMENT`, `SECRET_CUSTODY`, `DESTRUCTIVE_OPERATION`, `PRODUCT_TEST`, `SCOPE_AUTHORITY_CHANGE`의 여섯 분류뿐이다. 이미 부여된 승인은 반복 요청하지 않으며 구체적 Production 접근 금지는 유지한다.
- 새 framework/abstraction/governance/verifier/migration/evidence/recovery/authority를 도입하기 전에 `DOES_THIS_DIRECTLY_BLOCK_MVP`를 판정한다. NO이면 구현하지 않고 `POST_MVP_DEFERRED`만 기록하며 YES이면 최소 안전 버전만 구현한다.
- verifier chaining, generalized blocker subsystem, 무관한 migration 후속 architecture, unchanged PASS 재검증, 로컬 진단의 Human 전가 또는 deployment를 단축하지 않는 governance는 `SCOPE_DRIFT_DETECTED = YES`, `ACTION = RETURN_TO_SHORTEST_MVP_PATH`이다. 필수 integrity 검증은 유지하면서 최소 직접 수정으로 돌아간다.
- 승인 범위의 기본 루프는 inspect → implement → test → diagnose → fix → retest → affected validation → build/typecheck → diff/secret check → candidate이다. 일반적인 로컬 실패로 종료하지 않는다.
- 구현 중 focused tests, stable candidate에서 focused + affected + build/typecheck + scoped lint + diff + secret scan을 사용한다. Full regression은 stable release candidate 또는 실제 broad/high-risk shared-core 변경에만 실행하고 unchanged PASS를 재사용한다.
- 모든 완료 보고는 AGENTS.md의 MVP/architecture 상태 계약을 포함한다: scope/architecture PASS 여부, canonical owner/path, 재사용 component, 최소 확장, duplicate 여부, scope/architecture drift, defer 항목, Human action/reason, 최단 MVP 경로. 별도 보고서 파일은 사용자 요청 또는 실제 필요한 추적 기록이 있을 때만 작성한다.

### Architecture conformance 구현 규칙

새 source 전에 `CANONICAL_OWNER`, `CANONICAL_EXISTING_PATH`, `REUSED_COMPONENTS`, `MINIMUM_EXTENSION`, `DUPLICATE_COMPONENT_CREATED = NO`를 식별한다. 기존 module/service/store/UoW, authority, schema ownership, session/auth/Audit, runtime/startup 및 API boundary를 재사용하고 승인된 migration/historical contract를 보존한다.

기능이 없으면 가장 가까운 owner를 최소 확장한다. Identity → Identity, Audit → 기존 PostgreSQL Audit participant, Session → SessionService/기존 persistence, startup → canonical forward readiness, DB → schema owner의 migration이다. owner를 식별할 수 없으면 구현하지 않고 architecture 결정을 요청한다.

duplicate service/queue/Audit/auth/session engine, 대체 DB access path, canonical writer를 우회하는 직접 SQL mutation, authority 우회 MVP API, permanent bootstrap bypass, parallel startup verifier와 MVP 직후 교체할 별도 architecture는 금지한다. 발견 시 `ARCHITECTURE_DRIFT_DETECTED = YES`, `ARCHITECTURE_CONFORMANT = NO`로 기록하고 canonical 경로로 재설계한다.

임시 구현은 기본 금지이며 isolated·명시적 disposable·canonical contract 불변·제거 시 data migration 불필요 조건과 Human/AO 명시 승인을 모두 요구한다. 우선순위는 data integrity/irreversible safety → 기존 canonical architecture → MVP completion speed → generalization/future-proofing이다. 아래 기존 우선순위 절이 architecture보다 속도를 앞세우는 것으로 해석되어서는 안 된다.

### 현재 REL002 MVP 재평가

| 영역 | MVP에 유지할 최소 범위 | POST_MVP_DEFERRED |
|---|---|---|
| Owner verification | 정확한 tenant/두 Human/승인 plan, 독립적 승인·만료·철회·일회성 사용 검증. 미확정 authority는 blocker로 유지 | 범용 multi-issuer registry/framework, 무관한 authority 확장 |
| TOTP key custody | 실제 TOTP 검증, seed 암호화와 필요한 key 접근, 사용 중 ciphertext 복호화 유지, secret 비노출 | 범용 KMS/rotation orchestration, 미사용 확장 |
| Audit | enrollment + credential + Identity receipt + 필요한 Audit event의 동일 transaction 원자성. 기존 participant 재사용; 필요한 최소 event/forward-state 변경만 검토 | 두 번째 Audit engine, 범용 evidence 체계, 무관한 event 확장 |
| Migration024 | 위 최소 기능에 필요한 additive storage/receipt와 bounded PG17 pre/post 검증; 기존 startup 계약과 충돌하면 최소 integration만 해결 | 범용 migration/verifier/recovery framework, verifier를 위한 추가 verifier |

### 현재 REL002 22-file candidate dual-guard 판정

검토 worktree: `D:\04. AI-MLS\.worktrees\rel002-r3c2-runtime-startup`. 아래 경로는 해당 worktree 기준이다. 이전 20개 중 불필요한 정책/완료 문서 2개는 제외하고, MVP startup integration에 필요한 기존 readiness 소스·테스트 4개를 더한 22개만 검토한다. 각 YES는 현재 source의 architecture 적합성 판정이며 commit/deployment/Production mutation 승인이 아니다.

CANONICAL_OWNER: Identity, Audit, Production composition/forward readiness.

CANONICAL_EXISTING_PATH: 승인된 `FirstHumanBootstrap` → `PostgreSqlFirstHumanBootstrapUnitOfWork` → 기존 credential reader/Session repository; 기존 `PostgreSqlAuditEvidenceStore`; canonical `r3c2-aggregate-readiness`/`r3c2c-catalog-compatibility`.

REUSED_COMPONENTS: `Argon2idV1Verifier`, `PostgreSqlHumanCredentialReader`, `DurableSessionRecord`/validator, `createPostgreSqlSessionRepository`, 동일 PG client의 Audit participant, canonical pool port, 기존 forward readiness와 단일 024 verifier.

MINIMUM_EXTENSION: 정확한 두 Human의 승인·Identity 소유 TOTP/key 보호·원자적 enrollment/Audit, owner 소유 additive storage, 검증 후 기존 base projection을 유지하는 forward startup integration. `DUPLICATE_COMPONENT_CREATED = NO`.

| 파일 | MVP_REQUIRED | ARCHITECTURE_CONFORMANT | canonical 소유/재사용 근거 |
|---|---|---|---|
| `modules/identity/src/first-human-bootstrap.ts` | YES | YES | Identity 내부 승인된 bootstrap lifecycle; canonical Argon2/session record·repository 사용 |
| `modules/identity/src/first-human-bootstrap.test.ts` | YES | YES | 같은 Identity 경로의 철회·재사용 방지 검증 |
| `modules/identity/src/first-human-contract.ts` | YES | YES | 의존성 없는 공유 tenant 계약; 새 authority 아님 |
| `modules/identity/src/first-human-owner-proof.ts` | YES | YES | 기존 EnrollmentOwnerVerifier port의 단일 승인 adapter; DB credential을 Human authority로 대체하지 않음 |
| `modules/identity/src/first-human-key-custody.ts` | YES | YES | Identity TOTP key port, 단일 binding/key ID; 새 KMS 없음 |
| `modules/identity/src/first-human-production-adapters.test.ts` | YES | YES | 같은 adapter/composition 경계의 fail-closed 검증 |
| `modules/audit/src/audit-evidence-read-postgresql.ts` | YES | YES | 기존 Audit 저장/재실행 participant의 최소 확장 |
| `modules/audit/src/first-human-audit-contract.ts` | YES | YES | Audit 소유의 필요한 bootstrap event 계약 |
| `modules/audit/src/first-human-bootstrap-audit.ts` | YES | YES | 기존 Audit participant에 같은 UoW client를 전달; 독립 engine/commit 없음 |
| `modules/audit/src/first-human-bootstrap-audit.test.ts` | YES | YES | 같은 client/transaction 및 payload 제한 검증 |
| `apps/api/src/first-human-bootstrap-production.ts` | YES | YES | 승인된 Identity UoW·Audit·pool port를 연결; 새 DB client/API/authority 경로 없음 |
| `apps/api/src/first-human-bootstrap-schema.ts` | YES | YES | 단일 scoped post-apply verifier; 기존 startup이 같은 predicate 재사용 |
| `apps/api/src/first-human-bootstrap-schema-expected.ts` | YES | YES | 위 verifier의 정확한 catalog 자료; 독립 verifier 아님 |
| `apps/api/src/first-human-bootstrap-schema.test.ts` | YES | YES | 같은 verifier의 drift/권한/major 거부 검증 |
| `modules/audit/migrations/postgresql/production/003_first_human_bootstrap_events_v1.up.sql` | YES | YES | Audit schema owner의 forward 확장; Audit001/002 불변 |
| `modules/audit/migrations/postgresql/production/003_first_human_bootstrap_events_v1.up.sql.sha256` | YES | YES | 같은 canonical migration artifact 고정 |
| `scripts/rel002-first-human-composition-local.mjs` | YES | YES | 승인된 owned/disposable local fixture만 사용; Production 대체 access path 아님 |
| `docs/diagnostics/REL002_MIGRATION024_BOOTSTRAP_READ_ONLY_PREFLIGHT.sql` | YES | YES | 단일 단계 구분 SELECT-only preflight; writer/authority 생성 없음 |
| `apps/api/src/r3c2c-catalog-compatibility.ts` | YES | YES | 기존 forward R3C2C consumer에 정확한 Audit003 profile만 확장 |
| `apps/api/src/r3c2c-catalog-compatibility.test.ts` | YES | YES | 같은 consumer의 19-component/authority/mixed-state 거부 검증 |
| `apps/api/src/r3c2-aggregate-readiness.ts` | YES | YES | 기존 aggregate에서 024를 검증 후 분리; 새 startup pipeline 없음 |
| `apps/api/src/rel002-r3c2-aggregate-readiness.test.ts` | YES | YES | 같은 canonical aggregate의 partial/drift 거부 검증 |

Bootstrap session은 승인된 `BOOTSTRAP_AUTHORITY_V1`의 제한된 Identity lifecycle로, 기존 Session persistence에 기록되고 일반 SessionService의 read/refresh 경로에서 거부된다. 별도 session table/engine, 일반 authority bypass 또는 영구 bootstrap flag를 추가하지 않는다. TOTP는 Identity 소유이며 Audit003은 별도 Audit DB/queue/engine을 만들지 않는다. Migration024는 기존 `app_identity`/migration owner를 유지한다.

판정: `ARCHITECTURE_CONFORMANCE_CHECK = PASS`, `ARCHITECTURE_DRIFT_DETECTED = NO`. 현재 local PASS evidence는 관련 source가 변경되지 않아 재사용한다. 실제 외부 owner proof/key custody와 Production 적용은 여전히 별도 경계이며, 이 문서 작업에서는 제품 source/migration/Production 상태를 변경하지 않는다. 범용 registry/KMS/recovery/evidence engine, parallel verifier/startup/auth/session 경로는 계속 POST-MVP로 연기한다.

최단 경로: 필수 Human A/B enrollment 입력·secret custody 해결 → 최소 schema/Audit integration 확인 및 별도 승인된 적용 → Human A/B 생성 → authentication + TOTP → bootstrap sessions → first-authority ceremony → startup binding → Railway MVP deployment → Human product test → 요청된 수정 → 승인된 autonomous background validation.

---

## 1. 문서 목적

이 문서는 AI-MLS 개발 과정에서 다음 두 목표를 동시에 달성하기 위한 운영 기준이다.

1. Production, credential, migration, deployment, destructive action 등 되돌리기 어려운 경계는 엄격하게 통제한다.
2. 이미 승인된 Local/Source 범위 안에서는 불필요한 재검토와 반복 Human Gate를 줄여 개발 속도를 높인다.

핵심 원칙:

> **되돌리기 어려운 경계에서는 보수적으로, 그 외에는 효율적으로 진행한다.**

---

## 2. 변경된 핵심 개발 목표

### 2.1 Production 안정성 최우선
- Production DB, role/ACL, migration, credential, deployment, registration execution은 항상 Human Gate를 유지한다.
- Production readiness PASS가 다음 Production action을 자동 승인하지 않는다.

### 2.2 Local / Source 작업의 자율성 확대
- 이미 승인된 범위 안에서는 Codex가 구현 → 진단 → 수정 → 재검증까지 한 번에 완료한다.
- 작은 local defect마다 Human 승인으로 돌아오지 않는다.

### 2.3 검증의 계층화
- 구현 중: focused tests
- stable candidate: affected tests + build/typecheck/lint/diff/secret scan
- full regression: stable release candidate 또는 실제 broad/high-risk shared-core 변경에만 적용
- 이전 PASS evidence는 relevant path/contract/hash가 바뀌지 않았다면 재사용한다.

### 2.4 Historical contract 보호
- historical migration/verifier/fingerprint/evidence를 PASS를 만들기 위해 수정하지 않는다.
- 필요 시 forward-only compatibility 또는 새 versioned artifact를 사용한다.

### 2.5 Architecture boundary 보호
권장 dependency 방향:

```text
Canonical contract
→ Production composition
→ injected generic interface
→ infrastructure adapter
```

피해야 할 방향:

```text
lower-level generic infrastructure
→ higher-level Production/readiness contract
```

### 2.6 개발 속도 개선
- 작은 수정마다 설계검토 → 구현 → 재검토 → stage 검토 → commit 검토를 반복하지 않는다.
- 승인된 local scope 안에서 가능한 수정과 검증을 하나의 work package로 묶는다.

---

## 3. Authority Model

### 3.1 ChatGPT / Architecture Owner (AO)
AO는 다음을 담당한다.

- architecture 정의
- scope 정의
- authority boundary 정의
- safety requirement 정의
- acceptance criteria 정의
- Human Gate 결정
- Production / release risk 검토

AO는 local implementation defect마다 새 승인을 요구하지 않는다.

### 3.2 Human Operator
Human은 다음에 대한 최종 권한을 가진다.

- Production mutation / migration
- role / ACL / ownership 변경
- credential 생성 / reset / replacement / rotation
- staging / Production deployment
- destructive operation
- registration DRY_RUN
- actual registration
- release activation
- release 의미가 있는 commit / push

### 3.3 Codex / Repository Implementer
Codex는 승인된 scope 안에서 다음을 자율 수행할 수 있다.

- source inspection
- implementation
- test 작성/수정
- diagnostic
- local correction
- focused/affected validation
- bounded local disposable validation
- completion report 갱신
- final commit candidate 준비

Codex는 다음 경계를 넘을 때 반드시 정지한다.

- architecture 변경
- authority 변경
- scope 확대
- Production mutation
- migration
- credential 변경
- deployment
- destructive action
- AIDOS conflict
- historical immutable artifact 변경

### 3.4 AIDOS
AIDOS가 적용되는 경우 AIDOS는 development orchestration authority이다.

- ownership gate 우회 금지
- AIDOS state 강제 overwrite 금지
- validator/release gate bypass 금지
- conflict 발생 시 reconciliation 우선

---

## 4. 핵심 운영 원칙

> **이미 승인된 Local/Source 범위 안에서는 Codex가 구현부터 진단·수정·검증까지 완료하고, architecture·authority·Production·deployment·migration·credential·destructive boundary를 넘을 때만 Human에게 다시 묻는다.**

---

## 5. Scope Batching Rule

한 번 승인된 task scope 안에서는 Codex가 다음을 묶어서 수행한다.

- 코드 구현
- focused test
- defect 진단
- defect 수정
- affected test
- local disposable validation
- static analysis
- diff check
- secret scan
- report 갱신

다음 조건을 만족하면 작은 blocker마다 Human Gate를 만들지 않는다.

- architecture 변경 없음
- authority 변경 없음
- Production 직접 영향 없음
- credential 변경 없음
- migration 추가 없음
- deployment 없음
- destructive action 없음
- approved scope 확대 없음

---

## 6. Human Gate가 반드시 필요한 경우

다음 항목은 항상 새 Human Gate를 요구한다.

1. 새 Phase 또는 Feature 시작
2. architecture 또는 authority boundary 변경
3. scope 확대
4. Production migration 생성/실행
5. Production DB mutation
6. Production `ALTER ROLE`
7. Production `GRANT / REVOKE`
8. Production ownership 변경
9. credential creation/reset/replacement/rotation
10. staging/Production deployment
11. Railway/Vercel/Supabase configuration mutation
12. registration DRY_RUN
13. actual registration
14. destructive filesystem/database action
15. historical migration/verifier/fingerprint 변경
16. AIDOS/security/release gate conflict
17. release 의미가 있는 commit/push가 명시적으로 gate된 경우

---

## 7. Validation Strategy

### Tier 1 — 구현 중
사용:
- focused unit tests
- narrow diagnostics
- static checks
- mock tests
- bounded disposable tests

하지 않음:
- 작은 수정마다 full regression
- 변경 없는 historical 영역의 반복 검증

### Tier 2 — Stable Candidate
실행:
- focused tests
- affected tests
- build
- typecheck
- scoped lint
- `git diff --check`
- secret scan
- relevant immutability checks

### Tier 3 — Commit / Release Candidate
Full regression은 stable release candidate 또는 실제 광범위하고 위험한 shared-core 변경일 때만 실행한다. 일반 commit candidate에 자동 요구하지 않는다.

Historical known failure 재사용 조건:
- failing test 동일
- failure signature 동일 또는 unrelated임이 독립적으로 증명
- 새 failure 없음
- candidate가 historical failure surface를 변경하지 않음

failure signature가 바뀌면 원인을 진단한 후 승인한다.

---

## 8. Existing PASS Evidence 재사용 원칙

아래가 변경되지 않았다면 이전 PASS evidence를 재사용할 수 있다.

- relevant source paths
- contract hashes
- fingerprints
- dependency reachability
- environment assumptions
- authority model

예:
- historical017 / 022 / 023 immutability
- Forward Authority contract
- R3C2 fingerprints
- Production ZERO_DELTA snapshot
- role/membership topology

반복 full validation보다 hash/diff 기반 확인을 우선한다.

---

## 9. Diagnostic Rule

실패 발생 시:

1. first failing gate 확인
2. original failure evidence 보존
3. exact root cause 진단
4. 승인된 범위 안에서 narrowest correction 수행
5. 필요한 focused/affected validation만 재실행
6. architecture/authority/Production boundary가 바뀔 때만 escalation

**Local defect 발견 자체는 새 Human Gate 사유가 아니다.**

---

## 10. Production Safety Rule

다음은 서로 분리된 controlled Human operation으로 유지한다.

- Production catalog inspection
- Production role/ACL change
- Production migration
- credential rotation
- deployment
- Production readiness execution
- Registration DRY_RUN
- Actual registration
- release activation

**Production readiness PASS는 다음 Production action을 자동 승인하지 않는다.**

---

## 11. Local Disposable Validation

다음 조건이면 반복 Human 승인 없이 수행할 수 있다.

- loopback/local-only
- non-Production
- owned/disposable
- real credential 없음
- external delivery 없음
- fixture 밖 destructive impact 없음
- cleanup 수행
- evidence에 `LOCAL / DISPOSABLE` 명시

Local evidence는 Production evidence로 간주하지 않는다.

---

## 12. Git Workflow

### Candidate Review
commit 전 확인:
- exact changed file scope
- relevant tests
- `git diff --check`
- secret scan
- unrelated staged file 없음
- historical/untracked evidence 보존

### Stage + Commit
final candidate review 승인 후:
- exact approved files만 stage
- staging에서 새 문제가 없으면 commit 가능
- stage 후 반복 재검토 최소화

### Push
governance가 요구하면 별도 Human Gate 유지.

### 금지
unrelated untracked evidence가 있을 때:

```text
git add .
git add -A
```

사용 금지. Exact file list를 사용한다.

---

## 13. Historical Evidence / Immutable Artifacts

절대 하지 않는다.

- migration 수정해서 PASS 만들기
- verifier 수정해서 PASS 만들기
- fingerprint expectation 변경해서 PASS 만들기
- FAIL report를 PASS로 덮어쓰기

대신:
- forward-only compatibility
- new versioned artifact
- mismatch documentation
- traceability preservation

을 사용한다.

---

## 14. Secret Handling

절대 출력/공유/commit 금지:

- password
- full DB URI
- CA PEM content
- raw environment secret dump
- credential in command arguments
- sealed Production secret을 prohibited CLI/log/shell로 추출

사용 방식:
- Human secure source
- masked interactive input
- process-scoped environment
- one-shot operator process
- cleanup after execution

Secret presence는 `PRESENT / MISSING`만 보고한다.

---

## 15. Efficiency Rules

앞으로 기본 적용:

1. local implementation corrections를 묶어서 처리
2. 작은 test failure마다 approval 요청 금지
3. full regression 반복 금지
4. unchanged PASS evidence 재사용
5. final candidate review를 1회 중심으로 운영
6. Local/Source 작업과 Production Gate 분리
7. meaningful authority boundary에서만 stop
8. blocker가 없으면 보고를 짧게 유지
9. manual 재검토보다 automated bounded validation 우선
10. audit 필요가 없으면 micro-step report 생성 최소화

---

## 16. Default Codex Operating Rule

### Codex가 계속 진행해야 하는 조건
다음이 모두 true이면 승인된 scope 안에서 계속 진행한다.

- approved task
- local/source-only
- architecture change 없음
- authority change 없음
- Production mutation 없음
- deployment 없음
- credential change 없음
- destructive action 없음
- migration change 없음
- AIDOS conflict 없음
- release boundary 없음

### Codex가 멈춰야 하는 조건
하나라도 true이면 stop/report 한다.

- architecture decision 필요
- scope expansion 필요
- Production mutation 필요
- credential change 필요
- deployment 필요
- migration 필요
- destructive operation 필요
- AIDOS ownership conflict
- security/approval gate conflict
- historical immutable contract 변경 필요

---

## 17. Blocker Report Format

blocker 발생 시 기본 보고:

```text
PROJECT =
BRANCH / WORKTREE =
CURRENT TASK =
LAST SUCCESSFUL STEP =
EXACT BLOCKER =
VERIFICATION COMPLETED =
ACTIONS NOT PERFORMED =
REQUIRED HUMAN ACTION =
SAFEST NEXT STEP =
```

multi-page review는 꼭 필요한 경우에만 작성한다.

---

## 18. Phase Completion Rule

Phase 완료 조건:

- approved scope 구현 완료
- required focused/affected validation PASS
- historical known failure classification 완료
- approved scope 내부 blocker 없음
- Production/release gate 명확
- commit candidate bounded

scope 또는 authority가 바뀌는 next phase는 자동 시작하지 않는다.

---

## 19. 현재 REL002 적용 규칙

현재 AI-MLS REL002에서는:

- Local/source correction은 approved scope 안에서 Codex가 end-to-end로 완료 가능
- historical017 / 022 / 023 immutable
- Production role/ACL mutation 별도 gate
- Railway mutation 별도 gate
- Production readiness execution Human-controlled
- Registration DRY_RUN 별도 gate
- Actual registration 별도 gate
- Production deployment 별도 gate
- Full regression은 stable release candidate 또는 실제 broad/high-risk shared-core 변경에만 실행

---

## 20. Priority Order

충돌 시 우선순위:

1. Security / credential protection
2. Human Production authority
3. AIDOS / governance authority
4. Data integrity / recoverability
5. Historical evidence immutability
6. Architecture correctness
7. Test / release correctness
8. Development speed

속도 개선은 1~7을 침해하지 않는다.

---

## 21. Final Rule

> **되돌리기 어려운 경계에서는 보수적으로, 그 외에는 효율적으로 진행한다.**

이 문서의 목적은 validation quality를 낮추는 것이 아니라:

- 검증을 올바른 경계로 이동하고
- 중복 approval loop를 제거하고
- Codex가 bounded local work package를 빠르게 완료하도록 하며
- Production / governance control은 엄격하게 유지하는 것이다.
