# REL-002 Phase 1F Decision Proposals

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-300 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-09-18 |
| Baseline | `3c2a03ac6787b0323846da6bfa2d3e52c72cc069` |

## 1. Ratification status

| Decision | Proposal | Status | Ratification effect |
|---|---|---|---|
| DEC-169 | Identity/API-016 registration evidence binding, Phase-2-provisioned read-only Audit query, and evidence-backed non-Session workload authorization subject contract | APPROVED | canonical evidence and service authorization input boundary approved; no new authority/event implied |
| DEC-170 | single Production entry plus closed registry governing the five actual roots | APPROVED | synthetic slots cease to be canonical root evidence |
| DEC-171 | Identity-owned versioned schema contract plus Phase 2 migration metadata and strict read-only equality check | APPROVED | weak SQL-fragment checking prohibited |

## 2. Non-decision

Human live authorization continues through `SessionAccessCoordinator`. Service/job/worker execution cannot reuse that path because no canonical service Session issuance/resolution authority exists. DEC-169 approves a bounded `WorkloadAuthorizationSubject` input contract for the existing live-assignment/policy engine. It must not fabricate `SessionContext` facts or introduce a new authority. Phase 1E remains BLOCKED until separately authorized implementation supplies this contract.

## 3. Preserved boundaries

- DEC-165~168 remain APPROVED and unchanged.
- REL002-GAP-004/005/006 remain BLOCKING.
- Production migration ownership remains REL-002 Phase 2.
- no new API, role, capability, identity authority, persistence subsystem, dependency, credential or provider/network activation
- DEC-162 remains historical `IN REVIEW`; provider live execution remains `0/3 NOT_READY`.

## 4. AO ratification result

1. DEC-169 is APPROVED without new Audit vocabulary: read-only evidence binding/query plus a non-Session workload subject consumed by the existing authorization engine. If existing events cannot bind registration, a separate Audit Owner amendment remains required.
2. DEC-170 is APPROVED; independent Production startup through lower-level root exports is prohibited.
3. DEC-171 is APPROVED; Phase 2 must provision the same contract version/fingerprint metadata.

Approval does not authorize implementation. Phase 1E remains BLOCKED pending separate implementation authorization and evidence.
