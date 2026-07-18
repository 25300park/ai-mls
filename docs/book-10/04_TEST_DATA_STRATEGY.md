# Test Data Strategy

| 항목 | 값 |
|---|---|
| Document ID | DOC-TEST-005 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Quality Owner / Data Reviewer / Privacy Owner |
| 기준일 | 2026-07-15 |

## Test data model

Dataset은 ID/version, purpose/tests, owner, source type, entity/status coverage, classification, generation/masking method, expected truth, effective/expiry와 cleanup evidence를 가진다.

## Synthetic data

Synthetic-first다. Valid/invalid/boundary/conflict/duplicate/stale/multilingual/missing evidence, contact/privacy, approval/publication와 failure/recovery를 포함하되 실제 person/credential/external account를 재현하지 않는다. AI evaluation은 representative cohort와 controlled adversarial examples를 포함한다.

## Privacy

Production personal/raw data의 test 사용은 default deny다. Approved exception은 purpose/minimum subset, masking/anonymization validation, Security/Privacy approval, isolated access, retention/cleanup와 audit가 필요하다. Masked data도 re-identification risk에 따라 classified다.

## Refresh and versioning

Requirement/schema/prompt/model/policy 변화, drift 발견과 scheduled review 때 dataset을 refresh한다. 새 version은 expected result와 cohort delta를 review하고 old result 재현을 위해 metadata를 보존한다.

## Isolation

Test별 namespace/tenant/object/session/job/external target을 분리하고 parallel execution 간 state leakage를 방지한다. Real publication/contact/connector/notification effect는 차단된 test double 또는 approved sandbox boundary만 사용한다.

## Data lifecycle

Provision → validate → use → preserve minimum evidence → clean/dispose. Legal Hold/defect reproduction exception을 제외하고 test payload를 무기한 보존하지 않는다. Backup/restore test copy도 같은 rule을 따른다.

## Quality controls

Referential/state consistency, provenance, uniqueness, clock/timezone, amount/location/language, classification와 expected outcome을 validate한다. Test data defect와 product defect를 구분하고 data change로 failing expected behavior를 숨기지 않는다.

