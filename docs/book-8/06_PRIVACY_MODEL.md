# Privacy Model

| 항목 | 값 |
|---|---|
| Document ID | DOC-SEC-007 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Privacy Owner |
| 기준일 | 2026-07-14 |

## Privacy objectives

Personal data는 approved business purpose와 lawful/contractual basis 안에서 최소 수집·사용·공유·보존한다. Privacy decision은 Security control보다 약할 수 없고, source availability나 AI usefulness가 새로운 purpose를 만들지 않는다.

## Personal and sensitive data

| Category | Examples | Default class |
|---|---|---|
| Identity/contact | name, phone/email/message handle, account reference | RESTRICTED_PERSONAL |
| Client/requirement | budget, location, timing, preferences, communications | CONFIDENTIAL_BUSINESS 또는 RESTRICTED_PERSONAL |
| Source evidence | post/message/attachment with personal content | inherited; often RESTRICTED_PERSONAL |
| Sensitive security | credential reference, authentication, investigation, device/risk signal | RESTRICTED_SECURITY |
| Derived/AI | inferred contact/property/client attributes, confidence, embeddings/output | highest input class + purpose limit |

Sensitive data는 harm/risk가 높은 personal/security data를 뜻하며 exact statutory category는 `OPEN DECISION`이다. Unsupported sensitive inference는 생성하지 않는다.

## Consent and basis

Consent가 적용되는 use는 specific, informed, freely given where required, recorded, revocable와 purpose-linked evidence를 가져야 한다. Consent가 아닌 approved basis를 사용할 때도 owner, purpose, scope, notice, retention과 objection/deletion handling을 문서화한다. Source access permission, client-sharing Permission, public-publication Permission과 privacy consent는 서로 다른 evidence다.

## Purpose limitation

Every collection/read/reveal/export/AI use/publication은 purpose code와 compatible-use 판단을 가진다. New purpose, audience, provider 또는 integration은 재검토/필요한 consent·permission을 요구한다. Contact Case의 permitted channel/purpose를 다른 campaign이나 unrelated client에 재사용하지 않는다.

## Data minimization

필요한 field, precision, time range, sample, recipient와 retention만 사용한다. UI는 masking, API는 field filtering, AI는 redaction/pseudonymization과 provider-minimal payload, logs는 identifiers/tokenized reference를 우선한다.

## Data subject/request workflow

Access/correction/deletion/restriction/objection request는 identity proofing, scope discovery, exception/legal hold review, owner decision, execution evidence와 response audit를 가진다. Exact legal rights, deadlines와 jurisdiction은 legal review 전 `OPEN DECISION`이다.

## Right to deletion and disposition

Deletion은 direct hard delete 권한이 아니라 approved Retention Policy/Privacy request에 따른 locate → hold check → restrict → dispose/anonymize/tombstone → verify → audit sequence다. Provenance/audit/legal obligations을 임의 제거하지 않고 minimum retained evidence와 use restriction을 기록한다.

## Legal hold

Legal Hold는 normal deletion을 제한하지만 새로운 use/access/publication permission을 만들지 않는다. Named Legal/Privacy Owner, scope, reason, effective/review/release time와 audit가 필요하다. Hold release 후 applicable disposition을 재개한다.

## Privacy in AI and integration

AI/connector에는 classification, purpose, approved provider/contract, minimization, retention, training-use prohibition/decision, cross-boundary flow와 deletion capability를 검토한다. AI Result는 personal inference를 authority로 만들지 않으며 human review에도 minimum disclosure를 적용한다.

