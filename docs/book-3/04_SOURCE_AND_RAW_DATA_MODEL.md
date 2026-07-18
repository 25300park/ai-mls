# Source and Raw Data Model

| 항목 | 값 |
|---|---|
| Document ID | DOC-DATA-005 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Database Reviewer |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Model purpose

외부 또는 사람이 제공한 내용을 검증된 사실과 혼동하지 않으면서 capture evidence, source policy, transformation lineage와 retention을 보존한다.

## Logical entities

| Entity | Purpose | Important logical attributes | Authority / owner |
|---|---|---|---|
| Source Registry | source의 identity, type, allowed intake/use와 policy version 관리 | name, source_type, policy_status, allowed_methods, allowed_uses, policy_version, reviewer, review dates | Source Policy Owner; policy authority only |
| Raw Source | 한 번의 observation/intake evidence | source reference, captured/observed times, capture method, content fingerprint, language, parser eligibility, privacy class, retention class | Source Data Steward; SOURCE_EVIDENCE |
| Raw Attachment | raw source에 속한 binary/external evidence reference | media type, size class, object reference, integrity fingerprint, access class, retention linkage | Raw Data Owner; SOURCE_EVIDENCE |
| Collector | capture를 수행한 human or isolated technical component identity | collector_type, principal reference, approved scope, policy version, capture context | Identity/Source Owner; no fact authority |
| Source Provenance | source에서 derived record까지의 lineage edge | source/target identifiers, transformation type, actor/job, input/output version, occurred time, confidence/notes | Data Steward; lineage evidence |
| Listing Source | Raw Source가 Candidate/Offer interpretation을 지지하는 scoped link | raw source, candidate/offer, claimed fields, observed status, source role | Listing Data Owner; evidence link only |

## Source Registry rules

- source는 active approval, allowed capture method, permitted purpose와 reviewer 없이 자동 intake 대상이 아니다.
- policy change는 기존 evidence를 소급해 사실로 만들거나 삭제하지 않으며 capture-time policy version을 보존한다.
- source identity, contributor identity와 content ownership/permission은 별도 의미다.
- `BLOCKED`, `PAUSED`, `UNDER_REVIEW`와 같은 policy state의 최종 vocabulary는 governance/security review 후 승인한다.

## Raw Source rules

- raw content는 immutable-by-default다. redaction/correction은 original reference, reason, actor와 revision을 남긴다.
- URL만 저장하는 경우 content가 변하거나 사라질 위험을 표시한다. copy를 저장하는 경우 source right, privacy와 retention을 검토한다.
- capture time과 source-published/reported time을 분리한다.
- malformed, unsafe 또는 policy-uncertain content는 quarantine/review state이며 Candidate 생성 권한을 자동 부여하지 않는다.
- one Raw Source may support several interpretations; one Offer may require several sources.

## Attachment rules

- attachment object는 private by default이며 application-mediated access만 허용한다.
- integrity fingerprint는 tamper/copy detection용이며 content authority나 uniqueness를 보장하지 않는다.
- malware/type/size validation result와 quarantine outcome을 reference한다.
- derived thumbnail/text extraction도 source attachment와 transformation provenance를 유지한다.

## Collector distinction

`Collector persona`는 human staff이고 technical `collector`는 isolated component다. 둘 모두 unique principal, source scope와 audit context를 가져야 하지만 technical collector에는 verification, permission 또는 publication approval authority를 부여하지 않는다.

## Provenance minimum

`source identity → capture event → raw evidence/version → transformation actor/job → derived entity/version → human correction/decision`

merge, split, normalization, duplicate resolution, AI parse, manual correction과 publication snapshot이 lineage를 끊지 않아야 한다.

## Retention

- 모든 Raw Source/Attachment는 retention policy/class와 `retention_until` 의미를 가진다.
- legal hold는 deletion을 일시 중지하지만 access scope를 확대하지 않는다.
- source deletion request는 Candidate/Offer의 factual value를 자동 삭제하지 않으며 derived personal data와 legal basis를 별도 평가한다.
- object, extracted text, search copy, AI input/output, export와 backup impact를 포함한다.

## Constraints and trace

- `DB-002`: provenance 없는 derived record는 external-use gate를 통과할 수 없다.
- `DB-005`: collector는 core validation을 우회할 수 없다.
- `DB-008`: raw evidence에는 privacy/retention classification이 필수다.
- related: [Source Registry module](../book-2/04_MODULE_ARCHITECTURE.md), [Data Principles](../book-0/04_DATA_PRINCIPLES.md).

> **OPEN DECISION:** raw copy와 reference-only 저장 기준, source별 retention period, integrity fingerprint standard와 legal/source-policy owner.

