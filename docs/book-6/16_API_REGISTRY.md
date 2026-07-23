# API Registry

| 항목 | 값 |
|---|---|
| Document ID | DOC-API-017 |
| 문서 버전 | v1.1 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Development Reviewer |
| 기준일 | 2026-07-14 |

> Phase 15 synchronization: `API-001–019`의 end-to-end coverage는 [Canonical Traceability Matrix](../00_CANONICAL_TRACEABILITY_MATRIX.md)를 따른다. Registry row의 logical contract/status는 변경하지 않았다.

## Purpose

Phase 7 API capability ID, owning document, logical operations, workflow/entity/AI mapping과 authority class의 canonical source of truth다. API ID는 route/version 변경에도 유지되며 본질적 replacement만 새 ID를 사용한다.

## Logical Endpoints

아래 registry의 `Logical endpoints/operations` 열이 각 capability의 logical endpoint family다. Exact route는 owning document에 있으며 이 표의 operation name과 ID가 cross-document mapping 기준이다.

## API capability registry

| API ID | Capability | Owner document | Logical endpoints/operations | Workflow | Related Entity | Related AI Capability | Authority |
|---|---|---|---|---|---|---|---|
| API-001 | Authentication and session | DOC-API-003 | Create/refresh/revoke session; read principal | WF-001, WF-002, WF-003, WF-004, WF-005, WF-006, WF-007, WF-008, WF-009, WF-010, WF-011, WF-012 | User, Role, Team, User Action | N/A deterministic security | Security Owner |
| API-002 | Authorization decision | DOC-API-003 | Evaluate action/resource capability | WF-001, WF-002, WF-003, WF-004, WF-005, WF-006, WF-007, WF-008, WF-009, WF-010, WF-011, WF-012 | Role, Team, Verifier Assignment, User Action | N/A deterministic security | Security Owner |
| API-003 | Source registry | DOC-API-004 | Read/propose source policy | WF-001 | Source Registry, Collector | N/A | Source Policy Owner |
| API-004 | Manual/source intake | DOC-API-004 | Create/validate/review intake; request AI | WF-001, WF-002, WF-003 | Intake, Raw Source, Raw Attachment, Source Provenance, Candidate Listing, AI Job | AI-001, AI-002, AI-007 | Collector/Reviewer scoped |
| API-005 | Property master access | DOC-API-005 | Search/read hierarchy; propose correction | WF-002, WF-003, WF-004, WF-006 | Location, Property, Building, Tower, Floor, Unit, Property Alias | AI-002, AI-006 | Property Data Steward |
| API-006 | Candidate, offer and duplicate | DOC-API-005 | Candidate/offer revision; duplicate review/decision | WF-002, WF-003, WF-004, WF-006, WF-007 | Candidate Listing, Listing Offer, Duplicate Group, Availability | AI-001, AI-002, AI-003, AI-007 | Listing Owner/Human reviewer |
| API-007 | Contact and communication | DOC-API-006 | Scoped contact/channel access; record attempt | WF-007, WF-008, WF-011 | Contact, Contact Channel, Contact Case, Communication, Organization | N/A | Contact/Privacy Owner |
| API-008 | Client relationship | DOC-API-007 | Create/read client | WF-005, WF-008 | Client, Contact, Communication | N/A | Business Owner/Assigned Agent |
| API-009 | Requirement lifecycle | DOC-API-007 | Draft/revise/transition/history/AI parse | WF-005, WF-006, WF-008 | Requirement, Budget, Location Preference, Matching Preference, Requirement History | AI-004, AI-006, AI-007 | Assigned Agent/Human reviewer |
| API-010 | Matching | DOC-API-008 | Request/read/review/stale match | WF-006, WF-008, WF-011 | Match Result, Requirement, Candidate Listing, Listing Offer | AI-005, AI-006, AI-007 | Agent/Human reviewer |
| API-011 | Verification | DOC-API-009 | Request/assign/decide/reverify | WF-007, WF-011 | Verification, Verifier Assignment, Availability, Reverification Request | AI-007 support only | Authorized human verifier |
| API-012 | Permission | DOC-API-009 | Request/decide/revoke permission | WF-007, WF-008, WF-009, WF-010, WF-011 | Permission, Verification, Approval History | N/A human authority | Permission Reviewer |
| API-013 | Proposal and publication approval | DOC-API-010 | Proposal create/read/review/share/feedback; ReadApproval; ListApprovalQueue; GetApprovalReviewContext; CheckEffectiveApproval; CreateApprovalRequest; AssignOrClaimApprover; ReassignOrReleaseApprover; DecideApproval; RevokeApproval; ExpireApproval | WF-008, WF-009 | Match Result, Client Proposal, Verification, Permission, Publication Approval, Immutable Representation Snapshot, Approval History; Publication Target read-only dependency | N/A human authority | Senior Agent by proposal scope / independent Publication Approver (`PUA`) |
| API-014 | Publication delivery and reconciliation | DOC-API-010 | Deliver/reconcile/correct/suspend/withdraw/republish | WF-010, WF-011, WF-012 | Publication Target, Publication, Published Listing Projection, Status History, System Error | N/A deterministic/external evidence | Publication Owner/Reconciler |
| API-015 | Administration | DOC-API-011 | Role/policy/source/target governed changes | WF-001, WF-002, WF-003, WF-004, WF-005, WF-006, WF-007, WF-008, WF-009, WF-010, WF-011, WF-012 | User, Role, Team, Source Registry, Publication Target, Retention Policy | N/A | Administration/Security Owner |
| API-016 | Audit and history | DOC-API-011 | Query/export audit and history | WF-001, WF-002, WF-003, WF-004, WF-005, WF-006, WF-007, WF-008, WF-009, WF-010, WF-011, WF-012 | Audit Event, Decision History, Status History, Approval History, User Action | N/A | Security/Governance Owner |
| API-017 | Background jobs | DOC-API-012 | Submit/read/cancel/successor/result | WF-003, WF-006, WF-010, WF-011, WF-012 | AI Job, AI Result, Reverification Request, Publication, Retention Job, System Error | AI-001, AI-002, AI-003, AI-004, AI-005, AI-006, AI-007 when AI job | Domain/Operations Owner |
| API-018 | Connector boundary | DOC-API-013 | Register/submit/checkpoint/delivery report/health | WF-001, WF-002, WF-003, WF-004, WF-009, WF-010, WF-011, WF-012 | Collector, Source Registry, Raw Source, Publication Target, Publication, System Error | AI-001, AI-002, AI-003, AI-007 after intake | Integration Owner; no business approval |
| API-019 | External integration lifecycle | DOC-API-014 | Contract/map/reconcile/suspend integration | WF-001, WF-002, WF-003, WF-004, WF-005, WF-006, WF-007, WF-008, WF-009, WF-010, WF-011, WF-012 | Source Registry, Source Provenance, Client, AI Job, AI Result, Publication, System Error | AI-001, AI-002, AI-003, AI-004, AI-005, AI-006, AI-007 for AI Provider | Integration + affected domain owners |

