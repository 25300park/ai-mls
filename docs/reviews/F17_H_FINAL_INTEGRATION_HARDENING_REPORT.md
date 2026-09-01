# F17-H Final Integration / Hardening Report

| 항목 | 값 |
|---|---|
| Version | v0.1 |
| Status | APPROVED |
| Baseline | `4db36df9f0d7cfa7ce169bd265c908d0fe9539a7` |
| Branch | `codex/f17-h-final-integration` |
| Final Recommendation | `APPROVE_F17_H_FINAL_INTEGRATION_HARDENING` |
| Commit | 이 report를 포함하는 단일 F17-H local evidence commit (Git metadata 기준) |
| Push | NOT_PERFORMED |

## 1. Objective / Scope

승인된 F17-B/C/D/E/F의 canonical HTTP, authorization, durable execution, provider normalization, retry/replay 경계를 검증한다. 이 문서는 audit 직전 checkpoint이며 완료 승인 또는 F17 Final Gate 승인이 아니다.

F17-G는 DEFERRED이다. F18/F19/F20/F21은 NOT_STARTED이다. 실제 provider/credential 활성화, Console mutation, 새로운 API/state/authority/recovery 의미는 추가하지 않았다.

## 2. Documents / Canonical Evidence

- Architecture Owner의 F17-H Final Integration / Hardening Brief §§1–30.
- [F17-H 계획](../implementation/F17_H_FINAL_INTEGRATION_PLAN.md).
- [FEAT015 RTM](../implementation/FEAT015_TRACEABILITY_MATRIX.md) §§4.5–4.8.
- [F17-D 보고서](F17_D_CLOSED_API_014_RUNTIME_HTTP_IMPLEMENTATION_REPORT.md), [F17-E 보고서](F17_E_PROVIDER_BOUNDARY_FOUNDATION_IMPLEMENTATION_REPORT.md), [F17-F 보고서](F17_F_FAILURE_RETRY_ELIGIBILITY_IMPLEMENTATION_REPORT.md).
- [Architecture v1.1 manifest](../freeze/ARCHITECTURE_V1_1_BASELINE_MANIFEST.md).

Canonical ownership는 유지한다: API-014 business admission/outcome, API-015 Target governance, API-018 bounded technical execution/evidence, API-019 provider contract/evidence. Provider는 승인·권한·lifecycle authority를 생성하지 않는다.

## 3. Concrete Findings and Minimum Corrections

| Finding | RED 증거 | 최소 수정 | 현재 결과 |
|---|---|---|---|
| H-001 요청 purpose 무시 | 실제 HTTP에서 `CLIENT_SERVICE`가 `PUBLICATION_EXECUTION`으로 덮어써졌다. version 1 → 3, attempt/UNKNOWN receipt가 생성되었다. | `apps/api/src/publication-api.ts`의 `domainContext()`가 원래 `request.purpose`를 기존 guard에 전달한다. | GREEN |
| H-002 요청 team scope 무시 | `teamId=team-other`, `tenantId=team-a` 요청이 무시되어 dispatch/state 변경이 발생했다. | `validateCommandRequest()`에서 기존 Application tenant/team 일치 조건을 확인하고 `AUTHORIZATION_DENIED`로 거부한다. Session 및 live guard는 그대로 유지한다. | GREEN |

Production 변경: 위 API adapter 1파일, 2개 경계 결함만 수정했다. Domain/UoW/provider/retry 규칙 및 API operation 목록 변경은 0이다. 최초 child-process 테스트의 Application 구성 누락, readonly fixture 수정, JSON 응답 타입 lint 3건은 test-only 오류로 교정했으며 production 결함으로 집계하지 않는다.

## 4. Direct F17-H Verification

| 실제 테스트 | 검증 assertion |
|---|---|
| `publication-api-http-runtime.test.ts`: `F17-H real HTTP production execution persists unavailable outcome and replay remains contained after reopen` | 실제 loopback Node HTTP production composition → create → publish → unavailable UNKNOWN/RECONCILIATION_REQUIRED; durable receipt/actor audit/idempotency, reopen 후 동일 receipt/aggregate/audit; query side effect 없음 |
| 같은 파일: `F17-H real HTTP live authorization matrix blocks dispatch and durable state mutation` | 18개 시나리오: unauthenticated, capability, revoked/expired Session, tenant, scope, contradictory team request, purpose, MFA, SoD, expired/revoked approval, representation, target state/version, aggregate version, Verification, Permission. Aggregate unchanged, intent/receipt/성공 idempotency 없음, safe response |
| 같은 파일: `F17-H real HTTP reconciliation and recovery never elevate caller-authored evidence` | 두 기존 operation × resolution 포함/생략; caller category/evidence 거부, 400 VALIDATION_ERROR, aggregate/audit unchanged, attempt 0, idempotency 없음 |
| `publication-service.test.ts`: `F17-H actual process exit inside provider invocation leaves durable ambiguity and prevents restart resend` | child process가 provider 호출 내부에서 실제 exit 81; 이미 durable DISPATCH_STARTED임을 확인; reopen 시 receipt 없음/ambiguity, replay 후 UNKNOWN receipt/reconciliation, provider 재호출 0, 기존 intent/audit 보존 |

