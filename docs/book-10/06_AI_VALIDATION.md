# AI Validation

| 항목 | 값 |
|---|---|
| Document ID | DOC-TEST-007 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | AI Reviewer / Quality Owner |
| 기준일 | 2026-07-15 |

## Evaluation contract

Capability, dataset/cohort/version, provider/model/prompt/schema/policy, metric, threshold, confidence calibration, limitations, human reviewer와 result evidence를 고정한다. Provider comparison은 same task/data/policy로 수행한다.

## Parser evaluation — AI-001

Field precision/recall, required-field coverage, source span/provenance, invalid/ambiguous/conflict handling, multilingual/noisy content와 schema rejection을 측정한다. Unsupported field는 UNKNOWN/omitted로 남기고 fabricated value를 금지한다.

## Normalization evaluation — AI-002

Canonical property/location/unit resolution accuracy, alias handling, top-k/ambiguity, no-match, wrong-merge risk와 human correction을 평가한다. Confidence만으로 canonical master를 변경하지 않는다.

## Duplicate evaluation — AI-003

Pair/group precision/recall, false merge/split cost, evidence/rationale, threshold/cohort와 human disposition agreement를 측정한다. Suggested group가 자동 merge하지 않음을 검증한다.

## Requirement and matching evaluation — AI-004/005

Requirement field fidelity/constraint preservation, ranking relevance, hard-filter violation zero target, explanation/evidence, diversity/tie/staleness와 human shortlist outcome을 평가한다. Historical closing을 truth label로 무비판 사용하지 않는다.

## Search interpretation — AI-006

Intent/filter/entity/result-class accuracy, ambiguity confirmation, unauthorized/restricted leakage와 deterministic canonical filter 재검사를 평가한다.

## Confidence validation — AI-007

Band calibration, error rate by band/capability/cohort, UNKNOWN handling, threshold stability, out-of-distribution/low evidence와 validation failure routing을 측정한다. Numeric threshold는 approved evaluation 전 `OPEN DECISION`이다.

## Hallucination prevention

Source-grounded fields, closed schema, allowed vocabulary, semantic/security validation, unsupported claim rejection, adversarial/prompt-injection content, secret/personal leakage와 provider failure를 검증한다. Hallucination rate definition은 capability별로 명시한다.

## Human review validation

Reviewer가 source/input/result version, confidence/limitation과 diff를 보고 accept/correct/reject할 수 있는지, correction/provenance/audit가 보존되는지 검증한다. AI review는 Verification/Permission/Approval이 아니다.

## Regression and acceptance

Overall score 외 worst cohort, critical error, drift와 previous baseline delta를 검토한다. Critical authority/privacy/provenance violation은 평균 metric과 무관하게 blocker다.

