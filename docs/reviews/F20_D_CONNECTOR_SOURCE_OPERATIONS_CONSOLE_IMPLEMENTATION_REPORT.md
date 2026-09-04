# F20-D Connector / Source Operations Console Implementation Report

| 항목 | 값 |
|---|---|
| Document ID | F20-D-REPORT |
| Version | v0.1 |
| Status | IN REVIEW |
| Owner | Architecture Owner |
| Completion date | 2026-09-04 |
| Baseline | `e262d8f1e368f3b554444bae2cca1d3517bb103c` |
| Final Recommendation | `APPROVE_F20_D_CONNECTOR_SOURCE_OPERATIONS_CONSOLE` |

## 1. Objective

기존 API-018 `ReadBatchStatus` query만 사용해 Connector / Source Operations의 bounded read-only Console route를 제공한다. Connector 실행, lease 변경, checkpoint 변경, 새 API 또는 새 authority는 추가하지 않는다.

## 2. Documents read

- Architecture Owner의 `F20 — Operations Console Expansion Continuous Execution Brief`.
- [F20-A Inventory](F20_A_OPERATIONS_CONSOLE_INVENTORY_GAP_REPORT.md).
- [F20-B Report](F20_B_OPERATIONS_READ_MODELS_API_PROJECTION_IMPLEMENTATION_REPORT.md).
- [F20-C Report](F20_C_PUBLICATION_OPERATIONS_CONSOLE_IMPLEMENTATION_REPORT.md).
- API-018 closed contract와 직접 Runtime/HTTP tests.

### Connector / Source capability matrix

| Capability | Existing backend | UI-safe | Mutation allowed | Decision |
|---|---|---|---|---|
| `ReadBatchStatus` | API-018 closed query | YES | N/A | exact `connectorId` / `sourceId` / `batchId`로 표시 |
| Connector instance/list | safe Console query 없음 | NO | NO | `UNAVAILABLE`; 추정하지 않음 |
| Source detail/list | safe Console query 없음 | NO | NO | batch의 authorized binding만 표시 |
| Lease state/health | safe Console query 없음 | NO | NO | `UNAVAILABLE`; 추정하지 않음 |
| API-018 HTTP commands | closed technical commands 존재 | NO | **NO** | Console control 아님 |
| `AdvanceCheckpoint` | internal-only | NO | **NO** | route/form/control 0 |
| Force checkpoint | canonical operation 없음 | NO | **NO** | 금지 |

## 3. Files created

- `docs/reviews/F20_D_CONNECTOR_SOURCE_OPERATIONS_CONSOLE_IMPLEMENTATION_REPORT.md`.

## 4. Files modified

- `apps/admin-console/src/console-read-adapter.ts`.
- `apps/admin-console/src/console-read-adapter.test.ts`.
- `apps/admin-console/src/console-renderer.ts`.
- `apps/admin-console/src/console-renderer.test.ts`.
- `apps/admin-console/src/console-server.ts`.
- `apps/admin-console/src/console-server.test.ts`.

## 5. Key decisions added

- `/connector/operations`는 기존 Console server와 injected read adapter를 재사용한다.
- Browser는 bounded `connectorId`, `sourceId`, `batchId`만 view endpoint에 전달한다. Session과 tenant는 계속 server configuration에서 주입된다.
- API-018가 authorization과 binding을 통과한 뒤에만 request의 `connectorId`와 `sourceId`를 immutable safe DTO에 포함한다.
- 화면은 `Connector Batch`, `Source Binding`, `Technical Outcome`, `Checkpoint`를 분리해 표시한다.
- `AdvanceCheckpoint`, Force checkpoint, Connector execution 및 mutation UI는 만들지 않는다.

## 6. Open decisions

None. Connector list, lease/health detail 또는 operator command surface는 기존 safe query/authority가 없으므로 본 단계에서 구현하지 않는다.

## 7. Inconsistencies found

None. F20-A가 확정한 exact batch-only boundary와 API-018 public/internal operation 구분을 유지했다.

## 8. Validation performed

| Gate | Result |
|---|---|
| TDD RED | navigation/route, bounded identity forwarding, semantic Connector rendering 부재로 expected failure 확인 |
| Focused Console tests | 35/35 PASS |
| Console + API-018 affected regression | 62/62 PASS |
| Changed-file lint | PASS |
| Typecheck / build compilation | PASS |
| Raw provider/secret allowlist assertion | PASS |
| Tenant/scope concealment regression | PASS |
| `AdvanceCheckpoint` public exposure | 0 |
| Force checkpoint / Connector execution controls | 0 |
| New API ID / operation / authority / lifecycle state | 0 |
| Direct Console → DB/provider/connector execution | 0 |
| Dependency/lockfile changes | 0 |

F20-D는 dependency를 변경하지 않았고 phase-scoped audit authorization도 요구하지 않는다. Full suite, architecture checksum, Gitleaks와 dependency audits는 F20-H final gate에서 수행한다.

## 9. Independent review

Fresh review: **Critical 0 / Important 0 / Minor 0 — READY**.

Reviewer는 browser/server가 bounded Connector identity만 전달하고 Session/tenant는 server-derived 상태로 유지됨을 확인했다. Adapter는 세 identity를 모두 요구하고 API-018 `QUERY` / `ReadBatchStatus` 성공 후에만 immutable allowlisted DTO를 반환한다. API-018의 trusted context binding과 tenant/scope concealment, raw/secret/error omission, escaped semantic rendering, GET-only route, zero command/form/DB/provider/connector execution 및 zero API/authority/state expansion을 확인했다.

## 10. Known limitations

- Console은 operator가 이미 보유한 exact Connector/Source/Batch identity에 대해서만 조회한다.
- Connector discovery, instance/lease/health 목록, checkpoint 변경 및 technical command 실행은 제공하지 않는다.
- UI state는 read projection이며 Connector 또는 Source lifecycle authority를 만들지 않는다.

## 11. Next brief prerequisites

- F20-E는 F20-B의 exact F19 Recovery Case read boundary만 사용한다.
- Finding과 disposition은 분리하고, recovery list/discovery 또는 mutation을 만들지 않는다.

## Completion statement

F20-D는 existing API-018 `ReadBatchStatus`를 이용한 bounded Connector / Source visibility를 추가했고 mutation 및 force-checkpoint surface는 `0`이다. Push는 수행하지 않는다.
