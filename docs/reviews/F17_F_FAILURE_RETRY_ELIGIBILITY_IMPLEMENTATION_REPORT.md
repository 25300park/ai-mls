# F17-F Failure / Retry Eligibility Implementation Report

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-09-01 |
| Final Recommendation | APPROVE_F17_F_FAILURE_RETRY_ELIGIBILITY |
| 현재 사유 | 로컬 검증·독립 검토·F17-F 전용 승인 audit 완료. F17-F 범위의 완료 권고이며 후속 phase 승인은 포함하지 않음 |
| Baseline commit | `12c39db5ee41230d748fec24d2771458884fa088` |
| Branch | `codex/f17-f-failure-retry-eligibility` |

## 1. Objective / Documents read

승인된 F17-F Minimal Implementation Design에 따라 기존 retry 결과와 Publication UoW를 재사용하여 durable history 기반 retry 판정, 현재 authorization 재검증, ambiguous-effect 차단을 연결한다.

- 현재 F17-F Brief: `650befcd-030e-4ab9-b354-c1069f5f300d/pasted-text.txt` 및 Architecture Owner의 명시적 최소 설계 승인.
- [Implementation Plan / Gap Matrix](../implementation/F17_F_FAILURE_RETRY_IMPLEMENTATION_PLAN.md).
- [F17-C Report](F17_C_DURABLE_PUBLICATION_EXECUTION_IMPLEMENTATION_REPORT.md), [F17-D Report](F17_D_CLOSED_API_014_RUNTIME_HTTP_IMPLEMENTATION_REPORT.md), [F17-E Report](F17_E_PROVIDER_BOUNDARY_FOUNDATION_IMPLEMENTATION_REPORT.md).
- DEC-035/101/105/106/107/108/111, 기존 retry policy/5-value contract, [Architecture Baseline Manifest](../freeze/ARCHITECTURE_V1_1_BASELINE_MANIFEST.md), [FEAT015 RTM](../implementation/FEAT015_TRACEABILITY_MATRIX.md).

## 2. Implementation / Key decisions

새 architecture decision을 만들지 않았다. 승인된 구현 선택만 적용했다.

| 경계 | 구현 및 검증 근거 |
|---|---|
| Failure classification | `publication-execution-failure.ts`: 명시적 safe code/normalized outcome만 분류. UNKNOWN 또는 시작 후 미확정 효과는 ambiguity가 우선하며 permission을 생성하지 않음 |
| 기존 retry policy | `publication-observability.ts`: 기존 분기 순서를 pure `decidePublicationRetryPolicy`로 공유. 기존 결과 5종 및 1..100 입력 한도 보존 |
| Durable retry basis | `publication-durable-retry.ts`: 기존 UoW repository/execution journal에서 attempts, receipts, dispatch disposition을 읽음. caller count/limit/history/failure는 권한 근거에서 제외 |
| Approved policy | injected read-only policy source를 exact tenant/target/version/channel/policy binding으로 검증. 미설정/불일치/실패는 NOT_ALLOWED. Production 기본값은 retry 허용 아님 |
| Durable evidence | 별도 DB/table/store 없음. 기존 append-only audit와 namespaced idempotency record에 안전한 판정 근거를 동일 transaction으로 저장 |
| Live checks | 기존 Session-derived guard와 effective Approval gate 재사용. 새 retry admission 및 dispatch 직전 재검증. stale 조건 차단 |
| Version/race | dispatch claim transaction 안에서 판정 시 aggregateVersion, EXECUTION_PENDING, NOT_SUSPENDED, attempt/command identity 검증. 기존 revision CAS가 transaction 중 변경을 차단 |
| Replay / retry | 새 retry는 새 attempt/command identity. 준비된 동일 attempt 재개는 한도를 이중 소비하지 않음. identity 충돌은 기존 safe conflict contract 유지 |
| Ambiguity | UNKNOWN 또는 DISPATCH_STARTED/no receipt는 기존 RECONCILIATION_REQUIRED 처리. ALREADY_STARTED claim은 provider를 호출하지 않음 |
| Production composition | durable adapter의 operations retry는 authoritative execution request와 durable history만 사용. process-local retry resolver는 production 판정 근거에서 제외 |

