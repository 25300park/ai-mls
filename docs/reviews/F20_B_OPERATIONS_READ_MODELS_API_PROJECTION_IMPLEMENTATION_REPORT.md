# F20-B Operations Read Models / API Projection Implementation Report

| 항목 | 값 |
|---|---|
| Document ID | F20-B-REPORT |
| Version | v0.1 |
| Status | IN REVIEW |
| Owner | Architecture Owner |
| Completion date | 2026-09-03 |
| Baseline | `2ca2fd4d120f42d48487693b90b4e3ad911eea0d` |
| Final Recommendation | `APPROVE_F20_B_OPERATIONS_READ_MODELS_API_PROJECTION` |

## 1. Objective

[F20-A Inventory](F20_A_OPERATIONS_CONSOLE_INVENTORY_GAP_REPORT.md)가 확인한 safe read gap을 기존 API-018/API-019/F19/API-016 boundary 위에 bounded immutable Console projection으로 구현한다. 새 API, authority, mutation, persistence, provider/network activation은 추가하지 않는다.

## 2. Documents read

- Architecture Owner의 `F20 — Operations Console Expansion Continuous Execution Brief`.
- [F20-A Inventory](F20_A_OPERATIONS_CONSOLE_INVENTORY_GAP_REPORT.md).
- [API Registry](../00_API_REGISTRY.md), [Security Registry](../00_SECURITY_REGISTRY.md), [Operations Registry](../00_OPERATIONS_REGISTRY.md).
- API-018 Connector, API-019 External Integration, F19 Recovery Orchestration, API-016 Audit query contracts와 직접 tests.

## 3. Implementation summary

기존 `ConsoleReadAdapter`에 다음 read-only page projection을 추가했다.

| Console projection | Existing canonical operation | Behavior |
|---|---|---|
| `CONNECTOR` | API-018 `ReadBatchStatus` | exact batch only; approved technical/status/checkpoint fields |
| `EXTERNAL_INTEGRATION` | API-019 `ReadExternalMapping` / `ReadIntegrationContract` | exact mapping 또는 contract only; safe identity/version/evidence fields |
| `RECOVERY_CASE` | F19 `READ_RECOVERY_CASE` | exact case only; canonical finding과 recovery identity fields 분리 |
| `EVIDENCE` | API-016 `queryAudit()` | scoped audit query; safe event/actor/resource/decision lineage only |

각 boundary는 injected port를 통해서만 접근한다. Console은 repository, UoW, durable store, provider 또는 connector를 직접 참조하지 않는다. Missing port는 `UNAVAILABLE`, missing/unauthorized exact identity는 concealed `EMPTY`, unexpected failure는 bounded `CONSOLE_READ_UNAVAILABLE`로 변환한다.

## 4. Security and data minimization

- trusted active Session과 tenant/team binding을 projection 이전에 확인한다.
- backend application authorization은 그대로 authoritative하며 Console check가 이를 대체하지 않는다.
- DTO는 allowlist로 새로 구성하고 deep immutable snapshot으로 반환한다.
- raw provider payload, audit `details`, arbitrary backend object 및 unknown field를 복사하지 않는다.
- `evidenceRef`/`evidenceRefs`의 control character 또는 secret-like marker는 fail-closed safe error로 처리한다.
- API-018 checkpoint mutation, API-019 commands, F19 recovery mutation과 새 Console command는 추가하지 않았다.

## 5. TDD evidence

| Slice | RED reason | GREEN evidence |
|---|---|---|
| API-018 | `CONNECTOR` dispatch 부재로 expected projection 대신 `undefined` | exact `ReadBatchStatus`, allowlisted immutable result |
| API-019 | `EXTERNAL_INTEGRATION` dispatch 부재 | exact mapping/contract query와 raw field 제거 |
| F19 | `RECOVERY_CASE` dispatch 부재 | exact case read, canonical finding/recovery identity fields 분리 |
| API-016 | `EVIDENCE` dispatch 부재 | scoped audit summary, `details` 제거 |
| secret containment | secret-like `evidenceRef`가 `READY` DTO에 노출 | `ERROR` safe mapping, leaked value 0 |

