# Screen Catalog

| 항목 | 값 |
|---|---|
| Document ID | DOC-UI-005 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Business Owner |
| 기준일 | 2026-07-14 |

## Purpose

Phase 8의 모든 logical screen을 식별한다. Screen ID는 영구 trace ID이며 layout, route 또는 component 수를 의미하지 않는다.

## Catalog

| Screen ID | Title | Purpose | Primary User | Workflow |
|---|---|---|---|---|
| UI-001 | Sign In | identity/session 시작과 실패 복구 | All users | WF-001–012 |
| UI-002 | Collector Dashboard | source/intake assigned work 요약 | Collector | WF-001/002 |
| UI-003 | Agent Dashboard | client-to-proposal work 요약 | Agent | WF-005–008/011 |
| UI-004 | Reviewer Dashboard | independent review/approval task 요약 | Reviewer | WF-003/004/007/009/011 |
| UI-005 | Manager Dashboard | team workload, quality, exception oversight | Manager | WF-001–012 |
| UI-006 | Administrator Dashboard | security/operations/governance task 요약 | Administrator | WF-001–012 |
| UI-007 | Future External Partner Dashboard | partner-scoped contribution/status | Future External Partner | POST-MVP; WF-001/002/007/009/010 |
| UI-008 | Global Search | authorized cross-domain discovery | Agent/Manager | WF-002/005/006 |
| UI-009 | Source Registry | source policy 조회와 proposal | Collector/Administrator | WF-001 |
| UI-010 | Discovery Queue | approved discovery candidate triage | Collector | WF-001 |
| UI-011 | Manual Intake | governed evidence/intake 작성 | Collector | WF-002 |
| UI-012 | Intake Review | validation finding과 candidate registration review | Senior Agent/Reviewer | WF-002 |
| UI-013 | AI Review Queue | advisory AI Result 검토/교정 | AI Reviewer | WF-003 |
| UI-014 | Candidate List | candidate/offer collection 조회 | Agent | WF-002/004/006/007 |
| UI-015 | Candidate Detail | candidate, offer, evidence와 lifecycle 조회 | Agent/Reviewer | WF-002–004/006/007 |
| UI-016 | Duplicate Review | duplicate suggestion human disposition | Reviewer | WF-004 |
| UI-017 | Property Master Search | canonical property hierarchy 탐색 | Agent/Data Steward | WF-002–004/006 |
| UI-018 | Property Detail | property identity, aliases, proposals 검토 | Data Steward | WF-002–004/006 |
| UI-019 | Contact List | purpose-scoped contact case 탐색 | Agent/Privacy Owner | WF-007/008/011 |
| UI-020 | Contact Detail and Case | masked contact, permitted channel, attempts | Agent/Verifier | WF-007/011 |
| UI-021 | Client List | assigned client 탐색 | Agent/Manager | WF-005/008 |
| UI-022 | Client Detail | client context, requirement, communication | Agent | WF-005/008 |
| UI-023 | Requirement Editor | versioned client requirement 작성/활성화 | Agent | WF-005 |
| UI-024 | Matching Workspace | match request/result와 shortlist review | Agent | WF-006 |
| UI-025 | Client Proposal | permission-scoped proposal review/share | Agent/Senior Agent | WF-008 |
| UI-026 | Verification Queue | assigned verification/permission work | Verifier/Permission Reviewer | WF-007/011 |
| UI-027 | Verification Detail | evidence-based verification decision | Verifier | WF-007/011 |
| UI-028 | Permission Review | purpose/scope/expiry permission decision | Permission Reviewer | WF-007–011 |
| UI-029 | Publication Approval Queue | pending representation approval 탐색 | Publication Approver | WF-009 |
| UI-030 | Publication Approval Detail | exact representation approve/reject | Publication Approver | WF-009 |
| UI-031 | Publication Operations | delivery/reconciliation/correction/withdrawal | Publication Owner | WF-010/011/012 |
| UI-032 | Expiration and Reverification | expiring authority와 renewal task 관리 | Agent/Verifier | WF-011 |
| UI-033 | Exception Recovery | exception containment/recovery/closure | Operations Owner | WF-012 |
| UI-034 | Background Jobs | job status, retry/cancel successor evidence | Operations Owner | WF-003/006/010–012 |
| UI-035 | Audit Explorer | scoped immutable evidence query/export | Security/Governance Owner | WF-001–012 |
| UI-036 | Role and Policy Administration | governed role/policy/source/target changes | Administrator | WF-001–012 |
| UI-037 | Notification Center | scoped task/alert/result feedback | All users | WF-001–012 |

## Coverage

WF-001–012는 각각 최소 두 개 screen에 mapping된다. canonical 상세 mapping은 [Screen Registry](15_SCREEN_REGISTRY.md), action contract는 [Screen Specifications](05_SCREEN_SPECIFICATIONS.md)를 따른다.

## Status

UI-001–006와 UI-008–037은 logical `DEFINED`다. UI-007은 `POST-MVP`이며 현재 product commitment가 아니다.

