# F19-C Publication Resolve / Recover Separation Implementation Report

| 항목 | 값 |
|---|---|
| Document ID | F19-C-REPORT |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 기준 commit | `7ef0c809c5f1ec1c6d7791d4856662234831a37d` |
| Branch | `codex/f19-c-publication-recovery` |
| Push | `NOT_PERFORMED` |

## 1. Objective

기존 API-014의 `RESOLVE_RECONCILIATION`, `RECOVER_PUBLICATION`, `REPUBLISH_PUBLICATION` 의미를 분리했다. Resolve는 finding 확정만 수행하고, Recover는 이미 durable하게 승인된 F19-B Publication recovery binding을 소비해 기존 F17 실행 경로만 사용한다. Republish 계약과 동작은 변경하지 않았다.

Final Recommendation:

`APPROVE_F19_C_PUBLICATION_RESOLVE_RECOVER_SEPARATION`

## 2. Documents read

- F19-C Publication Resolve vs Recover Semantic Separation Brief
- [F19 Reconciliation / Recovery Canonical Design v1](../implementation/F19_RECONCILIATION_RECOVERY_CANONICAL_DESIGN_V1.md)
- [FEAT-019 Traceability Matrix](../implementation/FEAT019_TRACEABILITY_MATRIX.md)
- [F19-B Implementation Report](F19_B_RECONCILIATION_CASE_EVIDENCE_RECOVERY_IDENTITY_IMPLEMENTATION_REPORT.md)
- [F19-C Gap Matrix](F19_C_PUBLICATION_RESOLVE_RECOVER_GAP_MATRIX.md)
- [F19-C Implementation Plan](../implementation/F19_C_PUBLICATION_RESOLVE_RECOVER_IMPLEMENTATION_PLAN.md)

## 3. Files created

- `modules/publication/src/publication-recovery-execution-planner.ts`
- `modules/publication/src/publication-recovery-execution-planner.test.ts`
- `docs/reviews/F19_C_PUBLICATION_RESOLVE_RECOVER_GAP_MATRIX.md`
- `docs/implementation/F19_C_PUBLICATION_RESOLVE_RECOVER_IMPLEMENTATION_PLAN.md`
- `docs/reviews/F19_C_PUBLICATION_RESOLVE_RECOVER_SEPARATION_IMPLEMENTATION_REPORT.md`

## 4. Files modified

- Publication application contracts, infrastructure configuration/composition, reconciliation service, F17 coordination service, index and direct tests
- Recovery orchestration store contract, durable lookup implementation and durability tests
- `docs/implementation/FEAT019_TRACEABILITY_MATRIX.md`

Production dependency, lockfile, API-018, API-019, Console, provider contract와 frozen Architecture 파일 변경은 0이다.

## 5. Key decisions added

- `RESOLVE_RECONCILIATION`은 provider/connector 호출 없이 Publication finding만 확정한다.
- `RECOVER_PUBLICATION`은 session-derived actor와 현재 live authority를 검증한 뒤, F19-B store에서 exact Publication/case/tenant/scope의 terminal `CONFIRMED_NOT_EXECUTED + RECOVERY_AUTHORIZED + PUBLICATION_RECOVERY` binding만 소비한다.
- trusted planner가 승인 전에 새로운 `attemptId`와 `commandId`를 resource-bound deterministic identity로 생성한다. `PublicationRecoveryExecutionIdentityValidator`와 Recover handoff는 exact planner output만 수용하며 caller 값으로 대체하지 않는다.
- Recovery는 기존 F17 eligibility, durable intent, dispatch, receipt/evidence/state 및 provider normalization 경로를 재사용한다. F19에서 provider를 직접 호출하는 경로는 0이다.
- 동일 recoveryId와 canonical fingerprint는 기존 결과를 replay하며 provider를 다시 호출하지 않는다. logical identity의 object property 순서는 fingerprint에 영향을 주지 않는다.
- UNKNOWN recovery는 원본 case를 다시 열지 않고 기존 F19 `createCase` boundary로 새 child case를 생성한다. child writer failure 뒤 exact retry는 provider 재호출 없이 누락된 child를 한 번 생성하며 existing duplicate origin은 idempotent하게 수용한다.
- 현재 F17 effect-producing coordination surface에 없는 non-initial recovery는 조용히 추론하지 않고 fail closed한다. 이는 새 operation/state/contract를 만들지 않는 containment rule이다.

