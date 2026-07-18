# Publication API

| 항목 | 값 |
|---|---|
| Document ID | DOC-API-010 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Publication Owner / Business Owner |
| 기준일 | 2026-07-14 |
| API Capabilities | API-013, API-014 |

## Purpose

Client Proposal과 public Publication의 표현 버전, human approval, delivery, reconciliation, correction, suspend/withdraw/republish를 분리된 계약으로 관리한다.

## Logical Endpoints

| Logical operation | Method/resource | Outcome |
|---|---|---|
| Create/Review Proposal | `POST /v{major}/proposals`, `POST .../{id}:review` | draft/share approval |
| Record Proposal Share/Feedback | `POST .../{id}:share`, `POST .../{id}/feedback` | audience-scoped evidence |
| Create Publication Representation | `POST /v{major}/publications` | `DRAFT_REPRESENTATION` |
| Request/Decide Approval | `POST .../{id}:request-approval`, `POST /v{major}/publication-approvals/{id}:decide` | exact-version human decision |
| Request Delivery | `POST /v{major}/publications/{id}:deliver` | `DELIVERY_PENDING` job |
| Reconcile | `POST /v{major}/publications/{id}:reconcile` | evidence-backed external state |
| Correct/Suspend/Withdraw | `POST .../{id}:correct|suspend|withdraw` | governed compensating workflow |
| Request Republish | `POST .../{id}:republish` | new representation/approval cycle |

## Request Model

Proposal은 accepted match, exact candidate/offer version, valid Verification, `CLIENT_SHARING` Permission, audience와 representation checksum을 요구한다. Publication은 target, exact representation/subject versions, valid Verification, `PUBLIC_PUBLICATION` Permission, approval evidence, allowed fields, expected version, idempotency와 trace context를 요구한다.

## Response Model

Proposal/Publication/Approval IDs, canonical version/status, eligibility checks, approval scope/expiry, operation/job ID, target, representation checksum, external reference와 reconciliation evidence summary를 반환한다. Delivery acceptance는 `PUBLISHED`를 뜻하지 않는다.

Publication response status는 `PUBLICATION.DRAFT_REPRESENTATION`, `PUBLICATION.APPROVAL_PENDING`, `PUBLICATION.APPROVED`, `PUBLICATION.DELIVERY_PENDING`, `PUBLICATION.PUBLISHED`, `PUBLICATION.UNKNOWN`, `PUBLICATION.FAILED`, `PUBLICATION.SUSPENDED`, `PUBLICATION.CORRECTION_PENDING`, `PUBLICATION.WITHDRAWAL_PENDING`, `PUBLICATION.WITHDRAWN` 중 하나다. Proposal과 Publication Approval은 각각 `PROPOSAL.*`, `PUBLICATION_APPROVAL.*` namespace를 사용하며 publication status와 혼합하지 않는다.

## Business Rules

Client sharing과 public publication은 별도 Permission/Approval이다. Requester/AI/connector는 자신의 publication approval을 만들지 못한다. Exact representation이나 prerequisite 변경 시 approval을 재사용하지 않는다. `UNKNOWN`은 fail closed하며 provider evidence 전에는 `PUBLISHED`로 전이하지 않는다. Republish는 새 full gate를 거친다.

## Authority

Agent/Senior Agent가 proposal, independent Publication Approver가 exact version 승인, scoped operator/connector가 delivery, authorized reconciler가 external evidence disposition을 수행한다. Withdrawal/correction은 Business Owner 승인 범위를 따른다.

## Validation

current state/version, verification/permission validity and scope, target policy, representation checksum/allowed fields, privacy/contact masking, approver independence, approval expiry, idempotency와 external evidence를 검사한다.

## Audit

representation creation/change, all checks, approval request/decision/revoke, proposal audience/share/feedback, delivery payload checksum, provider response/callback, reconcile, correction/suspend/withdraw/republish lineage를 기록한다.

## Error Conditions

`VERIFICATION_REQUIRED`, `PERMISSION_REQUIRED`, `APPROVAL_REQUIRED`, `APPROVAL_EXPIRED`, `REPRESENTATION_CHANGED`, `TARGET_NOT_ALLOWED`, `PUBLICATION_NOT_ELIGIBLE`, `PUBLICATION_UNKNOWN`, `DELIVERY_FAILED`, `RECONCILIATION_REQUIRED`, `WITHDRAWAL_FAILED`.

## Related Workflow

`WF-008` Client Proposal, `WF-009` Publication Approval, `WF-010` Publication, `WF-011` Expiration, `WF-012` Recovery.

## Related Entity

Match Result, Client Proposal, Verification, Permission, Publication Approval, Publication Target, Publication, Approval History, Status History, Audit Event, System Error.

## Related AI Capability

`N/A — publication authority is human/deterministic`; AI-derived content must retain its source/result trace and pass all gates.
