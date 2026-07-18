# Quality Metrics

| 항목 | 값 |
|---|---|
| Document ID | DOC-TEST-015 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Quality Owner / Business Owner |
| 기준일 | 2026-07-15 |

## Measurement principles

Metric은 definition, numerator/denominator, source/query version, window/cohort, owner, target, exclusions/data gaps와 action을 가진다. 단일 평균, vanity count 또는 missing result를 success로 사용하지 않는다.

## Coverage

Requirement/WF/Entity/API/UI/AI/SEC/OPS mapped/executed/pass coverage, P0/P1 regression coverage와 orphan count를 측정한다. Mapped만으로 executed/passed로 계산하지 않는다.

## Pass rate

Executed 중 pass/fail/blocked/not-run을 level/risk/capability/candidate별 보고한다. Rerun으로 initial failure를 숨기지 않고 first-pass와 final-pass를 분리한다.

## Defect density and flow

Scope-normalized defect count, severity, escape/reopen/repeat, age, time-to-triage/fix/verify와 root-cause category를 본다. 문서/코드 line 수만으로 quality를 판단하지 않는다.

## AI accuracy

Capability별 precision/recall/F-score 또는 task metric, critical error/hallucination, schema validation, confidence calibration, cohort worst-case, human correction/override와 drift를 측정한다. Threshold는 approved dataset/evaluation별 version화한다.

## Operational quality

Availability/latency/error, job/backlog, incident/change failure, alert quality, backup integrity/restore, achieved RPO/RTO, DR finding와 SLO/error budget을 OPS evidence와 연결한다.

## Business quality

Verification/publication accuracy, duplicate reduction, time-to-shortlist/client response, proposal/viewing/closing contribution, rework, stale/unknown publication와 user task success를 Phase 1 KPI 정의와 연결한다. Speed가 hard guardrail을 희생하면 positive quality가 아니다.

## Quality gate dashboard

Coverage, P0/P1 status, regression/UAT, AI critical errors, security/privacy, performance/SLO, backup/DR, known risk와 evidence freshness를 release candidate별 보여 준다. Dashboard가 source evidence를 대체하지 않는다.

