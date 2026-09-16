# REL-001 Blocker 2C Exact Candidate Rebuild / Reevaluation Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-262 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Release Owner / Quality Owner |
| 기준일 | 2026-09-16 |

## Goal

exact main HEAD `b7d2a864b8dbed9c6b1f0c7874481035159af886`의 REL-001 / Staging runtime closure를 기존 FEAT-024 알고리즘으로 다시 물질화하고, UI-006 live Core data blocker를 candidate-bound evidence로 재평가한다.

## Architecture

`release-candidate-artifact`의 exact-SHA별 closed definition을 additive하게 확장한다. Historical Phase 7 및 Blocker 1C definitions와 recorded identities는 변경하지 않는다. Blocker 2C definition은 Blocker 1C의 19개 runtime root를 그대로 사용하고 `UI_006_CORE_DATA` coverage만 실제 `CoreIdentityConsoleReadAdapter`와 `/v1/me` wiring evidence에 따라 `INCLUDED`로 전환한다. Component, artifact, release candidate 및 candidate fingerprint 직렬화와 SHA-256 계산식은 변경하지 않는다.

## Execution order

1. current SHA가 legacy fallback으로 평가되는 RED를 추가하고 실행한다.
2. current SHA 전용 root/coverage definition을 최소 추가하여 GREEN으로 전환한다.
3. exact clean build에서 component fingerprints, artifact fingerprint, release candidate ID와 candidate fingerprint를 두 번 물질화해 determinism을 확인한다.
4. 새 candidate와 `INCOMPLETE` manifest를 기존 durable store에 append하고 reopen/replay/idempotency를 검증한다.
5. UI-006은 `CLOSED`, live provider와 fresh dependency audit은 open으로 유지해 blocker count를 `3 → 2`로 재평가한다.
6. Acceptance `INCOMPLETE`, promotion handoff `UNAVAILABLE`, DEC-162 `IN_REVIEW`를 보존한다.
7. focused/affected/full verification, architecture/document/security checks와 independent review를 수행한다.

## Files

- Production: `modules/operations/src/release-candidate-artifact.ts`
- Tests: `modules/operations/src/release-candidate-artifact.test.ts`, `modules/operations/src/durable-release-acceptance-manifest-store.test.ts`
- Evidence: Blocker 2C runtime inventory, fingerprint matrix, acceptance reevaluation, blocker disposition, completion report
- Traceability: Master Index, REL-001 RTM, FEAT-024 traceability

## Constraints

- Historical candidate/manifest evidence mutation: `0`
- New acceptance vocabulary or hash algorithm: `0`
- Provider/network/deployment action: `0`
- Dependency/lockfile change: `0`
- API-003~010 expansion: `0`
- Dependency audit: `NOT_RUN`
- Commit / Push: `NOT_AUTHORIZED / NOT_PERFORMED`

Related: [Blocker 1C Plan](REL001_BLOCKER1C_EXACT_CANDIDATE_REBUILD_PLAN.md), [Blocker 2 Runtime Traceability](REL001_BLOCKER2_UI006_RUNTIME_TRACEABILITY.md), [FEAT-024 Traceability](FEAT024_TRACEABILITY_MATRIX.md).
