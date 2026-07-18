# Data Principles

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-030 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Database Reviewer |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](00_PROJECT_CONSTITUTION.md) |

## Data ownership

Business Owner는 business meaning과 permitted use를, Data/Database Owner는 integrity와 lifecycle을, Security/Privacy Owner는 access/retention control을 책임진다. source content의 법적 ownership 또는 reuse right는 자동으로 mrHOMES에 귀속된다고 가정하지 않으며 source policy와 permission을 별도로 확인한다.

> **OPEN DECISION:** named data steward, legal/source-policy reviewer와 data classification owner는 Book 3/8 전에 지정한다.

## Source provenance

- 중요한 record는 source identity/reference, capture time/method와 transformation lineage를 유지한다.
- normalization, merge와 duplicate resolution은 source record를 삭제하지 않는다.
- source evidence를 raw content로 보존할지 reference만 유지할지는 policy/retention에 따라 명시한다.
- manual correction도 actor, before/after와 reason을 추적한다.
- provenance가 없거나 invalid하면 external-use gate를 통과할 수 없다.

## Candidate data

candidate listing은 discovered/internal data다. parse 또는 normalization이 완료되어도 verified listing이 되지 않는다. unknown과 conflicting value를 허용하되 status/confidence/source를 명시하고 외부 노출을 차단한다.

## Verified data

verified data는 authorized human이 defined evidence와 timestamp를 바탕으로 확인한 field/state다. verification은 time-bound이고 scope가 있으며, 이후 source change나 expiry로 재검증이 필요하다. verification은 sharing/publication permission이 아니다.

## Published data

published data는 verified data의 subset이 아니라, 유효한 verification과 별도 public-publication permission 및 human approval을 모두 참조하는 external representation이다. publication record는 source provenance, approval와 published location/version을 역추적하고 correction/unpublish 경로를 가진다.

## Data separation model

| Concept | Meaning | Must not be treated as |
|---|---|---|
| property | canonical 부동산 master | source post 또는 offer |
| tower | property 내부의 구별되는 동/타워 | property 전체 |
| unit entity | 식별 가능한 물리 unit | listing offer |
| listing offer | 특정 조건·가격·contact의 거래 제안 | 물리 unit 자체 |
| source record | 원문/reference와 capture evidence | verified truth |
| candidate listing | 내부 candidate interpretation | external listing authority |

세부 model과 cardinality는 Book 3에서 정의하며 이 separation을 위반할 수 없다.

## Retention principles

- raw data, contact, audit, verification와 publication evidence는 목적·risk·policy에 맞는 retention class/period를 가진다.
- raw data는 `retention_until`에 해당하는 enforceable expiry를 가져야 한다.
- legal hold, incident 또는 dispute exception은 owner, scope, expiry와 approval을 기록한다.
- backup/archive도 retention과 deletion scope에 포함한다.
- 무기한 보존을 default로 하지 않는다.

## Deletion principles

- deletion은 authorized, auditable, recoverability/backup impact가 정의된 process로 수행한다.
- provenance와 audit obligation 때문에 content 삭제 대신 reference/tombstone이 필요한 경우 rationale를 남긴다.
- contact/personal data deletion은 derived copy, search index, AI input/output와 export를 포함해 영향 범위를 추적한다.
- deletion job failure는 관찰·재시도·escalation되어야 한다.

## Data quality principles

| Dimension | Minimum rule |
|---|---|
| Accuracy | verified field는 evidence와 reviewer를 참조 |
| Completeness | required/unknown/not-applicable를 구분 |
| Freshness | verification/permission expiry를 검사 |
| Consistency | Glossary와 canonical naming/state 사용 |
| Uniqueness | duplicate를 merge해도 provenance를 보존 |
| Validity | type/range/business rule 검증 후 authoritative persistence |
| Traceability | source에서 external representation까지 lineage 유지 |

## Master data principles

- canonical property와 alias를 분리한다.
- master data 변경은 affected candidate/offer/match를 추적하고 history를 보존한다.
- AI normalization은 suggestion이며 human/application validation 없이 canonical master를 바꾸지 않는다.
- 하나의 unit entity에 여러 listing offer와 contact가 존재할 수 있다.
- merge/split에는 correction, rollback와 provenance rule이 필요하다.

## Measurable data gates

- external record 100%가 verification, permission, approval와 source provenance reference를 가져야 한다.
- expired verification/permission을 사용한 publication은 차단되어야 한다.
- retention 대상은 owner/period/action이 없으면 release-ready가 아니다.
- duplicate merge test는 source lineage와 offer distinction 보존을 증명해야 한다.

## Constitutional bindings

`REQ-CONST-003`–`REQ-CONST-005`, `REQ-CONST-007`, `REQ-CONST-008`, `REQ-CONST-011`–`REQ-CONST-013`을 data authority/lifecycle rule로 구체화한다.