Retry intent fingerprint는 attempt/command/operation/payload intent를 고정한다. Aggregate version은 evidence에 기록하고 매 호출 live guard가 재검증한다. 동일 intent의 preparation이 version을 증가시키므로 version 증가 자체를 다른 idempotency payload로 오인하지 않는다. 과거 ALLOW evidence를 현재 권한으로 재사용하지 않는다.

인증/권한 거절은 이미 존재하는 aggregate에 대해 safe 실패 audit/idempotency만 남긴다. Session actor가 공개되지 않은 조기 거절은 `unresolved-session`으로 기록하며 caller actor를 사용하지 않는다. 존재하지 않는 aggregate를 만들어 거절 기록을 저장하지 않는다.

## 3. TDD / Direct evidence

기존 retry inventory 5/5 PASS는 유지했다. 새 코드가 필요했던 경계는 RED를 먼저 확인한 후 최소 변경했다.

| RED 원인 | GREEN 검증 |
|---|---|
| classifier/durable adapter 부재 | safe classification 3개 및 durable basis tests |
| caller history로 production retry 허용 | production operations retry NOT_ALLOWED |
| policy 없이 두 번째 provider 호출 | no-policy retry는 provider 호출 증가 및 aggregate 변경 없음 |
| 동일 command에 다른 attempt ID 허용 | 기존 DISPATCH_EVIDENCE_IDENTITY_CONFLICT로 거절 |
| admission 이후 authority 변경을 놓침 | dispatch 직전 거절, 추가 provider 호출 0 |
| 준비된 retry의 version/idempotency 충돌 및 한도 이중 계산 | SQLite reopen 후 마지막 허용 attempt 재개 ELIGIBLE |
| 거절 근거가 restart 후 없음 | safe denial audit 재개방 검증 |
| aggregate 간 denial audit ID 충돌 | tenant/aggregate별 ID 분리 및 reopen |
| 다른 실행이 claim한 후 재호출 | ALREADY_STARTED에서 provider 호출 0, reconciliation |
| 최종 판정과 claim 사이 suspension 경쟁 | 두 번째 실제 SQLite UoW 변경 후 provider 재호출 0, PRE_DISPATCH 보존 |

직접 테스트:

- `publication-execution-failure.test.ts`: 3개.
- `publication-durable-retry.test.ts`: 9개. Session/capability/MFA/SoD/approval/target/representation/tenant/scope/policy 거절 table 포함; storage failure atomic rollback, reopen, idempotency conflict 포함.
- `publication-service.test.ts`: F17-F 6개. durable coordinated retry 후 재시작 replay, 두 receipt/audit 불변성, claim/suspension races 포함.
- 총 F17-F focused: 18개. 단순 Task ID가 아니라 상태·호출 수·audit·receipt·version·거절 assertion으로 검증한다.

## 4. Validation performed

| Gate | 실제 결과 |
|---|---|
| Runtime | Node v24.18.0 / pnpm 11.9.0 |
| Focused / affected | F17-F 18개 포함 affected 203/203 PASS |
| Architecture focused | final mapping correction 후 5/5 PASS |
| Full tests | 최종 828/828 PASS; 최초 827/828의 Application layer 분류 누락 수정 포함 |
| Lint / Typecheck / Build | PASS |
| Verify | PASS, exit 0 |
| Architecture checksum | 153/153 PASS; frozen scope 변경 0 |
| Gitleaks | report/RTM 포함 최종 exit 0; 0 findings; 약 10.95 MB 검사 |
| Documentation / diff | 보고서·계획·RTM 링크 PASS; git diff --check PASS |
| Production audit | exit 0; vulnerabilities 0 (Critical 0 / High 0) |
| Full audit | exit 1; 기존 승인된 development-only transitive brace-expansion High 4건, Critical 0 |
| New unapproved High/Critical | 0; 이번 audit advisory ID/package/version/path 계열·개수가 F17-E 승인 baseline과 일치 |
| Dependencies / lockfile | 변경 0, 설치/업그레이드 0 |
| Independent review | Critical 0 / Important 0 / Minor 0 — 코드 리뷰 READY; audit 완료 판정 아님 |

