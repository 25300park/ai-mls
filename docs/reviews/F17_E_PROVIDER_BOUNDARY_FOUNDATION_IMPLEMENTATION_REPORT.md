# F17-E Provider Boundary Foundation Implementation Report

| 항목 | 값 |
|---|---|
| Version | v0.1 |
| Status | IN REVIEW |
| 기준일 | 2026-08-31 |
| Final Recommendation | `APPROVE_F17_E_PROVIDER_BOUNDARY_FOUNDATION` |
| Baseline | `02b157c724c034e76ce2ed224f83d0d815b3f00c` |
| Branch | `codex/f17-e-provider-boundary` |

## 1. Objective

승인된 Option 1에 따라 production-unavailable enforcement, deterministic no-network test adapter, immutable provider-result normalization을 구현했다. Offline gate와 F17-E 전용 승인에 따른 dependency audit을 완료했으며 F17-E 범위의 완료를 권고한다. 실제 provider 활성화나 다음 phase 승인은 포함하지 않는다.

## 2. Documents read

- Architecture Owner의 F17-E Brief 및 Provider Boundary Foundation Design approval
- [Approved Design](../implementation/F17_E_PROVIDER_BOUNDARY_DESIGN.md)
- [Implementation Plan](../implementation/F17_E_PROVIDER_BOUNDARY_IMPLEMENTATION_PLAN.md)
- [F17-C Report](F17_C_DURABLE_PUBLICATION_EXECUTION_IMPLEMENTATION_REPORT.md)
- [F17-D Report](F17_D_CLOSED_API_014_RUNTIME_HTTP_IMPLEMENTATION_REPORT.md)
- [FEAT-015 RTM](../implementation/FEAT015_TRACEABILITY_MATRIX.md), repository `AGENTS.md`
- 기존 Publication dispatcher, infrastructure, coordination service, durable persistence 및 API-014 HTTP/runtime contracts

## 3. Files created

- `docs/implementation/F17_E_PROVIDER_BOUNDARY_DESIGN.md`
- `docs/implementation/F17_E_PROVIDER_BOUNDARY_IMPLEMENTATION_PLAN.md`
- `modules/publication/src/publication-provider-test-adapter.ts`
- `modules/publication/src/publication-provider-test-adapter.test.ts`
- 본 보고서

## 4. Files modified

- `modules/publication/src/publication-infrastructure.ts` / `.test.ts`
- `modules/publication/src/publication-service.ts` / `.test.ts`
- `modules/publication/src/index.ts`
- `apps/api/src/publication-api-http-runtime.test.ts`

- `docs/implementation/FEAT015_TRACEABILITY_MATRIX.md` — 검증된 F17-E evidence만 추가

Production dependency/lockfile, Canonical Registry 및 main workspace 변경은 없다.

## 5. Implementation / Ownership

`createProductionPublicationInfrastructure()`는 configuration을 snapshot한 뒤 dispatcher 주입을 거부한다. Durable adapter 생성 전 fail closed하며 unavailable dispatcher만 사용한다. Configuration getter의 check/use 차이를 통한 injection도 회귀 테스트로 차단했다.

`DeterministicPublicationConnectorTestAdapter`는 명시적 test composition에만 주입한다. 기존 execution-derived provider idempotency identity를 확인하고 승인 필드 fingerprint로 안정적인 safe evidence/reference를 생성한다. 동일 identity의 상충 binding은 UNKNOWN이며 이전 observation을 덮어쓰지 않는다. Network, credential, random identity가 없다.

`normalizeConnectorResult()`는 own data descriptor와 최대 64개 bounded index copy로 승인 필드만 새 immutable result로 재구성한다. Arbitrary iterator, index accessor, extra field getter 및 `toJSON`을 실행하지 않는다. Unsafe/malformed reference는 safe generated UNKNOWN evidence가 된다. Thrown/timeout/connection failure는 raw exception 없이 정규화한다.

API-014는 business admission/outcome interpretation, API-018은 bounded technical execution/evidence, API-019는 provider contract/evidence boundary를 유지한다. Adapter에는 approval, authorization 또는 lifecycle authority를 부여하지 않았다.

## 6. TDD / Regression Evidence

