# User Roles and Dashboards

| 항목 | 값 |
|---|---|
| Document ID | DOC-UI-004 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner / Security Reviewer |
| 기준일 | 2026-07-14 |

## Purpose

각 사용자 역할의 landing dashboard, primary work와 authority boundary를 정의한다. Role label은 persona를 설명할 뿐 실제 허용은 API-002의 resource/action/scope 평가 결과다.

## Dashboard contracts

| Screen | Role | Goals and primary content | Workflow | API | Prohibited implication |
|---|---|---|---|---|---|
| UI-002 | Collector | approved source, intake draft, validation failure와 assigned capture task | WF-001/002 | API-003/004/018 | candidate verification/publication 권한 없음 |
| UI-003 | Agent | client, active requirement, match, contact/proposal task | WF-005–008/011 | API-007–013 | Verification/Permission/publication approval 자동 권한 없음 |
| UI-004 | Reviewer | AI, duplicate, verification, permission, publication approval queue | WF-003/004/007/009/011 | API-006/011–013/016 | 한 review가 다른 approval을 대체하지 않음 |
| UI-005 | Manager | team workload, aging, exception, quality와 approval oversight | WF-001–012 | API-002/015/016 | dashboard metric에서 직접 상태 변경 금지 |
| UI-006 | Administrator | identity/role/policy/target/job/audit administration | WF-001–012 | API-001/002/015–019 | administration role만으로 business approver가 되지 않음 |
| UI-007 | Future External Partner | partner-scoped contribution와 status visibility | POST-MVP; WF-001/002/007/009/010 | API-001/002/004/011–014/018/019 | `POST-MVP`; membership, federation, contract 미승인 |

## Common dashboard sections

- `My tasks`: assignee, due/freshness, canonical status, blocker와 explicit open action.
- `Needs attention`: validation failure, stale authority, exception, reconciliation unknown.
- `Recent activity`: scoped Audit Event/Status History projection; write action 아님.
- `Metrics`: defined denominator, time window, last refresh와 drill-down capability.
- `Announcements`: policy/release notice; business notification과 구분.

## Permissions and separation of duties

Dashboard는 허용 action만 활성화하되 disabled reason을 설명한다. 동일 사용자가 여러 role을 가져도 approval contract의 separation-of-duties constraint를 API-002와 owning workflow가 재검사한다. Self-approval, expired assignment, stale version과 scope mismatch는 UI에서 차단하고 API rejection도 안전하게 표현한다.

## OPEN DECISION

**OPEN DECISION:** exact role-to-capability matrix, delegated approval rule와 separation-of-duties 조합은 Phase 9 Security Architecture에서 Security Owner와 Business Owner가 확정해야 한다. Phase 8은 필요한 capability와 금지 경계만 정의한다.

