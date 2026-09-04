# F19-D Connector Ambiguity / New Invocation Recovery Handoff Completion

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-106 |
| Historical Artifact ID | F19-D-REPORT |
| 문서 버전 | v0.2 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner |

## 1. Objective

ambiguous Connector invocation을 immutable F19 case와 연결하고, separately authorized new invocation만 current API-018 coordinator에 handoff했다. Final Recommendation: `APPROVE_F19_D_CONNECTOR_AMBIGUITY_RECOVERY_HANDOFF`.

## 2. Documents read

- F19-D Brief (Part 4)
- [F19 Canonical Design v1](../implementation/F19_RECONCILIATION_RECOVERY_CANONICAL_DESIGN_V1.md)
- F19-B/F19-C implementation reports and plans
- F18-B/D/F completion reports, F18 coordinator/admission/runtime tests
- [FEAT-019 Traceability Matrix](../implementation/FEAT019_TRACEABILITY_MATRIX.md)

## 3. Files created

- `modules/source/src/connector-recovery-handoff.ts`
- `modules/source/src/connector-recovery-handoff.test.ts`
- this report and `docs/implementation/F19_D_CONNECTOR_AMBIGUITY_RECOVERY_HANDOFF_IMPLEMENTATION_PLAN.md`

## 4. Files modified

- Connector coordinator, F19 durable recovery contracts/store, focused tests, source export, F18 architecture assertion, and FEAT019 RTM.

## 5. Key decisions added

- ambiguity linkage is one-way and idempotent; original invocation/result/checkpoint is not mutated.
- only `CONFIRMED_NOT_EXECUTED + RECOVERY_AUTHORIZED + CONNECTOR_REEXECUTION` reaches handoff.
- `ConnectorRecoveryExecutionPlanner` creates `connector-recovery:<recoveryId>`; the bound identity must match and differ from the original.
- Handoff verifies durable original source/connector scope existence, duplicate absence, trusted executor and applicable active Integration Contract before delegating to existing coordinator.
- Recovery execution fingerprint는 trusted tenant/scope/source/connector/purpose, planned invocation, input reference/version, expected checkpoint version 및 authoritative Integration Contract identity/version을 결합한다.
- Trusted Session expiry는 request timestamp가 아니라 injected server clock으로 검증하며 caller-controlled `startedAt`은 authentication authority가 아니다.
- F19 does not import a Connector port or call a connector. Checkpoint creation remains in authoritative successful coordinator completion.

## 6. Open decisions

`OPEN DECISION`: production composition of the F19 durable store adapter into an operational executor remains a runtime/API-017 concern and is not added by F19-D.

## 7. Inconsistencies found

The canonical F19 immutable Connector origin has only `invocationId`; it does not persist source/connector fields. The implementation preserves that contract and proves source/connector binding by requiring the original invocation in the current F18 durable scope before handoff.

## 8. Validation performed

| Gate | Result |
|---|---|
| RED | missing handoff module; missing ambiguity linkage; missing durable Connector lookup; expected failure confirmed before GREEN |
| Focused / affected regression | 55/55 PASS: coordinator 14, F19-D handoff 9, architecture 2, F18-B admission 7, durable recovery 9, orchestration 5, production API-018 6, composed API-018/API-019 3 |
| Approved F19-C lint-cleanup regression | 22/22 PASS: reconciliation service 20, recovery planner 2 |
| Typecheck | PASS (`tsc --noEmit`) |
| Full-repository lint | PASS (zero warnings/errors) |
| Build | PASS (`tsc -b tsconfig.build.json`) |
| `git diff --check` | PASS |

### Round 1 correction evidence

- trusted runtime context, existing `ConnectorRuntimeAuthorizer`, durable active/version-matched Integration Contract reader, and resolver/executor SoD are now required before handoff.
- planned invocation preblocking was removed; replay remains owned by the existing coordinator.
- a `completeInvocation()` persistence failure creates ambiguity linkage before rethrowing.
- production API-018 composition rejects a missing F19 ambiguity writer and accepts the existing injected writer boundary.
- Round 1 focused/affected evidence: 51/51 PASS — coordinator 14, handoff 5, architecture 2, F18-B admission 7, durable recovery 9, orchestration 5, production API-018 6, composed API-018/API-019 3.

### Round 2 direct evidence

- Configurable harness는 real `DurableConnectorExecutionUnitOfWork`, `DurableExternalIntegrationStore`, `DurableRecoveryOrchestrationStore`, `SourceIngestionAdmissionGate` 및 actual `ConnectorExecutionCoordinator`를 사용한다. Trusted context resolver/authorizer는 fail-closed case configuration과 exact lookup assertion에만 사용한다.
- RED: fingerprint에서 `inputVersion`을 의도적으로 제거한 mutation에서 handoff 7/8 PASS, `Missing expected exception: inputVersion` 실패를 확인했다. Mutation을 복원한 GREEN은 handoff 8/8 PASS다.
- expired/revoked/inactive/assurance-inconsistent/wrong-team context, runtime authorizer denial, exact tenant/scope/team lookup, suspended/mismatched/missing contract는 Connector call 0 및 connector durable mutation 0을 직접 검증한다.
- Real durable `DUPLICATE_ORIGIN`은 동일 case/version/evidence를 보존한다. Actual coordinator ambiguity 및 exact replay는 link 1, initial Connector call 1, replay call 0, checkpoint unchanged를 검증한다.
- Actual coordinator success replay는 replay Connector call 0 및 mutation 0이다. `inputReference`, `inputVersion`, expected checkpoint와 authoritative Integration Contract identity 변경은 각각 `IDEMPOTENCY_CONFLICT`, Connector call 0 및 durable mutation 0이다.
- Final focused/affected evidence: 54/54 PASS — coordinator 14, handoff 8, architecture 2, F18-B admission 7, durable recovery 9, orchestration 5, production API-018 6, composed API-018/API-019 3.

### Round 3 critical clock correction evidence

- RED: expired Session과 forged earlier `request.startedAt` 조합이 actual coordinator를 통과해 `SUCCEEDED`를 반환하는 실패를 8/9에서 재현했다.
- GREEN: `ConnectorRecoveryExecutionHandoff`는 existing Connector runtime pattern과 동일한 injected `clock: () => string`의 server time으로 shared trusted-context validation을 수행한다. Handoff 9/9 PASS다.
- Forged timestamp regression은 authorizer 0, coordinator 0, Connector call 0, checkpoint 0 및 durable mutation 0을 직접 검증한다.
- Reviewer-approved F19-C optional-chain lint correction 2건만 behavior-preserving substitution으로 적용했다. Direct affected regression 22/22 및 full-repository lint zero warning/error를 확인했다.
- Final focused/affected evidence: 55/55 PASS — coordinator 14, handoff 9, architecture 2, F18-B admission 7, durable recovery 9, orchestration 5, production API-018 6, composed API-018/API-019 3. Full-repository lint, typecheck, clean build 및 diff check PASS다.

Dependency and lockfile changes: `0`. Commit and push: `NOT_PERFORMED`.

## 9. Known limitations

No public HTTP operation, provider/network call, credential, new API-018 operation/state, or new persistence subsystem was added. `CONFIRMED_EXECUTED` and `UNRESOLVED` never auto-rerun.

## 10. Next brief prerequisites

Architecture Owner review is required before commit/integration. F19-E and later briefs are not started.