각 테스트는 기존 production path를 실행한다. 외부 provider는 production unavailable 또는 명시적 no-network test boundary뿐이다. Child 종료 테스트는 실제 프로세스 종료/reopen을 증명하지만 OS/power-loss 및 물리 디스크 장애를 시뮬레이션했다고 주장하지 않는다.

## 5. B/C/D/E/F and Cross-Layer Evidence

| 영역 | 실제 근거 / 범위 | 현재 판정 |
|---|---|---|
| F17-B | `publication-execution-eligibility.test.ts`, service BLOCKED tests, H HTTP authorization matrix | PASS |
| F17-C | `publication-durable-persistence.test.ts`, service receipt-failure/reopen 및 H process exit | PASS |
| F17-D | `publication-api-http-runtime.test.ts`, `publication-canonical-api-runtime.test.ts`; closed 12 commands + 6 queries | registration/dispatch 18/18 PASS |
| F17-E | `publication-provider-test-adapter.test.ts`, infrastructure injection rejection, service malformed/accessor/unsafe/timeout/connection tests | PASS |
| F17-F | `publication-durable-retry.test.ts`, `publication-execution-failure.test.ts`, durable service retry/claim/concurrency tests | PASS |
| Authorization/isolation | `publication-authorization.test.ts` + H HTTP 18시나리오 + durable retry live matrix | PASS |
| Internal atomicity | durable CAS/rollback/append-only tests, receipt commit failure, durable retry evidence rollback | PASS |
| External ambiguity | UNKNOWN/timeout/connection/receipt failure/process exit/restart tests; receipt 없음은 non-delivery 증거가 아님 | PASS |
| HTTP security | closed schema, bounded body, error/concealment, H caller evidence rejection | PASS |
| Dependency direction | `publication-end-to-end-architecture.test.ts` 및 runtime/HTTP/Infrastructure architecture assertions | PASS |

18/18은 closed contract의 registration/dispatch 검증이다. 모든 command의 외부 성공/새 workflow 구현을 뜻하지 않는다. `RESOLVE_RECONCILIATION`/`RECOVER_PUBLICATION`의 untrusted HTTP evidence는 fail-closed이며 F19 구현으로 계산하지 않는다. Production은 실제 provider delivery를 수행하지 않는다.

CONFIRMED/REJECTED/UNKNOWN durable 결과, stable provider identity, 이전 attempt/receipt 보존은 기존 service 및 durable tests의 실제 assertion으로 재검증했다. 외부 provider 호출과 SQLite commit이 하나의 transaction이라고 주장하지 않는다.

## 6. Verification Results

Runtime: Node `v24.18.0`, pnpm `11.9.0`.

| Gate / 실행 | 결과 |
|---|---|
| `tsc -b tsconfig.build.json` + `node --test --test-name-pattern='F17-H'` (위 두 파일) | 4/4 PASS; matrix 18시나리오 포함 |
| `node --test --test-name-pattern='F17-[B-F]'` (F17 B–F 관련 9개 파일) | 55/55 PASS |
| Publication module + API의 `publication*.test.js` affected tests | 최종 449/449 PASS |
| `pnpm.cmd --config.verify-deps-before-run=false --config.update-notifier=false run verify` | exit 0; lint/typecheck/build/test PASS |
| Full tests | 832/832 PASS, fail/cancel/skip 0 |
| Architecture checksum | 153/153 PASS |
| `git diff --check` | PASS |
| `gitleaks dir . --redact --no-banner --config .gitleaks.toml` | exit 0, findings 0 |
| Dependency/lockfile diff | 0 |

첫 verify는 test-only lint 3건에서 중단되어 full suite가 실행되지 않았다. 수정 후 verify에서 full suite를 한 번 실행했다. Install/update/audit --fix는 실행하지 않았다.

