# REL-002 Phase 2D-0G Authorization Boundary

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-342 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture / Security Owner |
| 기준 Main | `aff2b1a1377faba75b30e78faede913a130266ba` |

## 1. Principle

`Shared listener != shared business authority`다. HTTP parsing과 PORT lifecycle만 공유하며 trusted identity와 business authorization 판단은 각 existing API boundary에 남는다.

## 2. API boundaries

| 경계 | API-014 | API-015 |
|---|---|---|
| Session ingress | existing canonical Publication request/session path | existing `x-session-id` parsing과 Session resolver |
| Live authorization | Publication canonical host / current AuthorizationService | administration-backed current AuthorizationService |
| Role/scope/capability | existing Publication action policy | existing Administration RBAC, scope, MFA, SoD |
| Audit semantics | existing Publication audit/evidence path | existing Administration governed evidence path |
| Concealment/error | API-014 safe mapper | API-015 safe mapper |

Listener/router는 caller actor, tenant, scope, capability, MFA, decision 또는 audit outcome을 만들거나 캐시하지 않는다. `ProductionBootstrapContext`는 root construction proof이고 request authorization token이 아니다.

## 3. Cross-boundary prohibitions

- API-014 authorization result를 API-015 요청에 재사용하지 않는다.
- API-015 role assignment store를 API-014 router가 직접 읽지 않는다.
- shared middleware가 새 role/capability 또는 universal allow/deny authority가 되지 않는다.
- `/readyz`가 Session 또는 AuthorizationService를 호출하지 않는다.
- one API의 denial/error를 다른 API vocabulary로 변환하지 않는다.
- direct persistence access 또는 transport-owned audit event creation은 `0`이다.

## 4. Required verification

- revoked/expired Session은 기존 owner에서 계속 fail closed
- API-015 MFA/SoD bypass `0`
- cross-tenant/scope disclosure `0`
- API-014 request가 API-015 handler에 도달하는 경우 `0`, 반대도 동일
- same-listener 적용 전후 audit outcome과 concealment equivalence
- operational route에서 credential/PII/stack/path/SQL leakage `0`

## 5. 관련 문서

- [Route Ownership](REL002_PHASE2D0G_API014_API015_ROUTE_OWNERSHIP.md)
- [Decision Proposal](REL002_PHASE2D0G_DECISION_PROPOSAL.md)
