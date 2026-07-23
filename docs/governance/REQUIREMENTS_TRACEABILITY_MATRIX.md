# AI-MLS Platform Requirements Traceability Matrix (RTM)

| Field | Value |
|---|---|
| Version | 1.1 |
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

## SP-006 Implementation Evidence

| Requirement ID | Business Objective | Priority | Status | Epic | Feature IDs | API IDs | Workflow IDs | Domain Entities | AI Capability IDs | UI Screen IDs | Security Controls | Acceptance Criteria | Test Cases | Sprint | Commit Hash | Release Version | Related ADRs | Related MDRs | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| REQ-CONST-002/003/004/007/010/012/013 | human-controlled Verification Authority with immutable evidence and expiry | Approved SP-006 scope | IMPLEMENTED_ACCEPTED | EPIC-007 | FEAT-012 | API-011 | WF-007 verification; WF-011 expiry and re-verification | Verification, Verification Status, Verification Evidence, Verification History, Verification Expiry, Verification Result | AI-007 advisory closed-schema validation only | UI-026/027/032 verification states | SEC-001/002/004/007/008/010/011/013–015/021/025/028/030 | only `VER`/`MGR` decide; `REV` support only; evidence integrity; expiry and re-verification; safe errors; immutable audit | SP-006 domain, API, workflow, security, AI contract and regression tests | SP-006 | `3d8285f95fa7d12525cc3b5ac30f8f6b674f2998` | REL-002 | ADR-001/003/004/006–008 | None | AO-011 applied; Permission and Publication excluded |

## SP-007 Implementation Evidence

| Requirement ID | Business Objective | Priority | Status | Epic | Feature IDs | API IDs | Workflow IDs | Domain Entities | AI Capability IDs | UI Screen IDs | Security Controls | Acceptance Criteria | Test Cases | Sprint | Commit Hash | Release Version | Related ADRs | Related MDRs | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| REQ-CONST-002/003/004/007/010/012/013 | human-controlled Permission Authority with actor-level SoD and immutable history | Approved SP-007 scope | IMPLEMENTED_ACCEPTED | EPIC-007 | FEAT-013 | API-012 | WF-007 permission portion; WF-008 prerequisite; WF-011 revoke/expiry boundaries | Permission, Permission Status, Permission Decision, Permission Evidence, Approval History, Contact Channel | AI-007 advisory validation only | UI-026/028/032 permission states | SEC-001/002/004/007/008/010/011/013–015/021/025/028/030 | normal authority separated from Manager Override; override requires MGR capability, MFA, reason and immutable audit; same-verifier constraint; safe errors | SP-007 suite and AO-015 regressions covering override, MFA, reason, SoD, actor, timestamp and append-only history | SP-007 / SP-007A | `1cc81670e72e715a538efb0dd0d932ac15792556`; regression patch `828a83908a134d8027dccb50f19496157f78202e` | REL-002 | ADR-001/003/004/006–008 | None | Publication Approval and execution excluded |

## SP-008 Governance-Ready Planned Trace

이 항목은 구현 증거가 아니라 GOV-001에서 정규화한 계획 추적이다. SP-008 구현이나 완료를 주장하지 않는다.

| Requirement ID | Business Objective | Priority | Status | Epic | Feature IDs | API IDs | Workflow IDs | Domain Entities | AI Capability IDs | UI Screen IDs | Security Controls | Acceptance Criteria | Test Cases | Sprint | Commit Hash | Release Version | Related ADRs | Related MDRs | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| REQ-CONST-002/003/004/007/010/012/013 | exact-representation, target/channel-bound Publication Approval under human authority | Approved architecture scope | PLANNED_NOT_IMPLEMENTED | EPIC-008 | FEAT-014 | API-013 | WF-008 proposal context; WF-009 approval | Client Proposal, Publication Approval, Immutable Representation Snapshot, Approval History; Publication Target read-only dependency; Channel value object | N/A — AI/Service decision prohibited | UI-025/028–030 | SEC-001/002/004/007/008/010/011/013–015/021/025/028/030 | exact identity/version/checksum; target/channel/policy binding; actor-level SoD; MFA/reason where required; scheduler-only expiry; recovery/replay reauthorization; Effective Approval; no delivery | TEST-021/022; TEST-033 SP-008 approval/effective/safe-boundary partition and related regressions | SP-008 | PENDING — no implementation authorized by GOV-001 | REL-003 | ADR-001/003/004/006–008 | Open MDR decisions remain unresolved and do not grant decision authority | AO-018–AO-021; DEC-096–099; CR-021–024. Publication/API-014/WF-010–012 remain FEAT-015 |

