# REL-001 Phase 1F Application Mapping Closure

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-068 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / API Owner / Domain Owners |
| 적용 범위 | Six Phase 1A executable mapping/prerequisite gaps |

## Mapping dispositions

| API | Canonical operation | Existing service/path | Prerequisite | Missing executable boundary | Disposition |
|---|---|---|---|---|---|
| API-005 | Propose Master Correction | `PropertyService.propose()` creates a new Property identity | existing Property/version plus canonical correction delta/evidence | correction-proposal Application/Domain shape and durable history | `NOT_TRANSPORT_READY`; a thin rename would change meaning |
| API-007 | Search Contacts | no public Contact search query | purpose-scoped filters, masking, deterministic bound/order | privacy-safe query projection | `THIN_APPLICATION_ADAPTER` only after filter/pagination bounds approval |
| API-007 | Record Contact Attempt | `ContactService.recordContactAttempt()` | existing canonical Contact Case ID/version | no Case creation transport exists | `EXISTING_APPLICATION_MAPPING_REUSE` plus `BLOCKED_CONTACT_CASE_PREREQUISITE` |
| API-007 | Set Do-Not-Contact | `ContactService.setDoNotContact()` | existing canonical Contact Case ID/version | no Case creation transport exists | `EXISTING_APPLICATION_MAPPING_REUSE` plus `BLOCKED_CONTACT_CASE_PREREQUISITE` |
| API-009 | Request Requirement Parsing | only advisory result validators | exact Requirement revision and API-017 job contract | API-017 accepted-job handoff | `PREREQUISITE_RUNTIME_DEPENDENCY`; `DEFERRED_TO_PHASE_3` |
| API-010 | Request Match | `MatchingService.requestMatch()` executes synchronously | API-017 asynchronous request/admission identity | canonical background job handoff | `PREREQUISITE_RUNTIME_DEPENDENCY`; `DEFERRED_TO_PHASE_3` |

## Closure result

- Disposition resolved: `6/6`.
- Executable transport mapping ready now: `0/6`.
- New business orchestration: `0`.
- Implicit Contact Case creation: `0`.
- Duplicated API-017 semantics: `0`.

API-004 Request AI Processing already has an Intake-to-job seam but remains a third `DEFERRED_TO_PHASE_3` operation because the API-017 Runtime Foundation is absent.

Related: [Phase 1A Mapping Reconciliation](REL001_PHASE1A_OPERATION_MAPPING_RECONCILIATION.md), [Phase 1F Eligibility](REL001_PHASE1F_TRANSPORT_ELIGIBILITY_MATRIX.md).
