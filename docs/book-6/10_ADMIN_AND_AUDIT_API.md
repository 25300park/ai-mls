# Admin and Audit API

| 항목 | 값 |
|---|---|
| Document ID | DOC-API-011 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Security Reviewer |
| 기준일 | 2026-07-14 |
| API Capabilities | API-015, API-016 |

## Purpose

Role assignment, source/target/policy configuration 같은 governed administration과 append-oriented audit/history의 제한된 조회·export를 제공한다.

## Logical Endpoints

| Logical operation | Method/resource | Outcome |
|---|---|---|
| Read/Propose Role Assignment | `GET/POST /v{major}/role-assignments` | reviewed scoped assignment |
| Revoke Assignment | `POST /v{major}/role-assignments/{id}:revoke` | effective authority restriction |
| Propose Policy Change | `POST /v{major}/policy-change-requests` | versioned review item |
| Manage Source/Target Status | `POST /v{major}/sources/{id}:transition`, `.../publication-targets/{id}:transition` | governed policy state |
| Query Audit | `GET /v{major}/audit-events` | masked allowlisted evidence view |
| Read Status/Decision/Approval History | `GET /v{major}/history/{type}` | subject-scoped history |
| Request Audit Export | `POST /v{major}/audit-exports` | approved asynchronous export job |

## Request Model

Administrative write는 exact subject/version, proposed role/policy/scope/effective period, reason, change/approval reference와 expected version을 요구한다. Audit query/export는 purpose, case/reference, time/subject/action filters, requested field class, retention basis와 trace context를 포함한다.

## Response Model

Assignment/policy version/status, effective scope, review/approval evidence와 impact를 반환한다. Audit response는 immutable event ID, actor class, action, target, time, outcome/correlation과 permitted evidence references를 제공하며 secret/raw payload를 기본 제외한다.

Audit evidence lifecycle은 `AUDIT_EVENT.APPENDED`, `CORRECTED`, `ARCHIVED`, `DELETED_BY_POLICY`를 사용한다. Correction response는 original event link를, archive/disposition response는 policy/legal-hold/manifest evidence를 포함한다.

## Business Rules

Administrator는 superuser approval authority가 아니다. 자신에게 privilege를 부여하거나 audit를 변경/삭제할 수 없다. Policy/role change는 approval workflow와 separation of duties를 따른다. Audit correction은 append-only correction link이며 original event를 덮어쓰지 않는다.

## Authority

Security/Administration Owner가 role/policy proposal을 관리하고 required human approver가 활성화한다. Security/Governance Owner만 authorized audit query/export policy를 결정한다. Auditor access도 purpose/time/data-class로 제한된다.

## Validation

requester/approver separation, assignment scope/effective dates, prohibited role combinations, policy version/change evidence, audit purpose/case, filter allowlist, field masking, export size/retention과 legal hold를 검증한다.

## Audit

모든 administration read/write, allow/deny decision, audit query/export, export download/access, policy/role activation/revoke 및 attempted tampering을 별도 security audit로 기록한다.

## Error Conditions

`ADMIN_SCOPE_DENIED`, `SELF_ASSIGNMENT_PROHIBITED`, `ROLE_CONFLICT`, `POLICY_APPROVAL_REQUIRED`, `AUDIT_PURPOSE_REQUIRED`, `AUDIT_ACCESS_DENIED`, `EXPORT_REQUIRES_APPROVAL`, `LEGAL_HOLD_CONFLICT`, `VERSION_CONFLICT`.

## Related Workflow

`WF-001`–`012` cross-cutting; 특히 `WF-009` approval과 `WF-012` exception evidence를 지원한다.

## Related Entity

User, Role, Team, Source Registry, Publication Target, Audit Event, Decision History, Status History, Approval History, User Action, Retention Policy, Legal Hold.

## Related AI Capability

`N/A — deterministic governance/security control`; AI may not alter policy, role or audit evidence.
