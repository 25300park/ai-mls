# REL-002 R3-A Production Dependency Composition Foundation Completion Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-252 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Development Owner |
| 완료일 | 2026-09-29 |
| Brief | REL-002 R3-A — Production Dependency Composition Foundation |

## 1. Objective

Railway Production 실행 경로를 재설계하지 않고, `createRailwayProductionDependencies()`의 기존 placeholder 가운데 이미 승인된 adapter로 증명 가능한 경계만 연결한다. 아직 Production-ready하지 않은 경계는 명시적으로 분류하고 `PRODUCTION_STARTUP_UNAVAILABLE`로 fail closed 상태를 유지한다.

## 2. Documents read

- [Document Governance](../00_DOCUMENT_GOVERNANCE.md)
- [Glossary](../00_GLOSSARY.md)
- [Phase 2D-0D Railway Variable Matrix](../implementation/REL002_PHASE2D0D_RAILWAY_VARIABLE_MATRIX.md)
- [Phase 2D-0D Build / Start / Healthcheck Contract](../implementation/REL002_PHASE2D0D_BUILD_START_HEALTHCHECK_CONTRACT.md)
- [Phase 2D-0I Rotation / Revocation Runbook](../implementation/REL002_PHASE2D0I_ROTATION_REVOCATION_RUNBOOK.md)

## 3. Files created

- [본 Completion Report](REL002_R3A_PRODUCTION_DEPENDENCY_COMPOSITION_COMPLETION.md)

## 4. Files modified

- [`production-bootstrap.ts`](../../apps/api/src/production-bootstrap.ts): R3-B child-root options가 준비되지 않은 상태를 `null`로 표현하고 canonical runtime 진입 전에 명시적으로 차단한다.
- [`production-main.ts`](../../apps/api/src/production-main.ts): R3-A dependency classification, PostgreSQL Session UoW, canonical listener starter와 shared readiness wiring을 추가했다.
- [`production-main.test.ts`](../../apps/api/src/production-main.test.ts): exact classification, PostgreSQL Session UoW, fail-closed remainder와 Production authority rejection을 검증한다.

## 5. Key decisions added

새 architecture decision은 추가하지 않았다. 기존 `ProductionBootstrap`, `PostgreSqlSessionUnitOfWork`, `ProductionHttpHost`/listener 및 Railway sealed-secret 경계를 그대로 재사용한다.

| Dependency | Classification | R3-A result |
|---|---|---|
| `openIdentityAuthorityReadOnly` | `EXISTING_BUT_NOT_PRODUCTION_COMPOSABLE` | `RegisteredServiceWorkloadIdentityEvidenceQueryPort`와 `ReadOnlyAuditEvidenceQueryPort`의 Production 구현 부재로 fail closed |
| `validateHumanIdentityAuthority` | `NEW_IMPLEMENTATION_REQUIRED` | fail closed |
| `resolveRequiredServiceIdentities` | `EXISTING_BUT_NOT_PRODUCTION_COMPOSABLE` | async/evidence-backed Production composition 부재로 fail closed |
| `resolveRequiredSecrets` | `EXTERNAL_PREREQUISITE` | DB pool 외 추가 binding은 fail closed |
| `validateStartupGate` | `NEW_IMPLEMENTATION_REQUIRED` | fail closed |
| `createSessionUnitOfWork` | `EXISTING_APPROVED_ADAPTER` | `PostgreSqlSessionUnitOfWork` 연결 |
| `assertComponentSchemasReady` | `REQUIRES_R3_B_CHILD_ROOT_POSTGRES` | fail closed |
| `childRootOptions` | `REQUIRES_R3_B_CHILD_ROOT_POSTGRES` | `null` unavailable boundary로 canonical child-root factory 진입 전에 fail closed |
| `startListeners` | `EXISTING_APPROVED_ADAPTER` | 기존 single-listener starter 연결 |
| `startWorkers` | `NEW_IMPLEMENTATION_REQUIRED` | fail closed |

## 6. Open decisions

- **OPEN DECISION:** R3-B에서 API-014/API-015/API-018/API-019/FEAT-022 PostgreSQL adapter와 component schema readiness를 확정해야 한다. Owner: Architecture / Development Owner. Target: R3-B entry.
- **OPEN DECISION:** Production human identity authority, evidence-backed service identity query adapter, startup validation fingerprint와 worker composition owner를 후속 승인해야 한다. Owner: Architecture / Security Owner. Target: 후속 R3 phase.