실행 명령:

```text
.\node_modules\.bin\tsc.cmd -b tsconfig.build.json
node --test <해당 compiled focused/affected test files>
pnpm.cmd --config.verify-deps-before-run=false --config.update-notifier=false run verify
C:\Tools\gitleaks\gitleaks.exe dir . --redact --no-banner --config .gitleaks.toml
git diff --check
```

`verify`는 lint → typecheck → test(build 포함)를 실행한다. package-manager의 불필요한 install/update 확인을 비활성화하며 dependency를 변경하지 않는다. 첫 full suite의 실패는 새 orchestration 모듈을 기본 Domain으로 오분류한 테스트 inventory였고, 정확한 파일 하나를 Application으로 등록했다. `allowedDependencies` 행렬을 완화하지 않았다. 실패를 숨기지 않고 focused 재검증 후 final gate를 다시 실행한다.

Checksum: immutable commit `426f6de0cdcf8c384f70c3e333f7b6483616bd15`의 153개 sorted path/blob SHA-256은 `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778`이다. 현재 frozen scope도 F17-E baseline 대비 변경 0이다.

### F17-F dependency audit evidence

Architecture Owner의 F17-F 한정 승인을 받은 후 아래 명령만 실행했다. Registry는 `https://registry.npmjs.org`로 고정하고 update notifier와 fetch retry를 비활성화했다. `--json`은 결과 형식만 지정한다. 최초 sandbox production audit는 `fetch failed`로 exit 1이었고, 동일 명령을 승인 범위의 network permission으로 재실행했다. Source/secret/credential/environment/business data 업로드 명령, install/update/override 또는 `audit --fix`는 실행하지 않았다.

| 실제 명령 | Exit | 결과 |
|---|---:|---|
| `pnpm.cmd --config.update-notifier=false --config.fetch-retries=0 audit --prod --registry=https://registry.npmjs.org --json` | 0 | advisories 없음; 모든 severity 0 |
| `pnpm.cmd --config.update-notifier=false --config.fetch-retries=0 audit --registry=https://registry.npmjs.org --json` | 1 | development dependencies 110; High 4, Critical/Moderate/Low/Info 0 |

| Advisory ID | GHSA | 설치된 affected package | 취약 범위 / 수정 범위 | 의존 경로 | 분류 |
|---|---|---|---|---|---|
| 1130588 | GHSA-mh99-v99m-4gvg | brace-expansion 1.1.16 | `<1.1.17` / `>=1.1.17` | `eslint → minimatch → brace-expansion` 및 eslint transitives, 36 paths | High / development-only transitive |
| 1130591 | GHSA-mh99-v99m-4gvg | brace-expansion 5.0.7 | `>=4.0.0 <5.0.8` / `>=5.0.8` | `typescript-eslint → @typescript-eslint/* → typescript-estree → minimatch → brace-expansion`, 7 paths | High / development-only transitive |
| 1130734 | GHSA-rgw5-rvv9-x895 | brace-expansion 5.0.7 | `>=4.0.0 <5.0.9` / `>=5.0.9` | 동일 typescript-eslint 계열, 7 paths | High / development-only transitive |
| 1130737 | GHSA-rgw5-rvv9-x895 | brace-expansion 1.1.16 | `<1.1.18` / `>=1.1.18` | 동일 eslint 계열, 36 paths | High / development-only transitive |

