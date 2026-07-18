# Test Strategy

| 항목 | 값 |
|---|---|
| Document ID | DOC-TEST-002 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Quality Owner |
| 기준일 | 2026-07-15 |

## Quality objectives

Constitution compliance, business correctness, authority separation, provenance/audit completeness, privacy/security, AI fitness, operational resilience, accessibility와 predictable release를 evidence로 입증한다.

## Testing principles

- risk/requirement/trace-based; production-like semantics without production secrets/personal data.
- deterministic control과 probabilistic AI evaluation을 분리한다.
- positive, negative, boundary, concurrency, stale version, idempotency, failure/recovery를 포함한다.
- tester independence는 risk에 비례하고 author/self-approver만으로 hard guardrail을 accept하지 않는다.
- defect를 숨기기 위한 expected-result 변경을 금지하며 requirement 변경은 CR/Decision review를 거친다.
- repeatable data/config/version/environment와 immutable evidence를 유지한다.

## Test lifecycle

`Plan/Trace → Design → Review → Data/Environment Ready → Execute → Capture Evidence → Triage → Fix/Retest → Regression → Accept/Reject → Archive`

각 단계는 test ID/version, requirement, owner/reviewer, environment/config/data, expected/actual, evidence, defect와 disposition을 가진다. `DEFINED`, `READY`, `EXECUTED`, `PASSED`, `FAILED`, `BLOCKED`, `RETIRED`를 test execution status로 사용하되 document lifecycle과 구분한다.

## Entry and exit criteria

Entry: approved-enough requirement/source, trace, testable expected result, isolated environment/data, candidate/config identity와 required access. Exit: planned scope executed, hard guardrail pass, blockers resolved/deferred by authority, regression/UAT/operational/security evidence와 sign-off.

## Roles and responsibilities

| Role | Responsibility |
|---|---|
| Quality Owner | strategy, registry, coverage, evidence quality, gate recommendation |
| Test Author/Executor | design/data/execute/evidence; 자신의 high-risk result 단독 승인 금지 |
| Business/UAT Owner | workflow/business outcome와 acceptance sign-off |
| Security/Privacy Reviewer | SEC control/privacy/abuse test와 blocker disposition |
| AI Reviewer | dataset/metric/threshold/error analysis/human review validation |
| Data Reviewer | entity/state/provenance/integrity/recovery validation |
| Operations Owner | performance/resilience/backup/DR/monitoring evidence |
| Development Reviewer | unit/integration/fix/regression feasibility와 root cause |
| Release Owner | candidate scope, gate evidence와 final release recommendation |

## Risk-based priority

P0: authority/publication/security/privacy/audit/data loss/recovery. P1: core workflows/API/UI and material AI quality. P2: usability/performance/operational degradation. P3: low-impact cosmetic/reporting. P0/P1는 release candidate마다 regression이 필요하다.

## Evidence

Evidence는 candidate/test/data/config/environment version, time/executor, steps/input class, expected/actual, logs/screenshots/result reference, defect와 reviewer를 포함한다. Sensitive payload/credential을 evidence에 복제하지 않는다.

