# REL-001 Phase 4D.1 Outbound Data Projection Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-205 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Data Owner / Security Owner / Capability Owner |
| 기준일 | 2026-09-15 |

## Default-deny rule

현재 승인된 provider-bound business-data field allowlist는 `0/3`이다. Listed-and-approved가 아닌 모든 field는 `DENIED`다. Existing `AdvisoryAdapterIntent` reference/fingerprint metadata는 내부 binding evidence이며, 이를 raw external request payload로 간주하거나 원본 DB row를 조회하는 권한을 부여하지 않는다.

| Capability | Canonical source | Permitted outbound fields | Purpose | Classification | Required/optional | Retention implication | Result |
|---|---|---|---|---|---|---|---|
| `AI-001` | immutable Listing snapshot/projection | none approved | listing parsing advisory | owner decision required | not applicable | provider terms required | `CONTRACT_REQUIRED` |
| `AI-004` | immutable Requirement snapshot/projection | none approved | requirement parsing advisory | owner decision required | not applicable | provider terms required | `CONTRACT_REQUIRED` |
| `AI-005` | immutable Requirement/Candidate/Offer cohort projection | none approved | matching advisory | owner decision required | not applicable | provider terms required | `CONTRACT_REQUIRED` |

## Prohibited content

- raw Job, Session, credential, authorization header or secret;
- unrestricted database row or generic repository access;
- unrelated tenant/scope data;
- undeclared personal/contact data or unnecessary PII;
- raw audit/evidence bodies, provider payloads or chain-of-thought.

Personal/contact/property/confidential-business fields may be added only through explicit field-level owner approval recording source, purpose, classification, necessity, provider handling, retention and deletion/control. Technical feasibility is not legal/privacy approval.

## Required owner closure

Data/Security/Capability owners must approve exact immutable input projection types and field rows for all three capabilities. Until then provider request construction and external calls remain `0`.