## AO-018–AO-021 Decision Trace

| AO Decision | Decision Register | Change Register | Feature / API / Workflow | Security mapping | UI mapping | Test mapping | Canonical impact |
|---|---|---|---|---|---|---|---|
| AO-018 | DEC-096 | CR-021 | FEAT-014 / API-013 / WF-009 | SEC-013–015/021 | UI-029/030 | TEST-021/022/033 SP-008 partition | FEAT-014 owns Immutable Representation Snapshot; FEAT-015 owns Publication |
| AO-019 | DEC-097 | CR-022 | FEAT-014 reads FEAT-015 Publication Target | SEC-014/015/025 | UI-029/030 | TEST-022/033 SP-008 partition | exact Target, Channel and Policy Version binding |
| AO-020 | DEC-098 | CR-023 | FEAT-014 / API-013 / WF-009 | SEC-001/002/004/010/021 | UI-029/030 | TEST-021/022/033 SP-008 partition | Approval lifecycle only; API-014 execution excluded |
| AO-021 | DEC-099 | CR-024 | FEAT-014 / API-013 / WF-009 | SEC-001/002/004/007/008/010/011/021/025/028/030 | UI-029/030 | TEST-022 and security regressions | actor-level SoD, scheduler-only expiry, recovery/replay reauthorization, AI/Service prohibition |

## SP-008 Implementation Evidence

아래 행은 RTM v1.0의 구조와 승인 상태를 변경하지 않는 Sprint implementation evidence다.

| Requirement ID | Business Objective | Priority | Status | Epic | Feature IDs | API IDs | Workflow IDs | Domain Entities | AI Capability IDs | UI Screen IDs | Security Controls | Acceptance Criteria | Test Cases | Sprint | Commit Hash | Release Version | Related ADRs | Related MDRs | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| REQ-CONST-002/003/004/007/010/012/013 | exact, human-controlled Publication Approval with immutable representation and no execution effect | Approved SP-008 scope | COMPLETED_ACCEPTED_FROZEN | EPIC-008 | FEAT-014 | API-013 | WF-008 proposal context; WF-009 approval | Client Proposal, Publication Approval, Immutable Representation Snapshot, Approval History; Publication Target read-only dependency; Channel value object | N/A — AI/Service decision prohibited | UI-025/028–030; SP-008 implements UI-029/030 | SEC-001/002/004/007/008/010/011/013–15/021/025/028/030 | exact bindings, PUA-only human authority, actor-level SoD, MFA/reason, immutable audit/history, scheduler-only expiry, replay reauthorization, Effective Approval, safe no-delivery boundary | TEST-021/022; TEST-033 SP-008 partition; 30 new tests; full suite 168/168 | SP-008 | GOV-001 `c7ad5b0a2ad6bd243abe81cd3c00c3599a29ad1b`; SP-008 `0c9f2a519a3ea21d6f0de8d7b6e8c5a1ed64373a`; final evidence commit in Architecture Owner report | REL-003 | ADR-001/003/004/006–008; DEC-096–099 | None | Evidence: [SP-008 Test Evidence](../development/SP008_TEST_EVIDENCE.md), [SP-008 Completion](../reviews/SP-008_COMPLETION.md); all gates PASS; dependency vulnerabilities 0; FEAT-015/API-014/WF-010–012 remain deferred and unstarted |
