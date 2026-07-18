# Information Architecture

| 항목 | 값 |
|---|---|
| Document ID | DOC-UI-002 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner / Architecture Owner |
| 기준일 | 2026-07-14 |

## Purpose

사용자가 source evidence에서 publication evidence까지 현재 업무 위치, object identity, authority와 다음 허용 action을 이해하도록 information hierarchy를 정의한다.

## Domain structure

| Domain | Primary content | Workflow | Canonical entity | API |
|---|---|---|---|---|
| Home | assigned work, exceptions, freshness, approvals | WF-001–012 | User, Audit Event, System Error | API-001/002/016 |
| Sources & Intake | source policy, evidence, intake case | WF-001–003 | Source Registry, Raw Source, Intake | API-003/004/018 |
| Listings & Properties | candidate, offer, duplicate, property master | WF-002–004/006/007 | Candidate Listing, Listing Offer, Duplicate Group, Property | API-005/006 |
| Clients | client, requirement, communication | WF-005/008 | Client, Requirement, Communication | API-007–009 |
| Matching | evaluated result와 shortlist disposition | WF-006 | Match Result, Requirement | API-010 |
| Verification | contact evidence, Verification, Permission | WF-007/011 | Contact Case, Verification, Permission | API-007/011/012 |
| Publication | proposal, approval, delivery, reconciliation | WF-008–011 | Client Proposal, Publication Approval, Publication | API-013/014 |
| Operations | jobs, exceptions, audit, governed administration | WF-001–012 | AI Job, System Error, Audit Event, Role | API-015–019 |

## Feature grouping

Primary work는 `Discover and Intake`, `Understand Listings`, `Serve Clients`, `Verify Authority`, `Publish`, `Govern and Recover`로 묶는다. Dashboard와 notification은 이 기능을 복제하지 않고 owning screen으로 연결한다. AI는 독립 authority feature가 아니라 Intake, Property, Requirement, Matching과 Review 안의 advisory assistance로 배치한다.

## Screen hierarchy

`Role Dashboard → Domain Queue/List → Object Detail → Review/Decision Task → History/Evidence`를 기본 hierarchy로 사용한다. Search와 Notification Center는 어느 단계로든 진입할 수 있지만 authentication, authorization와 workflow prerequisite를 다시 검사한다.

## Navigation hierarchy

Global domain navigation 아래 role dashboard와 domain local navigation을 두고, object/detail/task는 breadcrumb와 return context로 연결한다. Navigation은 [Navigation Structure](02_NAVIGATION_STRUCTURE.md)의 authorization과 hidden-action prohibition을 따른다.

## Content hierarchy

1. **Workspace context:** authenticated principal, active role/team scope, environment와 notification count.
2. **Domain context:** queue/list title, filter, count, freshness와 governing workflow.
3. **Object context:** canonical ID, version, status, owner, evidence, permission classification.
4. **Decision context:** prerequisite, affected version, authority, rationale와 audit consequence.
5. **Action context:** visible allowed/disabled action, mapped API capability, confirmation과 result.

## User journeys

| Journey | Screen sequence | Governing workflow |
|---|---|---|
| Source to candidate | UI-002 → UI-009/010 → UI-011 → UI-012/013 → UI-015 | WF-001–003 |
| Candidate quality | UI-014/015 → UI-016/017/018 → UI-026/027 | WF-004/007 |
| Client need to shortlist | UI-003 → UI-021/022 → UI-023 → UI-024 | WF-005/006 |
| Shortlist to client share | UI-024 → UI-028 → UI-025 | WF-007/008 |
| Approved publication | UI-029/030 → UI-031 → UI-035 | WF-009/010 |
| Freshness and recovery | UI-032 → UI-033/034 → UI-035 | WF-011/012 |

Journey shortcut은 중간 workflow state를 생성하거나 건너뛰지 않는다.

## Object page contract

모든 detail screen은 summary, canonical status, evidence/provenance, history, related objects와 permitted actions를 분리한다. AI suggestion은 canonical field와 시각적으로 구분하고 `AI capability`, confidence, limitation, source input version과 review status를 노출한다. Restricted contact는 masked default와 purpose-scoped reveal evidence를 사용한다.

## Classification and disclosure

- role/team scope 밖 content는 navigation, count, search result와 notification에서 노출하지 않는다.
- existence 자체가 sensitive한 object는 unauthorized 사용자에게 존재 여부를 확인해 주지 않는다.
- publication-ready preview와 internal evidence view는 별도 representation이다.
- status label은 [Workflow Status Dictionary](../book-5/13_STATUS_DICTIONARY.md)의 canonical value와 설명을 함께 제공한다.

## Ownership and governance

Business Owner가 task grouping과 language를, domain owner가 content truth를, Security Reviewer가 disclosure를, Architecture Owner가 cross-domain consistency를 검토한다. 메뉴 구조 변경이 workflow/authority 의미를 바꾸면 CR과 Decision review가 필요하다.