Immutable manifest commit `426f6de0cdcf8c384f70c3e333f7b6483616bd15`의 sorted path/blob checksum: `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778`. 현재 153개 architecture 파일도 승인된 F17-F baseline 대비 변경 0이다.

## 7. Audit / Independent Review / Open Decisions

- Production Audit: exit 0, vulnerabilities 0 (모든 severity 0).
- Full Audit: exit 1, development-only transitive `brace-expansion` High 4, Critical/Moderate/Low/Info 0. F17-F에서 승인·기록된 advisory와 동일하며 신규 finding은 없다.
- New Unapproved High/Critical: 0.
- Independent Review: Critical 0 / Important 0 / Minor 0 — READY.

Architecture Owner의 F17-H 한정 승인 후 아래 명령만 실행했다. Registry는 `https://registry.npmjs.org`로 고정했다. Source/secret/credential/environment/business/provider data 전송, install/update/override, `audit --fix`는 실행하지 않았다. Dependency/lockfile diff는 실행 전후 0이다.

| 명령 | Exit | 결과 |
|---|---:|---|
| `pnpm.cmd --config.update-notifier=false --config.fetch-retries=0 audit --prod --registry=https://registry.npmjs.org --json` | 0 | advisories 0; dependencies 0 |
| `pnpm.cmd --config.update-notifier=false --config.fetch-retries=0 audit --registry=https://registry.npmjs.org --json` | 1 | devDependencies 110; High 4, 그 외 severity 0 |

| Advisory ID / GHSA | affected package/version | dependency path summary | 직접성 / 상태 |
|---|---|---|---|
| `1130588`, `GHSA-mh99-v99m-4gvg` | `brace-expansion@1.1.16`, `<1.1.17` | `eslint → minimatch → brace-expansion` 및 `typescript-eslint → eslint → minimatch → brace-expansion`, 36 paths | development-only transitive / 기존 승인 baseline |
| `1130591`, `GHSA-mh99-v99m-4gvg` | `brace-expansion@5.0.7`, `>=4 <5.0.8` | `typescript-eslint → typescript-estree → minimatch → brace-expansion`, 7 paths | development-only transitive / 기존 승인 baseline |
| `1130734`, `GHSA-rgw5-rvv9-x895` | `brace-expansion@5.0.7`, `>=4 <5.0.9` | 동일 7 development toolchain paths | development-only transitive / 기존 승인 baseline |
| `1130737`, `GHSA-rgw5-rvv9-x895` | `brace-expansion@1.1.16`, `<1.1.18` | 동일 36 ESLint toolchain paths | development-only transitive / 기존 승인 baseline |

Fresh independent review는 actual assertions와 production execution path를 확인했다. Purpose는 기존 authorization guard로 전달되고 contradictory tenant/team은 simplified identity mapping 전에 거부된다. Closed 12+6 operation, provider/UoW/retry/reconciliation authority 및 future-phase 경계는 변경되지 않았다. Durable intent/dispatch/receipt/reopen, process-exit ambiguity provider reinvocation 0, authorization denial zero mutation, caller evidence rejection assertion을 확인했으며 actionable finding은 0이다.

## 8. Scope Protection / Limitations

- Production provider activation 0; credentials/raw response leakage는 실행된 테스트 및 Gitleaks에서 0.
- Blind resend 및 restart blind retry: 검증한 경로에서 0.
- 새 API/operation/state/authority/DB subsystem/dependency/Console mutation 0.
- In-memory production fallback 없음; 실제 delivery/provider integration은 승인하지 않는다.
- F17-G DEFERRED; F18/F19/F20/F21 NOT_STARTED.
- 본 문서는 조건부 완료 승인이나 formal closure가 아니다. 독립 검토 또는 audit finding이 생기면 결과를 갱신한다.

## 9. Files / Git

Created: 본 report, F17-H implementation plan.

Modified: `apps/api/src/publication-api.ts`, 직접 테스트 2파일, [FEAT015 RTM](../implementation/FEAT015_TRACEABILITY_MATRIX.md) §4.8.

Commit 전 working tree에는 위 F17-H 변경만 존재한다. Main baseline은 clean 상태로 변경하지 않았다. Push NOT_PERFORMED. Main merge NOT_PERFORMED.

## 10. Next Required Step

승인된 단일 local commit과 clean 확인 후 STOP. F17 Final Gate: READY. F18/F19/F20/F21은 별도 승인 전 시작하지 않는다.
