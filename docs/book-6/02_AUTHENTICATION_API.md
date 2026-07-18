# Authentication API

| 항목 | 값 |
|---|---|
| Document ID | DOC-API-003 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Security Reviewer / Architecture Owner |
| 기준일 | 2026-07-14 |
| API Capabilities | API-001, API-002 |

## Purpose

human/service principal의 identity, session/token lifecycle와 scoped authorization context를 제공한다. 인증 성공은 business action 권한이나 approval authority를 의미하지 않는다.

## Logical Endpoints

| Logical operation | Method/resource | Outcome |
|---|---|---|
| Create Session | `POST /v{major}/sessions` | verified identity로 short-lived session 생성 |
| Refresh Session | `POST /v{major}/sessions/{id}:refresh` | rotation policy를 통과한 successor token/session |
| Revoke Session | `POST /v{major}/sessions/{id}:revoke` | 대상 session/token family 취소 |
| Read Current Principal | `GET /v{major}/me` | effective role/scope summary와 expiry |
| Evaluate Capability | `POST /v{major}/authorization-decisions` | action/resource context의 allow/deny 설명 |

## Request Model

Identity-provider evidence 또는 approved service credential reference, device/session context, requested scope와 trace IDs를 사용한다. raw credential, password 또는 token을 business API payload에 넣지 않는다. Refresh에는 rotation-bound proof, revoke에는 target과 reason, authorization evaluation에는 action/resource/version/scope가 필요하다.

## Response Model

principal ID/type, session ID, issued/expiry time, effective role/scope, token reference 또는 protected token delivery result를 반환한다. Authorization response는 `ALLOW`/`DENY`, evaluated policy version과 non-sensitive reason code를 반환하며 downstream business 상태를 변경하지 않는다.

## Roles, Permissions, Token lifecycle and Session policy

- Roles: Collector, Agent, Senior Agent, Manager, Administrator와 specialist/owner roles는 reusable policy assignment이며 endpoint access만으로 승인 권한을 얻지 않는다.
- Permissions: capability + action + resource + team/tenant + data class + time 범위의 least-privilege grant다.
- Token lifecycle: issue → use → rotate/refresh → expire/revoke. Refresh token replay는 family revocation과 audit를 유발한다.
- Session policy: short-lived access, bounded inactivity/absolute lifetime, risk-based reauthentication for approval/export/restricted contact, suspended/revoked user의 fail-closed invalidation.
- Service principal은 connector/job scope만 가지며 human approval capability를 받을 수 없다.

## Business Rules

Role name만으로 allow하지 않고 current assignment, subject scope, resource state와 separation-of-duty guard를 평가한다. Body의 `owner_id`, `approver_id`는 authenticated actor를 대체하지 않는다. Emergency access도 time-bound, reasoned, audited이며 constitutional gate를 우회하지 않는다.

## Authority

Security Owner가 identity/session policy를, Administration Owner가 승인된 role assignment를 관리한다. User Approver/Business Owner의 approval authority는 별도 workflow assignment가 있어야 한다. AI/provider/connector는 human role로 impersonate할 수 없다.

## Validation

credential issuer/audience/signature/expiry/revocation, principal status, assignment effective period, requested scope, session risk와 policy version을 검증한다. Exact authentication protocol/provider와 token format은 **OPEN DECISION**이다.

## Audit

login/refresh/revoke 성공·실패, policy decision, role/scope 변화, restricted reauthentication과 suspected replay를 actor/session/device class, request/correlation ID, policy version 및 outcome으로 기록한다. credential/token value는 기록하지 않는다.

## Error Conditions

`AUTHENTICATION_REQUIRED`, `INVALID_CREDENTIAL`, `SESSION_EXPIRED`, `SESSION_REVOKED`, `REAUTHENTICATION_REQUIRED`, `FORBIDDEN`, `SCOPE_DENIED`, `POLICY_UNAVAILABLE`, `RATE_LIMITED`.

## Related Workflow

`WF-001`–`012` cross-cutting. 모든 workflow action 전에 적용되지만 독립 business-state transition은 아니다.

## Related Entity

User, Role, Team, Verifier Assignment, User Action, Audit Event.

## Related AI Capability

`N/A — deterministic security control; AI may not authenticate, authorize or assign approval authority.`

