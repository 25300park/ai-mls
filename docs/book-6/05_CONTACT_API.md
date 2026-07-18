# Contact API

| 항목 | 값 |
|---|---|
| Document ID | DOC-API-006 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Privacy/Contact Owner / Security Reviewer |
| 기준일 | 2026-07-14 |
| API Capability | API-007 |

## Purpose

Contact, Organization, purpose-scoped Contact Channel과 Communication을 최소 공개·최소 권한으로 관리한다. Contact access는 listing verification/publication authority가 아니다.

## Logical Endpoints

| Logical operation | Method/resource | Outcome |
|---|---|---|
| Search Contacts | `GET /v{major}/contacts` | masked authorized results |
| Read Contact | `GET /v{major}/contacts/{id}` | purpose-scoped projection |
| Create/Correct Contact | `POST /v{major}/contacts`, `POST .../{id}/corrections` | versioned contact record |
| Manage Channel | `POST /v{major}/contacts/{id}/channels`, `POST .../{channel_id}:revoke` | scoped channel lifecycle |
| Record Contact Attempt | `POST /v{major}/contact-cases/{id}/attempts` | Communication/outcome evidence |
| Set Do-Not-Contact | `POST /v{major}/contact-cases/{id}:do-not-contact` | bounded prohibition state |

## Request Model

Purpose, subject relationship, privacy class, normalized channel value through protected handling, consent/use scope/evidence, expected version and trace context가 필요하다. Contact attempt는 permitted purpose/channel, time, outcome 및 minimal note/evidence reference를 포함한다.

## Response Model

기본 응답은 contact ID, display label, relationship, masked channels, permission/use indicators와 allowed actions만 반환한다. Unmasked value는 explicit purpose, elevated authorization 및 access audit가 있는 별도 projection이다.

## Business Rules

Contact data는 discoverability를 최소화하고 broad export를 금지한다. Channel verification은 listing Verification이 아니다. `DO_NOT_CONTACT`, expired/revoked consent와 purpose mismatch는 contact action을 차단한다. Communication 원문보다 reference/minimized summary를 우선한다.

## Authority

Agent는 assigned client/listing purpose 안에서 access/attempt, Privacy/Contact Owner는 merge/restriction/correction, Security Reviewer는 policy를 관리한다. Administrator role만으로 unmasked contact를 열람하지 못한다.

## Validation

purpose and assignment, field-level access, consent/use scope, channel status, DNC, retention/privacy class, duplicate contact handling, expected version와 request rate를 검증한다.

## Audit

검색, masked/unmasked read, export denial, create/correction/merge, channel access/revoke, communication attempt와 DNC change를 purpose, actor, target, disclosed field class 및 outcome으로 기록한다.

## Error Conditions

`CONTACT_NOT_FOUND`, `CONTACT_ACCESS_DENIED`, `PURPOSE_REQUIRED`, `CHANNEL_UNAVAILABLE`, `DO_NOT_CONTACT`, `CONSENT_SCOPE_DENIED`, `SENSITIVE_FIELD_RESTRICTED`, `VERSION_CONFLICT`, `RATE_LIMITED`.

## Related Workflow

`WF-007` Contact and Verification, `WF-008` Client Proposal, `WF-011` Reverification, `WF-012` Recovery.

## Related Entity

Contact, Organization, Contact Channel, Contact Case, Communication, Client, Permission, User Action, Audit Event.

## Related AI Capability

`N/A — contact authority/access is deterministic`; AI input minimization rules still apply where another capability references contact-derived evidence.
