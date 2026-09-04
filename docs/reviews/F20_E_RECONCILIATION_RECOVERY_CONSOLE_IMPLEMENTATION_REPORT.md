# F20-E Reconciliation / Recovery Console Implementation Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-114 |
| Historical Artifact ID | F20-E-REPORT |
| Version | v0.1 |
| Status | IN REVIEW |
| Owner | Architecture Owner |
| Completion date | 2026-09-04 |
| Baseline | `753102667d235e9999d2c12b1915d18c4d0a97a1` |
| Final Recommendation | `APPROVE_F20_E_RECONCILIATION_RECOVERY_CONSOLE` |

## 1. Objective

기존 F19 `READ_RECOVERY_CASE` query를 이용해 exact known-case Reconciliation / Recovery Console을 제공한다. Finding과 disposition을 분리하고, contract가 제공하지 않는 resource/parent/child/disposition 정보는 추정하지 않는다.

## 2. Documents read

- Architecture Owner의 `F20 — Operations Console Expansion Continuous Execution Brief`.
- [F20-A Inventory](F20_A_OPERATIONS_CONSOLE_INVENTORY_GAP_REPORT.md).
- [F20-B Report](F20_B_OPERATIONS_READ_MODELS_API_PROJECTION_IMPLEMENTATION_REPORT.md).
- F19 Recovery Orchestration contract/application과 직접 tests.

### Reconciliation / Recovery capability matrix

| Capability | Existing backend | UI-safe | Mutation allowed | Decision |
|---|---|---|---|---|
| `READ_RECOVERY_CASE` | F19 exact query | YES | N/A | exact `recoveryCaseId`로 표시 |
| Reconciliation finding | exact query field | YES | NO | 별도 section에 표시 |
| Recovery ID | exact query field | YES | NO | disposition section의 linkage로 표시 |
| Recovery disposition | exact read에 없음 | NO | NO | `UNAVAILABLE`; 추정 금지 |
| Resource identity | exact read에 없음 | NO | NO | 표시하지 않음 |
| Parent/child lineage | exact read에 없음 | NO | NO | `UNAVAILABLE`; 합성 금지 |
| Case list/discovery | safe query 없음 | NO | NO | 구현하지 않음 |
| Resolve/authorize/recover | backend command 존재 | Console proof 없음 | **NO** | route/form/control 0 |

## 3. Files created

- `docs/reviews/F20_E_RECONCILIATION_RECOVERY_CONSOLE_IMPLEMENTATION_REPORT.md`.

## 4. Files modified

- `apps/admin-console/src/console-read-adapter.ts`.
- `apps/admin-console/src/console-read-adapter.test.ts`.
- `apps/admin-console/src/console-renderer.ts`.
- `apps/admin-console/src/console-renderer.test.ts`.
- `apps/admin-console/src/console-server.ts`.
- `apps/admin-console/src/console-server.test.ts`.

## 5. Key decisions added

- `/recovery/cases`는 기존 Console server와 injected F19 read adapter만 사용한다.
- Browser는 bounded `recoveryCaseId`만 전달한다. Session과 tenant는 server-derived다.
- Origin identity는 canonical seven-key allowlist로 새 객체를 구성해 arbitrary nested data를 제거한다.
- `Recovery Case`, `Origin`, `Reconciliation Finding`, `Recovery Disposition`, `Case Lineage`, `Safe Evidence`를 의미적으로 분리한다.
- F19 exact read가 disposition과 parent/child linkage를 제공하지 않으므로 `UNAVAILABLE`을 UI-only 상태로 표시한다. `recoveryId`로 disposition을 추정하지 않는다.
- Resolve, authorize, recover 또는 free-text finding control을 만들지 않는다.

## 6. Open decisions

None. Disposition과 parent/child navigation은 safe canonical read가 별도 승인·구현될 때까지 unavailable이다.

## 7. Inconsistencies found

F20의 desired visibility에는 resource, parent/child lineage와 recovery disposition이 포함되지만 현재 `READ_RECOVERY_CASE` view에는 해당 fields가 없다. 새 contract/authority를 만들지 않고 explicit `UNAVAILABLE`로 containment했다.

## 8. Validation performed

| Gate | Result |
|---|---|
| TDD RED | navigation/route, exact identity forwarding, separated semantic rendering 부재로 expected failure 확인 |
| Focused Console tests | 37/37 PASS |
| Console 37 + composition 6 + F19-B 6 affected regression | 49/49 PASS |
| Changed-file lint | PASS |
| Typecheck / build compilation | PASS |
| Finding / disposition separation | PASS |
| Nested arbitrary origin field omission | PASS |
| Tenant/scope concealment regression | PASS |
| Recovery mutation/form/control | 0 |
| New API ID / operation / authority / vocabulary / lifecycle state | 0 |
| Direct Console → DB/provider/connector execution | 0 |
| Dependency/lockfile changes | 0 |

F20-E는 dependency를 변경하지 않았다. Full suite, architecture checksum, Gitleaks와 dependency audits는 F20-H final gate에서 수행한다.

## 9. Independent review

Initial review는 Critical 0 / Important 1 / Minor 2로 cross-domain origin field projection과 page-unrelated identity forwarding을 발견했다. `originDomain`별 exact shape projection 및 server page-gating RED를 추가하고 최소 수정했다.

Fresh remediation re-review: **Critical 0 / Important 0 / Minor 0 — READY**. CONNECTOR origin의 adversarial `mappingId`/`authorization` omission, RECOVERY_CASE request의 exact `recoveryCaseId`와 server-derived context, finding/disposition/lineage separation, zero command/form/authority/direct access/API/state expansion을 확인했다.

## 10. Known limitations

- exact `recoveryCaseId`를 보유한 authorized operator만 조회할 수 있고 case discovery는 없다.
- Recovery disposition과 parent/child lineage는 current read contract에 없어 `UNAVAILABLE`이다.
- Finding, disposition, recovery identity 또는 evidence를 Console이 작성·변경하지 않는다.

## 11. Next brief prerequisites

- F20-F는 F20-B의 safe API-016/API-019/F19 evidence projections를 재사용한다.
- Raw evidence, actor secrets, backend stack/path, silent remap 또는 editable lineage를 노출하지 않는다.

## Completion statement

F20-E는 exact F19 recovery-case read를 safe operator visibility로 연결했고 reconciliation/recovery mutation surface는 `0`이다. Push는 수행하지 않는다.