## 6. Files created

- `docs/reviews/F20_B_OPERATIONS_READ_MODELS_API_PROJECTION_IMPLEMENTATION_REPORT.md`.

## 7. Files modified

- `apps/admin-console/src/console-read-adapter.ts`.
- `apps/admin-console/src/console-read-adapter.test.ts`.
- `apps/admin-console/src/console-renderer.ts` — 새 projection의 exhaustive safe rendering만 추가; navigation/route/mutation은 추가하지 않음.

## 8. Validation performed

| Gate | Result |
|---|---|
| Focused Console adapter/render/server/composition | 36/36 PASS |
| Affected API-016/API-018/API-019/F19 + Console | 54/54 PASS |
| Typecheck | PASS |
| Build | PASS — isolated worktree에서 approved main dependency runtime의 TypeScript compiler를 read-only 재사용 |
| `git diff --check` | PASS |
| Dependency/lockfile changes | 0 |
| New API/operation/authority/state/persistence | 0 |
| Console mutation/direct data access | 0 |

F20-B에는 dependency 변경이 없고 phase-scoped audit authorization도 없으므로 dependency audit은 실행하지 않았다. Full lint/full regression/audit/Gitleaks/architecture checksum은 F20-H final gate 요구사항이며 이 subphase에서는 affected regression을 사용했다.

## 9. Independent review

Initial review는 Critical 0 / Important 2 / Minor 0으로 unsupported F19 read fields와 missing negative/contract branch evidence를 지적했다. Remediation은 canonical `READ_RECOVERY_CASE` fields로 allowlist를 축소하고, unsupported disposition/execution/resource field omission, API-019 Integration Contract branch, unavailable/tenant-concealed/safe-port-error tests를 추가했다.

Fresh re-review: **Critical 0 / Important 0 / Minor 0 — READY**. Canonical read allowlist, finding/recovery reference separation, API-019 closed contract branch, tenant concealment, safe errors와 zero new authority/API/mutation/direct access를 확인했다.

## 10. Key decisions added

- F20 operational discovery/list operation을 만들지 않는다. Existing exact-ID read가 없으면 `UNAVAILABLE` 또는 `EMPTY`다.
- F20-B는 data projection boundary만 추가한다. Browser route/navigation과 operator UX는 F20-C~F20-G에서 각 canonical capability를 다시 검증한다.
- API command의 존재는 Console mutation authorization이 아니다.

## 11. Open decisions

None for F20-C start. Later UI control이 existing closed command와 human authority/MFA/SoD/version/idempotency requirements를 만족하지 못하면 Mandatory Stop Condition 18을 적용한다.

## 12. Inconsistencies found

None newly introduced. F20-A가 기록한 broad Book 7 concepts와 exact executable read boundary 차이는 계속 `UNAVAILABLE` containment로 보존한다.

## 13. Known limitations

- Connector는 exact batch status만 제공하며 instance/lease/health list를 추정하지 않는다.
- External Integration은 exact mapping/contract만 제공하며 observation/conflict list를 추정하지 않는다.
- F19은 exact recovery case만 제공하며 case discovery/child list를 추정하지 않는다.
- 이 subphase는 browser route 또는 mutation control을 노출하지 않는다.

## 14. Next brief prerequisites

- F20-C Publication Operations Console은 기존 API-014 view를 우선 사용한다.
- Mutation control은 intended human role, MFA, SoD, `expectedVersion`, idempotency, confirmation, stale refresh를 operation별로 증명하기 전에는 노출하지 않는다.
- F20-D~F20-F는 본 projection을 재사용하고 새로운 Console client/state layer를 만들지 않는다.

## Completion statement

F20-B safe Operations Read Models / API Projection implementation은 affected verification 기준을 통과했다. Production provider/network/credential activation은 `0`이며 Push는 수행하지 않는다.
