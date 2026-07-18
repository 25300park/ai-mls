# Phase 7.5 — Decision Summary

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-013 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Business Owner |
| 기준일 | 2026-07-14 |

## Purpose

Consistency correction이 어떤 기존 decision을 적용했는지, 새 architecture decision이 있었는지와 remaining review disposition을 요약한다.

## Decision outcome

**새 architecture 또는 business decision을 만들지 않았다.** 모든 correction은 아래 existing requirement/decision의 표현·mapping 누락을 해소했다. 따라서 새 DEC/ADR은 발급하지 않고 CR-010 consistency implementation으로 추적한다.

## Existing decisions applied

| Decision/requirement | Applied consistency outcome |
|---|---|
| REQ-CONST-001/008, DEC-024/028/030 | AI-001–007 advisory, schema/validation/human review/audit mapping 유지 |
| REQ-CONST-002–004/011–013, DEC-002/003/014/019/020/033 | Candidate, Verification, Permission, Proposal/Approval, Publication 분리 |
| REQ-CONST-005/007, DEC-021 | provenance와 append-oriented audit/status/approval evidence 유지 |
| REQ-CONST-009, DEC-005/015/044 | connector가 동일 intake/publication gate를 사용하고 authority를 갖지 않음 |
| DEC-031 | `AGGREGATE.STATUS` namespace를 Book 3 lifecycle까지 적용 |
| DEC-032/040 | workflow/API가 canonical prerequisite와 state를 재검사 |
| DEC-034 | expiration/scheduler는 authority를 확대하지 않음 |
| DEC-035/036/045 | retry/async acceptance/UNKNOWN이 false success를 만들지 않음 |
| DEC-038/039/041–043 | API contract, trace, authority, error와 version semantics 유지 |

## Decision Register disposition

- DEC-001–008의 기존 APPROVED status를 변경하지 않았다.
- DEC-009–045의 기존 UNDER_REVIEW status를 변경하지 않았다.
- Consistency correction은 approval evidence가 아니며 DRAFT documents를 FROZEN/APPROVED로 승격하지 않는다.
- `PUBLICATION.SUSPENDED`는 새 decision이 아니라 DEC-031/034/036에 따라 이미 정의된 fail-closed state의 database/API synchronization이다.
- Intake, Contact Case, Client Proposal, Publication Approval entity rows는 이미 존재한 WF/API aggregates의 dictionary omission correction이다.

## Remaining decision-dependent items

| Item | Existing owner/decision context | Disposition |
|---|---|---|
| named owners/delegates and two-person approval tier | DEC-033/041 | OPEN DECISION; Phase 8 security/UI 전에 필요 |
| exact expiry/reverification thresholds | DEC-034 | OPEN DECISION; policy owner review |
| rbs-homes contract/reconciliation evidence | DEC-036/044/045 | ASSUMPTION; vendor evidence 필요 |
| identity provider/token/session policy | DEC-041 | OPEN DECISION; Phase 8 prerequisite |
| API major/support/error-to-HTTP mapping | DEC-042/043 | OPEN DECISION; detailed contract review |
| test IDs and delivery Phase IDs | Traceability Rule / future Books 10/12 | PLANNED; premature ID issuance 금지 |

## Recommendation

Phase 8은 이 correction baseline을 사용하되 new security/privacy decision이 필요하면 CR/ADR/Decision workflow를 거쳐야 한다. 이 summary는 그러한 future decision을 선결정하지 않는다.

