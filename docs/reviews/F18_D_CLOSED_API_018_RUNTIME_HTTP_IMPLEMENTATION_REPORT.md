# F18-D Closed API-018 Runtime / Host / HTTP Implementation Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-F18-D-001 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-09-02 |

## 1. Objective

F18-D의 승인된 closed API-018 기술 operation을 단일 `Application → Runtime → Host → HTTP` 경계로 연결하고, F18-B admission 및 F18-C durable lease/invocation/idempotency/checkpoint authority를 보존했다.

**Final Recommendation:** `APPROVE_F18_D_CLOSED_API_018_RUNTIME_HTTP`

## 2. Documents read

- `F18-D — CLOSED API-018 RUNTIME / HOST / HTTP`
- `F18-D — API-018 CLOSED CONTRACT AMENDMENT` (`APPROVED`)
- `docs/book-6/12_CONNECTOR_CONTRACTS.md`
- `docs/reviews/F18_SOURCE_CONNECTOR_RUNTIME_INVENTORY_GAP_REPORT.md`
- `docs/reviews/F18_B_SOURCE_INGESTION_ADMISSION_BOUNDARY_COMPLETION.md`
- `docs/reviews/F18_C_DURABLE_CONNECTOR_FOUNDATION_IMPLEMENTATION_REPORT.md`

## 3. Canonical operation matrix

| Operation | 분류 | Application | Runtime | Host | HTTP | Durable dependency |
|---|---|---:|---:|---:|---:|---|
| `RegisterConnectorInstance` | COMMAND | PASS | PASS | PASS | PASS | technical state/evidence/idempotency |
| `SubmitCaptureBatch` | COMMAND | PASS | PASS | PASS | PASS | F18-B + F18-C lease/invocation/result/checkpoint |
| `ReadBatchStatus` | QUERY | PASS | PASS | PASS | PASS | batch binding/invocation/checkpoint read |
| `AdvanceCheckpoint` | COMMAND | PASS | PASS | PASS | intentionally non-HTTP | F18-C successful atomic commit only |
| `LeaseApprovedDelivery` | COMMAND | PASS | PASS | PASS | PASS | durable technical lease evidence |
| `ReportDeliveryAttempt` | COMMAND | PASS | PASS | PASS | PASS | durable technical result evidence |
| `SubmitExternalObservation` | COMMAND | PASS | PASS | PASS | PASS | durable non-authoritative observation |
| `ReportHealth` | COMMAND | PASS | PASS | PASS | PASS | durable bounded health evidence |

- Canonical operations: **8/8 PASS**
- Commands: **7/7 PASS**
- Queries: **1/1 PASS**
- HTTP executable: **7/7 PASS**
- Canonical non-HTTP: **1/1 PASS**
- New API-018 operations: **0**

## 4. Files created

- `modules/source/src/connector-api-contracts.ts`
- `modules/source/src/connector-api-contracts.test.ts`
- `modules/source/src/connector-api-durable-records.test.ts`
- `modules/source/src/connector-runtime-application.ts`
- `modules/source/src/connector-runtime-application.test.ts`
- `modules/source/src/connector-runtime.ts`
- `modules/source/src/connector-application-host.ts`
- `modules/source/src/connector-runtime-host.test.ts`
- `apps/api/src/connector-api-http-adapter.ts`
- `apps/api/src/connector-production-composition.ts`
- `apps/api/src/connector-api-http-runtime.test.ts`
- `docs/superpowers/plans/2026-09-01-f18-d-api-018-runtime-http.md`
- 이 report

## 5. Files modified

- `modules/source/src/index.ts`
- `modules/source/src/connector-durable-persistence.ts`
- F18-C test fixture의 secret-like idempotency 예제를 명시적 저엔트로피 test 값으로 교정했다. Production behavior 변경은 없다.

기존 F18-A/B/C 미커밋 변경은 reset, restore 또는 discard하지 않고 보존했다.

## 6. Key decisions added

- HTTP route는 `/api/connectors/commands`와 `/api/connectors/queries`의 `POST`만 허용한다.
- `AdvanceCheckpoint`는 HTTP에서 거부되며, 성공한 authoritative F18-C invocation/checkpoint를 확인하는 internal-only 경계다.
- Session, tenant, team/scope, purpose, Source/Connector binding은 injected trusted runtime context에서만 결정된다. Body binding은 일치 여부만 검증하며 authority를 생성하지 않는다.
- `SubmitCaptureBatch`는 F18-B admission을 통과한 후에만 F18-C coordinator를 호출한다. BLOCKED이면 connector call과 durable batch mutation은 모두 0이다.
- connector instance, batch binding, delivery evidence, observation, health는 기존 F18-C SQLite UoW 안의 bounded technical records/evidence로 저장한다. 새 persistence subsystem은 없다.
- production composition은 explicit file DB를 요구하고 arbitrary/test connector injection을 거부하며, connector execution unavailable 상태에서 durable execution mutation 전에 fail closed한다.