## 7. Inconsistencies found

기존 Phase 2D-0D 문서는 Production executable과 `/readyz`가 미구현이라고 기록하지만, 후속 승인 구현으로 현재 repository에는 둘 다 존재한다. 역사 문서는 수정하지 않았으며 현재 source와 본 보고서에서 successor state를 기록했다.

## 8. Validation performed

| 검사 | 방법 | 결과 |
|---|---|---|
| TDD RED | 신규 focused test 실행 | PASS — classification/Session placeholder 및 unsafe empty child-root options/listener factory 미주입을 검출 |
| Focused | `production-main.test.js` | PASS — 10/10 |
| Affected | Production bootstrap/config/secret/listener/child-root tests | PASS — 42/42 |
| Full regression | `pnpm run test` | 1612 PASS / 1 existing historical fingerprint failure / 5 SKIP |
| Historical failure | immutable Blocker 2C exact-candidate fingerprint | `EXPECTED_STALE_HISTORICAL_CANDIDATE_FINGERPRINT` |
| Build/Lint/Typecheck | repository scripts | PASS / PASS / PASS |
| Markdown links / IDs | target 존재 및 corrected `DOC-REVIEW-252` uniqueness 검사 | PASS |
| Scope restriction | Git diff 및 dependency/lockfile 검사 | PASS — source 2, test 1, docs 1; dependency/lockfile 0 |
| Secret scan | 변경 4개 파일 `gitleaks dir --redact` | PASS — 0 findings |
| `git diff --check` | current bounded diff | PASS |
| Independent Review | read-only review | READY — Critical 0 / Important 0 / Minor 0 |

## 9. Known limitations

- R3-A 종료 후 Production은 의도적으로 `BLOCKED`다.
- Identity evidence authority, human identity validation, service identity resolution, startup gate, child-root PostgreSQL persistence/schema readiness와 workers는 구현하지 않았다.
- Railway, Supabase, Vercel, Production database 및 credential에 mutation을 수행하지 않았다.

## 10. Next brief prerequisites

- R3-B에서 다섯 child root의 PostgreSQL persistence와 schema readiness를 승인된 범위로 구현한다.
- R3-B 이후에도 미해결 authority/gate/worker 경계를 별도 phase로 유지한다.

## Required report

| 항목 | 결과 |
|---|---|
| Current placeholder count | 10 |
| Wired existing approved adapters | 2 — `createSessionUnitOfWork`, `startListeners` |
| Still fail-closed placeholders | 8 |
| Placeholder classification matrix | 본 문서 5절의 10/10 matrix |
| Production Identity PostgreSQL wiring | PASS — sealed `PG_IDENTITY_POOL` + `PostgreSqlSessionUnitOfWork`; identity evidence authority는 별도 fail-closed 경계 |
| Runtime DB role | `ai_mls_production_runtime` |
| Migration credential excluded | PASS |
| SQLite Production fallback | ABSENT |
| Raw `DATABASE_URL` | REJECTED |
| Duplicate runtime path | ABSENT — listener 1개, worker engine 0개 |
| Focused | 10/10 PASS |
| Affected | 42/42 PASS |
| Full regression | 1612 PASS / 1 authorized immutable historical fingerprint failure / 5 SKIP |
| Build / Lint / Typecheck | PASS / PASS / PASS |
| `git diff --check` | PASS |
| Secret scan | 0 findings |
| Independent Review | READY — Critical 0 / Important 0 / Minor 0 |
| Production deployability after R3-A | BLOCKED |
| Expected next phase | R3-B |
| Production / Railway / Supabase mutation | 0 / 0 / 0 |
| Commit | `NOT_CREATED` |
| Push | `NOT_PERFORMED` |
| Final Recommendation | `APPROVE_REL002_R3A_PRODUCTION_DEPENDENCY_COMPOSITION` |

## Completion statement

R3-A는 기존 approved adapter만 연결하고 미완료 경계를 명시적으로 fail closed로 유지한다. 모든 R3-A 검증과 독립 검토가 완료되었으므로 `APPROVE_REL002_R3A_PRODUCTION_DEPENDENCY_COMPOSITION`을 권고한다. Production deployability는 `BLOCKED`이며 R3-B는 별도 승인 전 시작하지 않는다.
