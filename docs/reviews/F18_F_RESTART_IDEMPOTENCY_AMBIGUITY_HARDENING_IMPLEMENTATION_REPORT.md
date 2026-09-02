# F18-F Restart / Idempotency / Ambiguity Hardening Implementation Report

| 항목 | 값 |
|---|---|
| Version | v0.1 |
| Status | APPROVE |
| Final Recommendation | `APPROVE_F18_F_RESTART_IDEMPOTENCY_AMBIGUITY_HARDENING` |
| Baseline | `66ca4633323866a440faac00a6157082702cab5d` |
| Branch | `codex/f18-f-restart-idempotency-hardening` |
| Report date | 2026-09-02 |

## 1. Objective

F18 Connector, API-018 및 API-019의 restart, replay, idempotency, lease, checkpoint, mapping, observation, suspension 및 ambiguous technical outcome을 기존 canonical authority 안에서 hardening했다. 새로운 business semantics, API operation, persistence subsystem 또는 F19 reconciliation/recovery는 추가하지 않았다.

## 2. Documents read

- F18-F Restart / Idempotency / Ambiguity Hardening Brief
- F18-F Replay vs Live Admission Canonical Decision
- F18-F approved design 및 implementation plan
- F18-B/C/D/E 승인 구현과 테스트

## 3. Implementation summary

Production 변경은 `modules/source/src/connector-execution-coordinator.ts` 하나뿐이다. Trusted Application boundary가 만든 `SourceIngestionAdmissionInput`에서 durable scope를 복사하고, exact durable replay와 invocation identity conflict를 live execution admission보다 먼저 판단한다. Prior durable identity가 없을 때만 current F18-B admission과 lease/execution path로 진입한다.

TDD RED에서 다음 결함을 확인했다.

- completed/ambiguous exact replay가 current blocked admission 때문에 `BLOCKED`로 반환됨
- conflicting fingerprint가 admission 이전에 `IDEMPOTENCY_CONFLICT`가 되지 않음
- 동일 `invocationId`와 다른 idempotency key가 deterministic conflict 대신 blocked admission으로 종료됨

최소 production ordering 변경 후 모두 GREEN이 되었다.

## 4. Completion gate

| Gate | Result |
|---|---|
| Restart Preservation | PASS |
| Lease Restart Safety | PASS |
| Invocation Replay | PASS |
| Durable Idempotency | PASS |
| EXECUTION_STARTED Ambiguity | PASS |
| Blind Rerun Paths | 0 |
| Checkpoint Restart Safety | PASS |
| Checkpoint Duplicate Advance | 0 |
| API-018 Replay Safety | PASS |
| API-019 Mapping Restart | PASS |
| Observation Idempotency | PASS |
| Integration Contract Restart | PASS |
| Suspension Enforcement After Restart | PASS |
| Conflict Evidence Immutability | PASS |
| Technical Reconciliation Boundary | PASS — `UNRESOLVED_CONFLICT / F19_HANDOFF_REQUIRED`; business mutation 0 |
| Process-local Production Authority | 0 |
| Unsafe Persistence/Response Leakage | 0 |
| F18-B/C/D/E Preservation | PASS |
| F17 Preservation | PASS |
| New API Operations | 0 |
| Real Provider / Network / Credentials | 0 |
| F19 Implementation | 0 |
| Unresolved Blockers | 0 |

## 5. Restart and replay evidence

- Active/expired lease state, owner와 binding은 reopen 후 유지된다.
- Completed exact replay는 prior authoritative result를 반환하며 connector invocation, lease mutation 및 checkpoint duplicate advance가 0이다.
- `EXECUTION_STARTED` 또는 provider result 이후 local completion failure는 reopen 후 `AMBIGUOUS / RECONCILIATION_REQUIRED`로 유지되며 blind rerun이 0이다.
- Same invocation의 fingerprint 또는 idempotency identity conflict는 admission 전에 deterministic `IDEMPOTENCY_CONFLICT`로 종료되고 mutation이 0이다.
- New invocation identity만 current F18-B live admission을 사용한다.

## 6. API-018 / API-019 evidence

