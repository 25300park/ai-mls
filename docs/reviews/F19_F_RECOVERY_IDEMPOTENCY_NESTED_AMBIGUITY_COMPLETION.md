# F19-F Recovery Idempotency / Nested Ambiguity Hardening Completion

| 항목 | 값 |
|---|---|
| Document ID | F19-F-REPORT |
| Version | v0.1 |
| Status | IN REVIEW |
| Owner | Architecture Owner |
| Completion date | 2026-09-03 |
| Brief | F19-F — RECOVERY IDEMPOTENCY / NESTED AMBIGUITY HARDENING |
| Baseline | `208ec78e2f6696012219fd4b80b70bd3c5ee07a9` |
| Branch | `codex/f19-f-recovery-idempotency` |
| Commit / Push | `NOT_PERFORMED / NOT_PERFORMED` |

## 1. Objective

동일 `recoveryId`의 canonical authoritative fingerprint/result를 existing durable F19 store에 보존하고 exact replay가 external execution을 만들지 않게 했다. Authorized recovery execution X2가 ambiguous가 되면 immutable parent RC1을 유지하면서 X2 origin의 independently `OPEN` child RC2를 생성한다.

Final Recommendation:

`APPROVE_F19_F_RECOVERY_IDEMPOTENCY_NESTED_AMBIGUITY`

## 2. Documents read

- F19 Continuous Execution Brief Part 6 — F19-F
- [F19 canonical design](../implementation/F19_RECONCILIATION_RECOVERY_CANONICAL_DESIGN_V1.md)
- [F19-B plan](../implementation/F19_B_RECONCILIATION_BOUNDARY_IMPLEMENTATION_PLAN.md) 및 [completion](F19_B_RECONCILIATION_CASE_EVIDENCE_RECOVERY_IDENTITY_IMPLEMENTATION_REPORT.md)
- [F19-C plan](../implementation/F19_C_PUBLICATION_RESOLVE_RECOVER_IMPLEMENTATION_PLAN.md) 및 [completion](F19_C_PUBLICATION_RESOLVE_RECOVER_SEPARATION_IMPLEMENTATION_REPORT.md)
- [F19-D plan](../implementation/F19_D_CONNECTOR_AMBIGUITY_RECOVERY_HANDOFF_IMPLEMENTATION_PLAN.md) 및 [completion](F19_D_CONNECTOR_AMBIGUITY_RECOVERY_HANDOFF_COMPLETION.md)
- [F19-E plan](../implementation/F19_E_API_019_BUSINESS_HANDOFF_IMPLEMENTATION_PLAN.md) 및 [completion](F19_E_API_019_BUSINESS_HANDOFF_COMPLETION.md)
- [F19-F implementation plan](../implementation/F19_F_RECOVERY_IDEMPOTENCY_NESTED_AMBIGUITY_IMPLEMENTATION_PLAN.md)
- [Glossary](../00_GLOSSARY.md), [Document Governance](../00_DOCUMENT_GOVERNANCE.md), [Document Lifecycle](../00_DOCUMENT_LIFECYCLE.md), [Phase Completion Template](../templates/PHASE_COMPLETION_TEMPLATE.md)

## 3. Files created

- `docs/implementation/F19_F_RECOVERY_IDEMPOTENCY_NESTED_AMBIGUITY_IMPLEMENTATION_PLAN.md`
- `docs/reviews/F19_F_RECOVERY_IDEMPOTENCY_NESTED_AMBIGUITY_COMPLETION.md`

## 4. Files modified

- `modules/recovery/src/recovery-orchestration-contracts.ts` — durable recovery execution claim/result port
- `modules/recovery/src/recovery-durable-persistence.ts` — existing SQLite store의 append-only execution evidence와 exact child lineage guard
- `modules/recovery/src/recovery-durable-persistence.test.ts` — idempotency, conflict, lineage, restart 및 overwrite negative matrix
- `modules/publication/src/publication-reconciliation-service.ts` — F19 replay/claim/result를 existing F17 path 전후에 적용
- `modules/publication/src/publication-reconciliation-service.test.ts` — duplicate/conflict/evidence/restart/process-local/F17 second-protection tests
- `modules/publication/src/publication-infrastructure-configuration.ts`, `modules/publication/src/publication-infrastructure.ts` — injected durable execution store 전달; fallback 없음
- `modules/source/src/connector-recovery-handoff.ts` — F19 replay/claim/result와 full durable authorization tuple fingerprint를 existing F18 handoff 전후에 적용
- `modules/source/src/connector-execution-coordinator.ts` — recovery-only parent identity 전달 및 missing RC2 linkage의 durable ambiguous replay 재시도
- `modules/source/src/connector-recovery-handoff.test.ts` — duplicate/conflict/process-local/F18 second-protection, writer-crash recovery, authorization-evidence conflict 및 actual nested restart tests
- `docs/implementation/FEAT019_TRACEABILITY_MATRIX.md` — verified F19-F evidence만 추가

