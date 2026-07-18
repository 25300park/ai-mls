# External Integration Architecture

| 항목 | 값 |
|---|---|
| Document ID | DOC-API-014 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Business Owner |
| 기준일 | 2026-07-14 |
| API Capability | API-019 |

## Purpose

외부 system과 AI MLS 사이 data direction, system-of-record, trust/authority, failure와 lifecycle contract를 분류한다. `CURRENT`, `PLANNED`, `ASSUMPTION`은 구현 상태와 검증 수준을 나타내며 승인 의미가 아니다.

## Integration inventory

| Integration | Status | Direction | AI MLS authority / external authority | System of record and notes |
|---|---|---|---|---|
| Manual Intake | **CURRENT** | staff → core | core validates; human remains accountable | AI MLS for intake record; original evidence retained |
| CSV Intake | **CURRENT** | file → staged core intake | no batch bypass | source file evidence + AI MLS accepted records; exact profile 미확정 |
| Browser Extension | **PLANNED** | user-directed browser → intake | capture only | source page is evidence; AI MLS owns intake state |
| Website Connector | **PLANNED** | approved site → intake | capture only | source system for observed content; AI MLS for candidate state |
| AI Provider | **ASSUMPTION** | request ↔ advisory result | provider has no business authority | AI MLS owns job/result validation/review; provider/model TBD |
| AI Memory Gateway | **ASSUMPTION** | controlled bidirectional | no authority; context use consent-bound | system of record unresolved |
| CRM | **ASSUMPTION** | selected bidirectional | conflict policy required | client/activity ownership unresolved |
| Accounting | **ASSUMPTION** | limited bidirectional | financial system authority cannot be inferred | accounting SoR/data scope unresolved |
| Marketing | **ASSUMPTION** | approved outbound + status | consent/withdrawal required | platform delivery status external; approval internal |
| rbs-homes | **ASSUMPTION** | approved outbound + reconcile | AI MLS owns approval; external system owns observed delivery state | actual API/auth/status/withdraw capability unverified |

## Logical Endpoints

Integration-facing operations are connector registration/health, scoped intake submission, approved delivery lease/report, external observation/reconciliation and revocation. Domain operations remain owned by Source/Intake, AI Job, Contact/Client or Publication APIs.

## Request Model

Integration/instance identity and version, direction/purpose, source/target policy, data classification, system-of-record declaration, external object/version/time, credential reference, idempotency/correlation, retention/deletion and contract version을 요구한다.

## Response Model

Internal/external reference mapping, acceptance/disposition, authoritative-source label, conflict/reconciliation state, retryability, policy/contract version와 trace IDs를 반환한다. External response is evidence until core validation applies it.

## Business Rules

새 integration은 owner, purpose, data minimization, SoR, auth/scope, version, error, retry, reconcile, retention/deletion, shutdown과 approval을 먼저 확정한다. Conflict는 silent last-write-wins로 해결하지 않는다. External deletion은 core evidence deletion을 자동 의미하지 않으며 policy workflow를 따른다.

## Authority

Integration Owner는 technical contract, Business/Data/Security owners는 use/data/authority policy를 승인한다. External platform, connector 또는 AI provider는 core Verification/Permission/Approval authority가 없다.

## Validation

classification status, approved contract/version, source/target/instance state, SoR ownership, mapping/version, consent/purpose, current workflow prerequisites, payload minimization, retry/reconcile capability와 shutdown status를 검사한다.

## Audit

contract/instance version, credential-reference use, transmitted data classes/checksum, mapping, external observations, conflict/reconcile decisions, retry, policy denial, consent/withdraw/delete propagation과 shutdown을 기록한다.

## Error Conditions

`INTEGRATION_NOT_APPROVED`, `CONTRACT_VERSION_UNSUPPORTED`, `SYSTEM_OF_RECORD_CONFLICT`, `EXTERNAL_REFERENCE_CONFLICT`, `DATA_CLASS_NOT_ALLOWED`, `CONSENT_SCOPE_DENIED`, `EXTERNAL_TIMEOUT`, `EXTERNAL_STATE_UNKNOWN`, `INTEGRATION_SUSPENDED`.

## Related Workflow

`WF-001`–`012` as mapped by direction; no integration may skip an intermediate workflow.

## Related Entity

Source Registry, Raw Source, Source Provenance, Client, Communication, AI Job, AI Result, Publication Target, Publication, System Error, Audit Event.

## Related AI Capability

AI Provider supports `AI-001`–`007`; other integrations are `N/A` unless a separately approved AI purpose is registered.