| 검증 | 실제 결과 |
|---|---|
| Production injection | RED: 예상 rejection 없음 → guard GREEN |
| Deterministic adapter | RED: export 미존재 → 직접 테스트 4/4 GREEN |
| Unsafe/malformed/extra-field response | RED 확인 → whitelist normalization GREEN |
| Timeout/connection classification | RED: unavailable 분류 → safe category GREEN |
| Configuration check/use boundary | RED 확인 → snapshot-first GREEN |
| Independent-review iterator/accessor finding | RED 2건 확인 → bounded descriptor copy GREEN |
| Combined focused regression | 61/61 PASS — 마지막 review correction 전 |
| Affected Publication/API regression | 443/443 PASS — 마지막 review correction 전 |
| Correction 후 F17-E service focused | 8/8 PASS |
| 최종 전체 regression | 810/810 PASS — correction 포함 |

직접 assertion은 stable key/reference, immutable receipt, raw field 미저장, iterator/accessor 미실행, UNKNOWN → RECONCILIATION_REQUIRED, reopened state/receipt/audit/idempotency 보존을 검증한다. Confirmed provider effect 뒤 local receipt commit 실패도 restart 후 ambiguity로 containment하며 redispatch하지 않는다.

F17-D 기존 테스트는 production에 callback dispatcher를 주입하던 fixture를 제거했다. Restart 결과의 정확한 `durable-execution:attempt-http-ambiguous:outcome-unproven` receipt와 보존된 attempt identity를 확인한다. 실제 unavailable dispatcher 실행 evidence와 구분되므로 no-redispatch assertion을 유지한다.

## 7. Verification

| Gate | 결과 |
|---|---|
| Lint / Typecheck / Build / Verify | PASS, exit 0 |
| Full tests | 810/810 PASS, failed/skipped 0 |
| Architecture checksum | 153/153 PASS |
| Frozen scope / dependency diff | 변경 0 |
| Gitleaks | exit 0, 0 findings |
| Production audit | exit 0, vulnerabilities 0 |
| Full audit | exit 1, 기존 승인된 development-only transitive High 4건 |
| New unapproved High/Critical | 0 — F17-D 승인 baseline과 advisory/package/path 일치 |

최종 실행 명령: `pnpm.cmd --config.verify-deps-before-run=false --config.update-notifier=false run verify`. 기존 script chain의 lint → typecheck → test → build를 실행했고 최종 full suite는 한 번 수행했다.

일반 `pnpm.cmd lint` launcher는 dependency auto-install/update check를 시도하다 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`로 중단되었다. 설치하지 않았고 manifest/lockfile diff 0을 확인했다. 이후 기존 F17-D에서 사용한 위 설정으로 자동 설치와 update notifier를 비활성화했다. 이후 F17-E 전용 network 승인을 받은 뒤 아래 audit만 실행했다.

Checksum은 baseline manifest 알고리즘에 따라 immutable commit `426f6de0cdcf8c384f70c3e333f7b6483616bd15`의 153개 path/blob을 정렬해 검증했다: `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778`. 현재 frozen scope도 F17-E baseline 대비 변경 0이다.

Gitleaks: `C:\Tools\gitleaks\gitleaks.exe dir . --redact --no-banner --config .gitleaks.toml`, 약 10.76 MB 검사, findings 0.

### Dependency audit evidence

승인 destination은 `https://registry.npmjs.org`이며 실제 요청 endpoint는 `/-/npm/v1/security/advisories/bulk`이다. 최초 sandbox 요청은 EACCES로 중단(exit 1)되었고 동일 승인 범위로 network permission을 적용해 재실행했다. Update notifier와 retry를 비활성화했다. Source/secret/business data를 업로드하는 명령은 실행하지 않았다.

| 실제 명령 | Exit | 결과 |
|---|---:|---|
| `pnpm.cmd --config.update-notifier=false --config.fetch-retries=0 audit --prod --registry=https://registry.npmjs.org` | 0 | No known vulnerabilities found |
| `pnpm.cmd --config.update-notifier=false --config.fetch-retries=0 audit --registry=https://registry.npmjs.org` | 1 | High 4건; 아래 기존 승인 advisory와 동일 |