## 7. Security, authority, and durability results

| Gate | 결과 |
|---|---|
| Closed schemas / unknown-field rejection | PASS |
| Header-derived trusted Session | PASS |
| Body actor/tenant/team/scope authority | rejected |
| Trusted Source/Connector exact binding | PASS |
| Tenant/scope concealment | PASS |
| F18-B admission preservation | PASS |
| F18-C durable integration/restart | PASS |
| Idempotent exact replay/conflict | PASS |
| Append-only evidence | PASS |
| Stale version/checkpoint rejection | PASS |
| Failed/ambiguous checkpoint advances | 0 |
| Blind rerun paths | 0 |
| Unsafe response leakage | 0 |
| Real provider activation | 0 |
| Credentials / external network | 0 |
| API-019 expansion | 0 |
| F19 implementation | 0 |

## 8. Validation performed

| Validation | Result |
|---|---|
| Node | `v24.18.0` PASS |
| pnpm | `11.9.0` PASS |
| F18-B/C/D focused | **42/42 PASS** |
| Affected F17 API-014/durable/provider/retry | **33/33 PASS** |
| Full regression | **874/874 PASS** |
| Lint | PASS (`exit 0`) |
| Typecheck | PASS (`exit 0`) |
| Build | PASS (`exit 0`) |
| Verify | PASS — `lint + typecheck + build/test` constituent gates 모두 PASS |
| `pnpm.cmd verify` wrapper | ENVIRONMENT LIMITATION — isolated worktree junction의 modules purge 확인에 TTY가 없어 script 시작 전 중단; dependency purge/install은 수행하지 않음 |
| Architecture checksum | **153/153 PASS**, `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` |
| Frozen Architecture worktree changes | 0 |
| `git diff --check` | PASS |
| Gitleaks current worktree | **0 findings** |
| Gitleaks Git history | 기존 commit `4e6d65c...` test fixture 4건; F18-D 신규 finding 0 |
| Dependency / lockfile changes | 0 |
| Dependency audit | NOT RUN — F18-D scoped network approval 없음, Brief상 별도 요청 전 불필요 |

## 9. Independent implementation review

구현 diff와 actual execution path를 fresh self-review했다.

- Critical: **0**
- Important: **0**
- Minor: **1** — isolated worktree에서 `pnpm.cmd verify` wrapper가 dependency junction purge 확인을 요구한다. 동일 constituent gate를 설치·네트워크 없이 직접 실행하여 모두 PASS했다.
- Result: **READY_FOR_ARCHITECTURE_OWNER_REVIEW**

## 10. Open decisions

- `OPEN DECISION`: 실제 connector/provider contract, credentials, destination allowlist와 production network activation은 후속 별도 AO 승인 대상이다.
- `OPEN DECISION`: API-019 external identity/mapping semantics와 F19 reconciliation/recovery는 F18-D 범위 밖이다.

## 11. Inconsistencies found

- 최초 canonical inventory에는 exact schema/exposure가 없었다. 승인된 F18-D API-018 Closed Contract Amendment로 해소됐다.
- 추가 canonical conflict는 발견되지 않았다.

## 12. Known limitations

- Production connector는 의도적으로 unavailable이다.
- 실제 provider call, credentials, external destination 및 network execution은 구현하지 않았다.
- `AdvanceCheckpoint`에는 독립 HTTP endpoint가 없다.
- F18-D는 technical evidence만 기록하며 Publication lifecycle 또는 business reconciliation을 결정하지 않는다.

## 13. Git and scope protection

| 항목 | 결과 |
|---|---|
| Main workspace | clean |
| Isolated branch | `codex/f18-source-connector-runtime` |
| Baseline HEAD | `65ed3657fdbe91e66a6746a74214dd5e6c4bbd3f` |
| F18 accumulated worktree | dirty — approved F18-A/B/C/D changes preserved |
| Commit | `NOT_CREATED` |
| Push | `NOT_PERFORMED` |
| F18-E | `NOT_STARTED` |
| F19 | `NOT_STARTED` |

## 14. Next brief prerequisites

Architecture Owner가 본 F18-D 결과와 누적 F18-A/B/C/D change set을 검토해야 한다. 별도 승인 전 commit, push, real connector/provider activation, F18-E 및 F19를 시작하지 않는다.
