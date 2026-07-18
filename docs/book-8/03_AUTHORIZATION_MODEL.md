# Authorization Model

| 항목 | 값 |
|---|---|
| Document ID | DOC-SEC-004 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Security Owner / Business Owner |
| 기준일 | 2026-07-14 |

## Decision model

Authorization decision은 `principal + role + team/organization + action + resource/type + field + purpose + assignment + current state/version + time/risk`를 입력으로 한다. 결과는 allow/deny, applied policy/version, obligations(mask, MFA, reason, approval), expiry와 trace reference를 반환한다. UI visibility는 보조이며 API-002와 domain API가 authoritative enforcement를 수행한다.

## Current scoped RBAC

현재 baseline은 role capability를 team/record/assignment/purpose scope와 결합한 scoped RBAC다. Canonical role과 operation grant는 [Permission Matrix](04_PERMISSION_MATRIX.md)를 따른다. Role inheritance는 권한 합집합이 아니라 명시된 capability set이며 conflict 시 더 제한적인 deny/SoD rule이 우선한다.

## Role hierarchy

| Relationship | Rule |
|---|---|
| Agent → Senior Agent | senior task/approval scope만 추가; Verification/Permission/Publication approval 자동 상속 금지 |
| Reviewer umbrella | AI/Duplicate/Verifier/Permission/Publication reviewer는 서로 다른 role assignment |
| Manager | oversight/read/escalation; team member action 또는 approval 자동 상속 금지 |
| Administrator | identity/policy administration; business verification/approval/publish 자동 권한 없음 |
| Security/Auditor | audit/security evidence read; operational mutation 최소화 |
| Service | API/job scope only; human UI/approval 없음 |

## Future ABAC

`POST-MVP`: organization membership, contract, data class, purpose, geography, device/risk와 time attributes를 추가할 수 있다. ABAC가 scoped RBAC, workflow prerequisite, explicit human approval 또는 deny를 완화할 수 없다. Attribute source, freshness, fail-closed와 explainability가 승인되어야 한다.

## Authority separation

Authentication, authorization, workflow ownership, AI review, duplicate disposition, Verification, Permission, proposal approval, publication approval, delivery/reconciliation와 administration은 별도 authority다. Role stacking 시에도 self-approval, same-subject conflict, expired assignment와 creator-approver conflict를 평가한다.

## Approval separation

- AI/service/connector는 approve/verify/publish authority가 없다.
- Publication Approver는 exact representation/version을 검토하며 delivery/reconciliation과 분리한다.
- Permission Reviewer는 purpose/audience/field/expiry를 결정하며 Verification을 대체하지 않는다.
- Emergency access도 approval을 생성하지 않으며 time-bound break-glass와 post-review가 필요하다.

## Deny and exception

Missing/stale/ambiguous identity, scope, policy, classification, purpose, assignment, state 또는 approval은 deny다. Break-glass는 Security Owner + affected Business Owner의 bounded approval, strong reauthentication, reason, monitoring, automatic expiry와 retrospective review를 요구하며 publication approval bypass에는 사용할 수 없다.

## Access review

Privileged role, service identity, dormant account, external partner와 exceptional grant를 정기 recertify한다. Exact frequency는 `OPEN DECISION`; joiner/mover/leaver, incident와 role/policy change 시 event-driven review는 필수다.