- API-018 HTTP close/reopen exact replay는 prior response를 재사용하고 connector call 0을 유지한다.
- Conflicting API-018 request는 HTTP 409이며 `AdvanceCheckpoint`는 public HTTP surface에서 계속 거부된다.
- External mapping identity/version과 conflict evidence는 restart 후 유지되고 remap overwrite가 0이다.
- Observation exact replay와 conflicting normalized input은 durable idempotency 규칙을 유지한다.
- SUSPENDED Integration Contract를 API-018/API-019 양쪽 runtime restart 후 재검증했으며 new observation ingress는 HTTP 403, observation count 변화 0이다.
- Technical reconciliation evidence는 append-only이며 unresolved proof는 F19 handoff 상태만 반환한다.

## 7. Verification results

| Verification | Result |
|---|---|
| Focused F18-F matrix | 47/47 PASS (review correction 후 coordinator 13/13 및 relevant composed tests 재검증) |
| Affected F18/F17 regression | 81/81 PASS |
| Full Regression | 907/907 PASS |
| Lint | PASS |
| Typecheck | PASS |
| Build | PASS |
| Verify | PASS — lint, typecheck, build 및 full compiled test 구성요소 모두 exit 0 |
| Architecture checksum | 153/153 PASS — `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` |
| `git diff --check` | PASS |
| Gitleaks | 0 findings |
| Dependency audit | NOT RUN — F18-F scoped network approval 없음; Brief상 final gate audit 불필요 |
| Dependency / lockfile changes | 0 |

격리 worktree에서 `pnpm.cmd build`가 dependency 상태 복구를 위해 registry 접근을 시도했으나 F18-F network approval이 없어 즉시 중단했다. 이후 모든 gate는 main workspace의 기존 승인된 local dependency runtime을 재사용해 외부 전송 없이 수행했다.

## 8. Independent review

Fresh bounded review는 replay/access ordering, durable identity conflict, zero-effect assertions, crash windows, API ownership, safe reload, process-local authority와 F19 exclusion을 재검토했다.

- Critical: 0
- Important: 0
- Minor: 0
- Disposition: READY

Review 중 동일 invocation/different idempotency key가 live admission으로 빠지는 Important 1건을 발견했으며 RED test로 재현 후 동일 coordinator 파일에서 최소 보정했다. 최종 full regression 907/907과 모든 static/security gate를 다시 통과했다.

## 9. Files created

- `docs/superpowers/specs/2026-09-02-f18-f-restart-idempotency-ambiguity-design.md`
- `docs/superpowers/plans/2026-09-02-f18-f-restart-idempotency-ambiguity.md`
- `modules/source/src/f18-restart-authority-architecture.test.ts`
- `docs/reviews/F18_F_RESTART_IDEMPOTENCY_AMBIGUITY_HARDENING_IMPLEMENTATION_REPORT.md`

## 10. Files modified

- `modules/source/src/connector-execution-coordinator.ts`
- `modules/source/src/connector-execution-coordinator.test.ts`
- `modules/source/src/connector-durable-persistence.test.ts`
- `modules/source/src/connector-runtime-application.test.ts`
- `apps/api/src/connector-api-http-runtime.test.ts`
- `modules/source/src/external-integration-durable-persistence.test.ts`
- `apps/api/src/external-integration-http-runtime.test.ts`

## 11. Scope protection

- API-018/API-019 new operation: 0
- New lifecycle/schema/persistence subsystem: 0
- Real provider/network/credentials: 0
- F17 behavior modification: 0
- Frozen Registry/RTM modification: 0
- F19 implementation: 0

## 12. Open decisions and limitations

- OPEN DECISION: F18-F dependency audit은 scoped network approval이 제공되는 별도 gate에서만 실행할 수 있다.
- Actual business reconciliation 및 recovery는 F19 범위로 유지한다.

## 13. Git state

- Main: clean / unchanged
- Worktree: dirty — reviewed F18-F-only change set, commit intentionally not created
- Commit: `NOT_CREATED`
- Push: `NOT_PERFORMED`
- F19: `NOT_STARTED`

## 14. Next brief prerequisites

Architecture Owner가 본 F18-F evidence와 diff를 승인한 뒤에만 audit 또는 local commit을 별도 승인할 수 있다. F19는 시작하지 않는다.

Report: `docs/reviews/F18_F_RESTART_IDEMPOTENCY_AMBIGUITY_HARDENING_IMPLEMENTATION_REPORT.md`
