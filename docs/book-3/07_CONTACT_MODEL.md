# Contact Model

| 항목 | 값 |
|---|---|
| Document ID | DOC-DATA-008 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Security/Privacy Reviewer |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Purpose

Contact와 Organization identity, communication evidence, verification과 disclosure permission을 property/offer content에서 분리해 최소 권한과 purpose limitation을 적용한다.

## Entities

| Entity | Purpose | Important logical attributes | Authority |
|---|---|---|---|
| Contact | 연락 가능한 개인 또는 조직 연락 주체 | display label, contact type, restricted channels, language/time preference, status, privacy class | Contact Data Owner; identity/contact authority only |
| Organization | brokerage, owner company, developer 등 조직 identity | legal/display names, organization type, status, authority evidence references | Organization Data Steward |
| Contact Channel | email/phone/messaging 등 purpose-scoped channel | channel type, normalized value, masking form, verification status/time, consent/use scope | Contact owner + verification evidence |
| Communication | 업무상 contact interaction reference | direction, purpose, occurred time, actor, outcome, external reference, retention class | Communication Owner; fact of interaction only |
| Contact Verification | channel/relation을 확인한 결과 | method, verifier, scope, time, expiry, evidence | authorized human/application policy; not listing verification |
| Contact Permission | 특정 purpose/channel/disclosure 허용 | subject, purpose, grantee/audience, effective period, evidence, revocation | authorized owner/approver; separate from publication permission |

## Relationship model

- Contact may affiliate with zero or more Organizations through time-bound role relationships.
- Contact may represent several Offers; each relation records role, effective period and source/evidence.
- one person with several channels remains one Contact only after justified identity resolution; similarity alone does not merge.
- Client may reference a Contact identity but client relationship and requirement history remain separate business entities.

## Verification distinction

Contact Channel Verification confirms reachability/control to an approved degree. Listing Verification confirms property/offer facts. Identity/authority verification confirms who may provide/approve information. These records may reference one another but are not interchangeable.

## Permission and disclosure

- storing a channel does not imply permission to disclose, export, prompt-share or publicly publish it.
- client-sharing, public-publication and internal contact-access permissions are independently scoped.
- revocation affects future use and triggers review of active derived/public representations.
- default presentation is masked; unmask/access/export is authorized and audited.

## Privacy classification

| Class | Example | Default handling |
|---|---|---|
| RESTRICTED_PERSONAL | direct personal channel, identity evidence | need-to-know, masked, access audited |
| CONFIDENTIAL_BUSINESS | organization role, internal notes | role-scoped, purpose-limited |
| INTERNAL | non-sensitive operational label/status | authenticated internal access |
| PUBLIC_APPROVED | explicitly approved published business channel | scope/expiry-bound publication only |

Final classification taxonomy requires Book 8 review; these labels are logical candidates.

## Communication data minimization

- full message content is not default; store purpose/outcome/reference when sufficient.
- raw message retained as Source evidence follows source right/privacy/retention policy.
- sensitive notes and credentials are prohibited.
- automated communication identity/impersonation is outside this model.

## Retention and deletion

Contact/Communication has purpose-specific retention. deletion impact includes Offers, Permissions, Audit references, search copies, AI input/output and exports. required history may retain a tombstone/pseudonymous reference rather than contact value, subject to legal/privacy review.

## Constraints

- Contact channel uniqueness is not globally assumed due shared/recycled channels.
- restricted contact search index is access-controlled and never a public discovery index.
- AI/connector cannot grant Contact Permission.
- `DB-012`: restricted contact access, unmask and export are auditable.

> **OPEN DECISION:** final privacy classes, identity-resolution rule, communication content retention and consent/legal-basis owner.

