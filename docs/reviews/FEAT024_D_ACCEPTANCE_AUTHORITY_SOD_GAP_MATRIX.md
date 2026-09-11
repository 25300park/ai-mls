# FEAT-024-D Acceptance Authority / SoD Gap Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-148 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / Release Owner / Security Owner |
| 기준일 | 2026-09-11 |

## 1. Objective

FEAT-024-C의 durable acceptance manifest 경계 앞에 필요한 executable human release acceptance authority와 separation-of-duties gap을 식별하고, Architecture Owner가 승인한 최소 canonical amendment를 구현 경계로 고정한다.

## 2. Canonical evidence

- [Authorization Model](../book-8/03_AUTHORIZATION_MODEL.md)
- [Permission Matrix](../book-8/04_PERMISSION_MATRIX.md)
- [Session and Access Control](../book-8/09_SESSION_AND_ACCESS_CONTROL.md)
- [Security Registry](../00_SECURITY_REGISTRY.md)
- [Release Management](../book-9/04_RELEASE_MANAGEMENT.md)
- [Release Acceptance](../book-10/12_RELEASE_ACCEPTANCE.md)
- [Developer Registry](../book-11/15_DEVELOPER_REGISTRY.md)
- [FEAT-024-B Completion](FEAT024_B_RELEASE_EVIDENCE_MANIFEST_CONTRACTS_COMPLETION.md)
- [FEAT-024-C Completion](FEAT024_C_DURABLE_ACCEPTANCE_MANIFEST_IDEMPOTENCY_COMPLETION.md)
- Architecture Owner-approved FEAT-024-D brief and Canonical Authority Amendment

## 3. Gap matrix

| Item | Before amendment | Canonical requirement | Approved bounded disposition |
|---|---|---|---|
| DEV-024 owner mapping | `Development/Quality/Release Owner` existed only as governance ownership | Executable human acceptance authority | Add canonical `RELEASE_OWNER` role for FEAT-024 acceptance only |
| Capability | No release acceptance capability existed | Exact candidate acceptance action | Add exactly `release.accept` |
| Existing roles | `ADM`, `SEC`, `OPS`, `REV` explicitly lack general release acceptance authority | No implicit authority inheritance | Preserve meanings; none receive `release.accept` |
| Live actor | `AuthorizationService` already resolves current Session actor and live assignments | Body actor/role/capability ignored | Derive `acceptedBy` only from trusted active Session and live assignment |
| MFA | Release approval maps to privileged control `SEC-004`, but no executable action existed | MFA required | Register `release.accept` as privileged human action and reuse existing MFA validation |
| Producer provenance | Candidate contract had no producer identity | `producerActorId != acceptanceActorId` | Bind trusted producer provenance immutably to candidate ID/fingerprint without changing artifact/candidate fingerprints |
| Implementation author provenance | Not universally available | Compare only when authoritative | `NOT_EVALUABLE` when absent; never fabricate PASS |
| Deployment executor | Deployment has not occurred and is outside D | Future executor must differ from accepter | Persist accepter identity/evidence for later boundary; deployment calls remain zero |
| Independent review | Evidence existed but could be confused with authority | Review is prerequisite evidence only | Reviewer identity never grants `release.accept` |
| Acceptance persistence | C stores validated manifests durably and idempotently | Persist only after fresh authority/MFA/SoD/binding checks | One internal authority service delegates to the existing C store |
| Current REL-001 | Five mandatory runtime gaps; result `INCOMPLETE` | Authority cannot elevate incomplete evidence | Preserve `INCOMPLETE`; false `ACCEPTED` remains zero |
| Positive ACCEPTED proof | No eligible production candidate exists | Prove the authorized success branch | Use an isolated test-only eligible candidate fixture; never persist it as real release evidence |

## 4. Exact authority and SoD decision

- `RELEASE_OWNER` has exactly one FEAT-024 capability: `release.accept`.
- `release.accept` is human-only, privileged, MFA-required, reason/audit-bearing and live-authorized.
- Candidate producer and accepter must differ.
- Implementation author and accepter must differ when authoritative author provenance exists; otherwise the comparison is `NOT_EVALUABLE`.
- Acceptance actor and any later deployment executor must differ; D records the acceptance actor but invokes no deployment boundary.
- Independent review remains required evidence and never creates acceptance authority.

## 5. Scope protection

No public API, deployment/promotion/rollback capability, business mutation, new persistence subsystem, external identity provider, dependency, REL-001 rewrite or IMP status rewrite is authorized.

## 6. Design gate

The Architecture Owner amendment resolves the previously blocking authority, MFA, SoD and test-fixture decisions. FEAT-024-D may proceed through RED → minimum implementation → GREEN using the existing AuthorizationService and FEAT-024-C durable store.