## 6. Open decisions

없음. 일반화된 non-initial provider recovery contract는 이번 범위에서 승인되지 않았으며 F19-C는 이를 구현하거나 암묵적으로 확장하지 않는다.

## 7. Inconsistencies found

초기 inventory에서 Resolve와 Recover가 동일 `coordinate()` 경로를 사용하고 둘 다 `RESOLVE_RECONCILIATION` domain command를 실행하는 overlap을 확인했다. 구현 중 fresh review에서 recovery fingerprint가 object insertion order에 의존하는 Important 1건을 추가로 발견해 explicit tuple canonicalization과 RED/GREEN 회귀로 제거했다. 후속 독립 검토의 Important 2건(UNKNOWN child writer failure 뒤 lineage 누락, caller-authored durable Publication identity substitution)을 추가 RED/GREEN 회귀와 최소 보정으로 제거했다.

최종 unresolved Critical/Important/Minor finding은 `0/0/0`이다.

## 8. Validation performed

| Gate | Result |
|---|---|
| Node / pnpm | Node `v24.18.0`; repository pin pnpm `11.9.0` |
| F19-C focused | 11/11 PASS |
| F19-B/F17/API-014 affected | 122/122 PASS |
| Full regression | 932/932 PASS |
| Lint | PASS |
| Typecheck | PASS |
| Build | PASS |
| Verify | PASS |
| Architecture checksum | 153/153 PASS; `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` |
| Gitleaks | 0 findings |
| `git diff --check` | PASS |
| Dependency / lockfile changes | 0 |
| Production audit | PASS — `pnpm.cmd audit --prod`; exit 0; 0 vulnerabilities |
| Full audit | EXPECTED_ADVISORIES_ONLY — `pnpm.cmd audit`; exit 1; existing approved development-only transitive `brace-expansion` High 4 |
| New unapproved High / Critical | 0 |

Direct assertions cover missing/invalid durable authorization, UNRESOLVED/CONFIRMED_EXECUTED/non-authorized dispositions, exact trusted planner identity versus caller substitution, original identity reuse, wrong resource/tenant/scope, stale authorization and Publication version, capability/MFA/SoD/approval/verification/permission/target/channel/suspension failure, exact replay, fingerprint conflict, original-history preservation and nested UNKNOWN lineage including writer-failure retry. Existing API-014 HTTP tests continue to reject caller-authored finding/evidence/identity fields, and lifecycle regressions preserve ordinary REPUBLISH behavior.

## 9. Known limitations

- Real provider activation, credentials, approved external destinations and external network activation remain 0.
- Recovery reader/writer are explicit trusted composition dependencies. Missing durable F19 composition fails closed; no in-memory production fallback was added.
- The current existing F17 effect-producing recovery path is `INITIAL_PUBLISH`. Other operation-specific recovery execution requires a separately approved canonical contract and is not inferred from reconciliation history.
- F19-C-scoped registry audit authorization was used only for `registry.npmjs.org`; both audits left `package.json` and `pnpm-lock.yaml` unchanged.

## 10. Next brief prerequisites

- Create exactly one bounded local F19-C commit and integrate it into clean `main` with `git merge --ff-only`.
- F19-D/E/F/G/H remain `NOT_STARTED`

## Completion gate

| 항목 | 결과 |
|---|---|
| Resolve provider calls | 0 |
| Recover semantic separation | PASS |
| Durable recovery authorization | PASS |
| New recovery identity | PASS |
| Original attempt / command reuse | 0 / 0 |
| Live authority / approval / target / SoD | PASS |
| Same-recovery duplicate provider invocation | 0 |
| UNKNOWN containment / nested ambiguity | PASS / PASS |
| Original history preservation | PASS |
| REPUBLISH independence | PASS |
| F19-B / F17 preservation | PASS / PASS |
| New API operations | 0 |
| Real provider / network / credentials | 0 |
| F19-D/E implementation | 0 |
| Unresolved blockers | 0 |

Commit: `NOT_CREATED`

Push: `NOT_PERFORMED`