## 5. Key decisions added

- F19 execution idempotency는 새 engine이 아니라 existing `DurableRecoveryOrchestrationStore`의 recovery binding FK를 사용하는 append-only claim/result evidence다.
- `recoveryId + authoritative fingerprint` exact replay는 stored authoritative result를 domain execution 전에 반환한다. Fingerprint는 immutable case/resource/scope, finding/disposition, original origin, action/execution identity, authorization evidence와 actor를 canonical tuple로 결합한다.
- F19 result write 전에 crash/failure가 발생한 retry는 existing F17/F18 durable idempotency를 두 번째 보호층으로 사용한다. F19은 이를 대체하지 않는다.
- Connector fingerprint는 durable authorized view의 recovery case/resource/origin/tenant/scope/version, finding/disposition records, binding identity/decision/evidence/authorizer와 trusted runtime/contract/execution inputs 전체를 canonical tuple로 사용한다. Caller authorization field는 fingerprint authority가 아니다.
- Child creation은 parent RC1의 terminal `CONFIRMED_NOT_EXECUTED + RECOVERY_AUTHORIZED` binding과 exact X2 identity를 요구한다. RC2는 새 finding/disposition/recovery 없이 `OPEN / version 1`로 시작한다.
- X2 external call 뒤 ambiguity writer가 실패하면 F18 invocation/idempotency는 재사용되고 F19 result는 미완료로 남는다. Exact retry는 external call 0으로 existing writer만 재호출하며, completed F19 replay는 writer call 0이다.
- Production recovery execution store가 주입되지 않으면 Publication은 `RECOVERY_EXECUTION_UNAVAILABLE`, Connector는 `BLOCKED`로 fail closed한다. Process-local fallback authority는 0이다.

## 6. Open decisions

None. F19-H final integration은 별도 Brief이며 F19-F에서 시작하지 않았다.

## 7. Inconsistencies found

- 기존 F19-B child characterization은 unresolved/unauthorized parent에서 cross-domain child를 허용했다. F19-F canonical lineage에 맞춰 unauthorized child rejection으로 변경하고 separately authorized X2 positive lineage를 추가했다.
- 기존 F19-C recovery fingerprint는 execution identity만 포함하여 authorization evidence-only drift를 conflict로 식별하지 못했다. RED 22/23에서 재현한 뒤 full authoritative tuple로 보정했다.
- 기존 F19-D recovery handoff는 X2 ambiguity를 coordinator에 넘길 때 parent RC1 identity를 전달하지 않아 root case를 만들었다. Actual durable RED 11/12에서 재현한 뒤 existing coordinator/writer input에 optional parent를 전달했다.
- Review round 1에서 F19 result 전 ambiguity writer crash가 durable X2 replay에서 writer를 건너뛰어 RC2가 영구 누락될 수 있음을 확인했다. RED 11/12 후 recovery marker가 있는 ambiguous replay만 writer를 재호출하도록 보정했고 generic F18 replay는 그대로 유지했다.
- Review round 1에서 Connector fingerprint가 durable authorization evidence/decision tuple을 포함하지 않음을 RED 11/12로 확인했다. Existing authorization adapter view를 full durable tuple로 확장하고 fingerprint를 보정했다.

Unresolved Critical/Important inconsistency: `0`.

## 8. Validation performed