## Request Model

### GOV-001 API-013 ownership boundary

API-013의 Publication Approval contract는 exact representation identity/version/checksum, one target, one target-scoped channel, target/channel policy versions, language/audience/field scope, valid Verification, active `PUBLIC_PUBLICATION` Permission, expected version, actor/session, idempotency와 trace context를 입력으로 사용한다.

- read operations는 scoped Approval/queue/review context와 current effective result를 반환한다.
- mutations는 `Publication Approval` lifecycle만 변경하고 append-only Approval History/Audit Event를 만든다.
- `DecideApproval`은 closed disposition `APPROVED` 또는 `REJECTED`를 사용한다.
- `ExpireApproval`은 scheduler-only deterministic restriction이다.
- `CheckEffectiveApproval`은 downstream prerequisite이며 delivery success를 뜻하지 않는다.
- API-013은 Publication lifecycle, connector invocation, delivery, reconciliation, correction, suspension, withdrawal 또는 republish를 소유하거나 실행하지 않는다. 해당 operation은 API-014 소유다.

각 API는 owning document의 domain request와 [API Principles](01_API_PRINCIPLES.md)의 identity/trace/concurrency/idempotency context를 결합한다. Registry 자체 write API는 Phase 7에서 정의하지 않으며 변경은 CR/Decision/document review로 관리한다.

## Response Model

각 capability는 canonical ID/version/status와 trace IDs를 반환한다. Registry는 문서상 capability mapping을 제공하며 runtime discovery response는 future implementation decision이다.

## Business Rules

한 endpoint가 여러 API capability를 조합해도 각 workflow guard/authority/audit를 모두 적용한다. `N/A` AI mapping은 deterministic control 이유를 뜻하며 누락이 아니다. API ID는 Document ID, workflow ID나 entity ID를 대체하지 않는다.

AI-006의 `INTERNAL_CANDIDATE`, `CLIENT_ELIGIBLE`, `PUBLISHED` requested-result labels는 query intent classes이며 business status가 아니다. API-005/010은 각각 canonical Candidate authority, derived `CLIENT_SHAREABLE` eligibility 또는 `PUBLICATION.PUBLISHED`를 현재 state에서 재검사한다.

## Authority

Architecture Owner가 ID uniqueness/navigation을, domain owner가 contract semantics를, Security/Business/Data/AI reviewer가 해당 boundary를 검토한다. 승인되지 않은 runtime endpoint는 registry 행만으로 허가되지 않는다.

## Validation

모든 API ID uniqueness, owner document 존재, logical operation coverage, workflow/entity/AI mapping, justified N/A, authority consistency와 reciprocal link를 검사한다.

## Audit

Registry 변경은 CR, Decision/ADR 필요성, affected capabilities/consumers, reviewer, version과 approval evidence로 추적한다. Runtime audit는 owning domain contract가 담당한다.

## Error Conditions

Registry/document validation errors: `API_ID_DUPLICATE`, `API_OWNER_MISSING`, `WORKFLOW_MAPPING_MISSING`, `ENTITY_MAPPING_MISSING`, `AI_MAPPING_UNJUSTIFIED`, `AUTHORITY_MAPPING_CONFLICT`.

## Related Workflow

`WF-001`–`012` 모두 최소 하나의 API capability에 연결됨.

## Related Entity

Book 3 Data Dictionary의 모든 exposed/cross-cutting entity. Physical schema는 범위 밖이다.

## Related AI Capability

`AI-001`–`007` 모두 API-004/005/006/009/010/011/017/018/019 중 적용 가능한 capability에 연결됨.