두 advisory는 각각 unbounded expansion과 intermediate arrays에 따른 DoS 위험이다. 기존 [F17-E 승인 audit evidence](F17_E_PROVIDER_BOUNDARY_FOUNDATION_IMPLEMENTATION_REPORT.md)의 잔여 개발 도구 위험만 남는다. Dependency owner가 별도 변경 승인 하에 상위 도구 호환성 및 patched transitive version을 검토해야 하며, 이번 F17-F에서는 dependency/lockfile 변경 0을 유지했다. 기존 828/828 및 기타 통과 evidence는 보존했고 audit 마무리 단계에서 production code를 수정하지 않았다.

## 5. Independent review / Inconsistencies resolved

리뷰에서 발견된 denial 기록 누락, prepared reservation 이중 계산, PRE_DISPATCH 오분류, cross-aggregate audit ID 충돌, final eligibility/claim 사이 suspension race를 회귀 테스트로 수정했다. 기존 retry 입력 한도 100의 출처를 확인했다. 새로운 authority/API/provider/recovery workflow는 없다는 읽기 전용 재검토 결과를 받았다.

## 6. Files created / modified

Created:

- `modules/publication/src/publication-durable-retry.ts`
- `modules/publication/src/publication-durable-retry.test.ts`
- `modules/publication/src/publication-execution-failure.ts`
- `modules/publication/src/publication-execution-failure.test.ts`
- `docs/implementation/F17_F_FAILURE_RETRY_IMPLEMENTATION_PLAN.md`
- 본 report.

Modified:

- `modules/publication/src/index.ts`
- `modules/publication/src/publication-infrastructure-configuration.ts`
- `modules/publication/src/publication-infrastructure.ts`
- `modules/publication/src/publication-infrastructure.test.ts`
- `modules/publication/src/publication-observability.ts`
- `modules/publication/src/publication-operations-contracts.ts`
- `modules/publication/src/publication-service.ts`
- `modules/publication/src/publication-service.test.ts`
- `modules/publication/src/publication-end-to-end-architecture.test.ts`
- `docs/implementation/FEAT015_TRACEABILITY_MATRIX.md`: F17-F의 실제 검증 evidence만 추가.

## 7. Scope protection / Known limitations

- 새 API ID/operation, Publication state, execution-mode vocabulary, authority, provider contract: 0.
- 새 DB subsystem/schema/dependency, Console mutation: 0.
- Production provider는 F17-E unavailable-only. 성공 delivery 검증은 명시적 test-only adapter/assembly로 수행했으며 실제 외부 전송은 없다.
- 기존 F17-C SQLite durability/receipt/idempotency, F17-D closed Runtime/HTTP, F17-E normalization을 보존한다.
- 승인된 retry policy가 없으면 NOT_ALLOWED. 실제 provider policy/credentials/sandbox 선택은 하지 않았다.
- F17-H/F18/F19/F20/F21: NOT_STARTED. F19 reconciliation/recovery workflow 구현 0.
- 인증 전 actor를 추정하지 않으며, operational failure evidence는 business success/authority가 아니다.

## 8. Open decisions / Completion

새 architecture decision은 필요하지 않았다. F17-F 전용 audit 승인과 실행을 완료했고 신규 미승인 High/Critical은 0이다. Unresolved blockers: 0. 기존 development-only advisory는 위 잔여 위험으로 유지한다.

## 9. Git status

- Worktree: 승인된 F17-F 변경사항만 포함한다. 단일 commit 후 clean 여부를 최종 응답에서 확인한다.
- Commit: 본 보고서를 포함하는 단일 local commit. 자기 참조 hash를 문서에 만들지 않으며 실제 full hash는 최종 응답에 기록한다.
- Main: clean, HEAD `12c39db5ee41230d748fec24d2771458884fa088` 유지 확인. 변경 0.
- Push: NOT_PERFORMED.

## 10. Next brief prerequisites

F17-F audit와 검증 evidence를 확정했다. 정확히 한 개 local commit과 clean 확인 후 STOP한다. Main 통합 및 F17-H 또는 다른 phase는 별도 승인 없이 시작하지 않는다.