| 검사 | 방법 | 결과 |
|---|---|---|
| Baseline | linked worktree branch/base/status 및 initial focused matrix | clean branch at `208ec78e…`; 43/43 PASS |
| TDD RED — child lineage | current durable store에 original identity/X3 child rejection 요구 | 9 PASS / 1 expected FAIL — `Missing expected exception` |
| TDD RED — execution idempotency API | wished-for `find/claim/completeRecoveryExecution` direct compile | expected TypeScript errors 10 — methods absent |
| TDD RED — Publication port | durable execution store injection compile | expected TypeScript error 1 — port absent |
| TDD RED — Connector port | durable execution store injection compile | expected TypeScript error 1 — port absent |
| TDD RED — Connector RC2 | actual stores/coordinator X2 ambiguity | 11 PASS / 1 expected FAIL — child missing |
| Review RED — evidence fingerprint | same recovery identity, changed immutable evidence | 22 PASS / 1 expected FAIL — conflict replayed as success |
| Review RED — Connector writer crash | first X2 call 뒤 writer throw, exact durable replay | 11 PASS / 1 expected FAIL — writer calls `1 != 2` |
| Review GREEN — Connector writer crash | retry external 0, writer retry 1, RC2 exactly one, later writer 0 | 12/12 PASS |
| Review RED — Connector authorization tuple | same `recoveryId`, changed durable recovery evidence | 11 PASS / 1 expected FAIL — `Missing expected exception` |
| Review GREEN — Connector authorization tuple | full durable tuple conflict before connector/mutation | 12/12 PASS |
| Affected regression RED/GREEN | generic F18 replay writer cardinality | 123/124 expected FAIL 후 recovery-only retry로 124/124 PASS |
| Focused F19-F | recovery durable + architecture + Publication + Connector handoff | 47/47 PASS |
| F19-B/C/D/E affected | recovery/application/API-014/F17/F18/API-019 11 compiled files | 124/124 PASS |
| Restart matrix | durable Publication replay, execution evidence, generic/Connector nested lineage | 4/4 PASS |
| Full regression | compiled repository test runner | 962/962 PASS |
| Lint | full `apps/**/*.ts`, `modules/**/*.ts`, `packages/**/*.ts`, zero warnings | PASS |
| Typecheck | `tsc -p tsconfig.json --noEmit` | PASS |
| Clean build | `tsc -b tsconfig.build.json --clean` then build | PASS |
| Diff check | `git diff --check` | PASS |
| Dependency / lockfile | `git diff -- package.json pnpm-lock.yaml` | 0 |
| Network / audit | no dependency/network change | NOT_REQUIRED |

Required negative paths are direct behavior tests: duplicate recovery, conflicting fingerprint, RC1 overwrite, original identity reuse, missing parent, restart linkage loss, process-local fallback, nested automatic recovery and evidence overwrite all preserve external execution/mutation 0 as applicable.

Focused command:

```powershell
node --test dist/modules/recovery/src/recovery-durable-persistence.test.js dist/modules/recovery/src/recovery-orchestration-architecture.test.js dist/modules/publication/src/publication-reconciliation-service.test.js dist/modules/source/src/connector-recovery-handoff.test.js
```

Affected 11-file command:

```powershell
node --test dist/modules/recovery/src/recovery-orchestration-service.test.js dist/modules/recovery/src/recovery-orchestration-architecture.test.js dist/modules/recovery/src/recovery-durable-persistence.test.js dist/modules/source/src/external-integration-recovery-handoff.test.js dist/modules/source/src/external-integration-application.test.js dist/modules/source/src/connector-recovery-handoff.test.js dist/modules/source/src/connector-execution-coordinator.test.js dist/modules/publication/src/publication-reconciliation-service.test.js dist/modules/publication/src/publication-recovery-execution-planner.test.js dist/apps/api/src/publication-api.test.js dist/apps/api/src/publication-api-http-runtime.test.js
```

Restart command:

```powershell
node --test --test-name-pattern="nested ambiguity accepts|recovery execution idempotency replays|durable recovery replay survives restart|ambiguous Connector recovery creates" dist/modules/recovery/src/recovery-durable-persistence.test.js dist/modules/publication/src/publication-reconciliation-service.test.js dist/modules/source/src/connector-recovery-handoff.test.js
```

## 9. Known limitations

- F19 claim/result and F17/F18 domain execution remain separate existing durable stores, so distributed transaction은 아니다. Claim 뒤 result write 전 failure는 owning domain idempotency가 duplicate external execution을 차단하고 F19 exact retry가 result evidence를 완성한다.
- F19-F는 new runtime/API-017 composition, public API, recovery authority, corrective API-019 operation, provider/network/credential 또는 F19-H integration을 추가하지 않았다.
- Connector recovery executor의 operational production composition은 F19-D에서 기록된 별도 runtime concern이며, current handoff는 durable execution store가 없으면 fail closed한다.

## 10. Next brief prerequisites

- Architecture Owner가 bounded F19-F diff, RED/GREEN evidence와 본 completion report를 검토한다.
- 승인 후 별도 지시에 따라 local commit/ff-only integration을 수행한다. 현재 commit/push는 0이다.
- F19-H 시작 전 F19-F approved integration baseline을 확인한다. F19-G는 deferred 상태를 유지한다.

## Completion statement

F19-F completion target과 required negative tests를 충족했고 F19-G/H를 시작하지 않았다. Final Recommendation은 `APPROVE_F19_F_RECOVERY_IDEMPOTENCY_NESTED_AMBIGUITY`다.