| Package / vulnerable range | Advisory | Dependency path | 분류 |
|---|---|---|---|
| `brace-expansion <1.1.17` | `GHSA-mh99-v99m-4gvg` | `eslint → minimatch → brace-expansion` 계열, 36 paths | High / development-only transitive |
| `brace-expansion >=4.0.0 <5.0.8` | `GHSA-mh99-v99m-4gvg` | `typescript-eslint → @typescript-eslint/* → minimatch → brace-expansion`, 7 paths | High / development-only transitive |
| `brace-expansion <1.1.18` | `GHSA-rgw5-rvv9-x895` | `eslint → minimatch → brace-expansion` 계열, 36 paths | High / development-only transitive |
| `brace-expansion >=4.0.0 <5.0.9` | `GHSA-rgw5-rvv9-x895` | `typescript-eslint → @typescript-eslint/* → minimatch → brace-expansion`, 7 paths | High / development-only transitive |

Production Critical/High 0, 신규 미승인 High/Critical 0이다. [F17-D 승인 evidence](F17_D_CLOSED_API_014_RUNTIME_HTTP_IMPLEMENTATION_REPORT.md)의 기존 잔여 위험을 유지하며 별도 dependency-owner 검토 대상으로 남긴다. `audit --fix`, install/update/override는 수행하지 않았다.

Audit 전후 SHA-256 동일: `package.json` = `666e5cba934be459d0bc0c43635b05a39d33162fe02d0550927f7f706871f9b9`, `pnpm-lock.yaml` = `245e7a25e2b2d4939bf2da84115061e0baf9997d1c5d175f6a32d58f94c22a11`, `pnpm-workspace.yaml` = `c5745f3fd5c4e8516db305ce20e22c3426d600a03f534ab559bac1b002d0bd19`.

## 8. Independent Review

최초 Critical 0 / Important 1 / Minor 0. Provider-controlled evidence iterator가 bounded length 검사를 우회하는 finding을 RED 테스트로 재현한 후 수정했다. Fresh read-only 재검토 결과: **Critical 0 / Important 0 / Minor 0 — READY**. 이후 production/test 변경 없이 audit 및 문서 evidence만 확정했다.

## 9. Scope Protection / Limitations

| 항목 | 결과 |
|---|---|
| Provider ownership / API-018/019 alignment | PASS — 기존 contract 유지 |
| Fail-closed production / test adapter isolation | PASS |
| Real provider activation | 0 |
| Sandbox adapter | DEFERRED / NOT_APPLICABLE |
| Normalized outcomes | CONFIRMED / REJECTED / UNKNOWN만 유지 |
| UNKNOWN containment / F17-C durability | PASS |
| F17-D Runtime/HTTP preservation | PASS |
| Blind resend paths | 검증된 restart/receipt-failure paths에서 0 |
| Credential / raw provider response leakage | 검증된 adversarial fixtures에서 0 |
| New API operations / dependencies | 0 |

Safe reference syntax는 임의 opaque 문자열의 모든 secret 여부를 증명하는 분류기가 아니다. 실제 provider adapter/credential/contract는 승인되지 않았으며 production dispatch는 unavailable이다. Test assembly에서 durable infrastructure를 재사용하되 test adapter는 명시적으로만 연결한다. 새 provider 계약, destination policy, credential model 또는 provider version semantics를 정의하지 않았다.

## 10. Open Decisions / Inconsistencies / Next Prerequisites

- F17-E production/full audit network 승인 및 실행 완료. 미해결 blocker 0.
- 발견된 iterator 및 configuration boundary 결함은 수정 및 재검토 완료. 미해결 코드 finding 0.
- 실제 audit 결과를 본 보고서와 F17-E RTM evidence에 반영했다. `git diff --check`, 링크/범위/의존성 무변경 확인 후 단일 local commit으로 보존한다.
- Commit: 본 보고서를 포함하는 단일 local commit; actual hash와 commit 후 clean 상태는 최종 응답에 기록한다. Main: clean, baseline HEAD 보존.
- Push: NOT_PERFORMED. F17-F / F18 / F19: NOT_STARTED.

다음 작업은 Architecture Owner의 별도 승인 대상이다. F17-E local commit 후 중단하며 main integration, push 또는 F17-F/F18/F19를 수행하지 않는다.
