# AI-MLS Platform Requirements Traceability Matrix (RTM)

| Field | Value |
|---|---|
| Version | 1.0 |
| Status | Approved |
| Document Lifecycle | APPROVED |
| Effective From | Before SP-004 |

## Purpose

The Requirements Traceability Matrix ensures that every business requirement can be traced through design, implementation, testing, and release.

Every implementation artifact must be traceable back to an approved business requirement. No Feature, API, Workflow, AI capability, UI component, or Sprint implementation may exist without an approved requirement.

## Traceability Chain

```text
Business Requirement
→ Epic
→ Feature ID
→ API ID(s)
→ Workflow ID(s)
→ Domain Entity
→ AI Capability ID(s) (if applicable)
→ UI Screen ID(s) (if applicable)
→ Security Control(s)
→ Test Case(s)
→ Sprint
→ Commit
→ Release
```

Missing links are not permitted.

## RTM Record Structure

Each requirement record shall contain:

- Requirement ID
- Business Objective
- Priority
- Status
- Epic
- Feature IDs
- API IDs
- Workflow IDs
- Domain Entities
- AI Capability IDs
- UI Screen IDs
- Security Controls
- Acceptance Criteria
- Test Cases
- Sprint
- Commit Hash
- Release Version
- Related ADRs
- Related MDRs
- Notes

## Traceability Rules

- Every Feature shall reference at least one Requirement.
- Every API shall reference at least one Feature.
- Every Workflow shall reference at least one Feature.
- Every AI capability shall reference an approved business purpose.
- Every Test shall verify one or more acceptance criteria.
- Every Sprint completion report shall update the RTM.

## Change Control

If a Requirement changes:

- affected Features shall be identified;
- affected APIs shall be identified;
- affected Workflows shall be identified;
- affected AI capabilities shall be identified;
- affected UI screens shall be identified;
- affected tests shall be identified;

No implementation may proceed until traceability has been updated.

## Exit Rule

A Sprint cannot be accepted unless all newly introduced artifacts are fully represented in the RTM.

## SP-004 Implementation Evidence

이 절은 `AO-003`에 따라 추가된 Sprint implementation evidence이며 RTM v1.0의 구조, 규칙 또는 승인 상태를 변경하지 않는다. Git commit은 자신의 최종 hash를 동일 commit content에 포함할 수 없으므로 exact completion hash는 Architecture Owner 제출 보고서에서 고정한다.

| Requirement ID | Business Objective | Priority | Status | Epic | Feature IDs | API IDs | Workflow IDs | Domain Entities | AI Capability IDs | UI Screen IDs | Security Controls | Acceptance Criteria | Test Cases | Sprint | Commit Hash | Release Version | Related ADRs | Related MDRs | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| REQ-CONST-007/010/013 | auditable, non-escalating, permission-distinct Contact lifecycle | Approved SP-004 scope | IMPLEMENTED_AWAITING_ACCEPTANCE | EPIC-005 | FEAT-008 | API-007 | contact portion of WF-007; contact expiry portion of WF-011; WF-008 context only | Contact, Contact Channel, Contact Case, Communication | N/A — deterministic privacy authority | UI-019/020 contract states only | SEC-001/002/007/008/010/012–015/018/021/023 | masked default, purpose reveal, DNC, immutable evidence, safe errors | TEST-020 contact subset, TEST-029, TEST-048 | SP-004 | SP-004 completion commit; exact hash in Architecture Owner submission | REL-001 | ADR-001/003/007/008 | None | AO-001 applied; Verification/Permission excluded |
| REQ-CONST-001/002/007/010 | scoped Client relationship with human authority | Approved SP-004 scope | IMPLEMENTED_AWAITING_ACCEPTANCE | EPIC-005 | FEAT-009 | API-008 | WF-005; WF-008 context only | Client, Contact, Communication, Requirement | AI-004/006/007 through Requirement context | UI-021/022 contract states only | SEC-001/002/010/013–015/021/023/031 | assigned-agent/team scope, Contact reference, consent reference, safe audit | TEST-018, TEST-030, TEST-048 | SP-004 | SP-004 completion commit; exact hash in Architecture Owner submission | REL-001 | ADR-001/003–008 | None | No Contact channel duplication and no proposal sharing |
| REQ-CONST-001/002/007/008 | versioned human-activated Requirement with advisory AI | Approved SP-004 scope | IMPLEMENTED_AWAITING_ACCEPTANCE | EPIC-005 | FEAT-010 | API-009 | WF-005; Requirement boundary of WF-006; WF-008 context only | Requirement, Requirement History, Budget, Location Preference, Matching Preference | AI-004/006/007 | UI-021–023 contract states; UI-024 not implemented | SEC-001/002/010/013–015/021/023/031 | DRAFT, immutable revisions/history, human activation, readiness, stale signal, closed-schema AI validation | TEST-018, TEST-030, TEST-042, TEST-044, TEST-045 | SP-004 | SP-004 completion commit; exact hash in Architecture Owner submission | REL-001 | ADR-001/003–008 | None | AO-002 applied; API-010 and Matching execution excluded |

## SP-005 Implementation Evidence

아래 행은 RTM v1.0의 구조, 규칙 또는 승인 상태를 변경하지 않는 Sprint implementation evidence다. exact completion hash는 commit self-reference 제약 때문에 Architecture Owner 제출 보고서에서 고정한다.

| Requirement ID | Business Objective | Priority | Status | Epic | Feature IDs | API IDs | Workflow IDs | Domain Entities | AI Capability IDs | UI Screen IDs | Security Controls | Acceptance Criteria | Test Cases | Sprint | Commit Hash | Release Version | Related ADRs | Related MDRs | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| REQ-CONST-001/002/008/011 | deterministic advisory matching with human shortlist authority | Approved SP-005 scope | IMPLEMENTED_AWAITING_ACCEPTANCE | EPIC-006 | FEAT-011 | API-010 | WF-006; WF-005/011/012 context only; WF-008 downstream only | Match Result, Requirement, Candidate Listing, Listing Offer, Matching Preference | AI-005/006/007 advisory validation only | UI-024; UI-025 behavior excluded | SEC-001/002/007/010/013–15/021–23/031 | hard eligibility, approved weights/tie, cohort 100, top 20, exact revisions, human review, stale immutable history | TEST-019/031/043–045 | SP-005 | SP-005 completion commit; exact hash in Architecture Owner submission | REL-001 | ADR-001/003–008 | None | AI has no ranking/state authority; no Proposal/Verification/Permission |
| REQ-CONST-002/007/010–013 | accessible role-aware matching review without authority escalation | Approved SP-005 scope | IMPLEMENTED_AWAITING_ACCEPTANCE | EPIC-010 | FEAT-021 subset | API-010 with API-002/005/006/009/016/017 reuse | WF-006 only | User Action, Audit Event, Match Result | AI-005–007 displayed as advisory provenance | UI-024 only | SEC-001/002/007/010/013–15/021–23/031 | session Actor, role-visible actions, server authorization, ready/empty/stale states, keyboard/live-region contract, Contact privacy | TEST-038/054/055 plus regression | SP-005 | SP-005 completion commit; exact hash in Architecture Owner submission | REL-001 | ADR-001/003–008 | None | Application-wide accessibility program and UI-025+ excluded |
