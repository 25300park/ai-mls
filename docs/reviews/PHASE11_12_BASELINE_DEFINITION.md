# Phase 11-12 Architecture Baseline Definition

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-066 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / Documentation Owner / Release Owner |
| 기준일 | 2026-07-26 |
| Baseline label | Architecture v1.1 candidate |
| Baseline state | NOT FROZEN |

## 1. Baseline relationship

이 문서는 future Architecture v1.1 candidate가 포함해야 할 scope를 정의하는 review evidence다. [Architecture Bible v1.0 Freeze Baseline](../freeze/FREEZE_BASELINE.md), manifest와 checksum을 변경하거나 supersede하지 않는다.

## 2. Frozen Book scope

| Book | Index | Documents reviewed | Current lifecycle | Candidate treatment |
|---|---|---:|---|---|
| Book 0 | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) | 9 | FROZEN | inherit unchanged from v1.0 |
| Book 1 | [Business Strategy](../book-1/00_BUSINESS_STRATEGY_INDEX.md) | 11 | FROZEN | inherit unchanged from v1.0 |
| Book 2 | [System Architecture](../book-2/00_ARCHITECTURE_INDEX.md) | 11 | FROZEN | inherit unchanged from v1.0 |
| Book 3 | [Database Architecture](../book-3/00_DATABASE_ARCHITECTURE_INDEX.md) | 16 | FROZEN | inherit unchanged from v1.0 |
| Book 4 | [AI Architecture](../book-4/00_AI_ARCHITECTURE_INDEX.md) | 16 | FROZEN | inherit unchanged from v1.0 |
| Book 5 | [Workflow Architecture](../book-5/00_WORKFLOW_INDEX.md) | 15 | FROZEN | inherit unchanged from v1.0 |
| Book 6 | [API Architecture](../book-6/00_API_ARCHITECTURE_INDEX.md) | 17 | FROZEN | inherit unchanged from v1.0 |
| Book 7 | [UI Architecture](../book-7/00_UI_ARCHITECTURE_INDEX.md) | 16 | FROZEN | inherit unchanged from v1.0 |
| Book 8 | [Security Architecture](../book-8/00_SECURITY_ARCHITECTURE_INDEX.md) | 16 | FROZEN | inherit unchanged from v1.0 |
| Book 9 | [Operations Architecture](../book-9/00_DEPLOYMENT_OPERATIONS_INDEX.md) | 16 | FROZEN | inherit unchanged from v1.0 |

Book 0~9 합계는 143개이며 143/143 `FROZEN`이다.

## 3. Candidate Registry scope

| Registry | Document | Version | Current status | Freeze eligibility |
|---|---|---|---|---|
| Decision | [Decision Register](../00_DECISION_REGISTER.md) | v1.3 | IN REVIEW | NOT READY |
| RTM | [Canonical RTM](../00_CANONICAL_TRACEABILITY_MATRIX.md) | v1.4 | IN REVIEW | NOT READY |
| Publication | [Publication Registry](../00_PUBLICATION_REGISTRY.md) | v0.1 | IN REVIEW | NOT READY |
| Workflow | [Workflow Registry](../00_WORKFLOW_REGISTRY.md) | v0.1 | IN REVIEW | NOT READY |
| API | [API Registry](../00_API_REGISTRY.md) | v0.1 | IN REVIEW | NOT READY |
| Security | [Security Registry](../00_SECURITY_REGISTRY.md) | v0.1 | IN REVIEW | NOT READY |
| Projection | [Projection Registry](../00_PROJECTION_REGISTRY.md) | v0.1 | IN REVIEW | NOT READY |
| Event | [Event Registry](../00_EVENT_REGISTRY.md) | v0.1 | IN REVIEW | NOT READY |
| Operations | [Operations Registry](../00_OPERATIONS_REGISTRY.md) | v0.1 | IN REVIEW | BLOCKED |
| Test | [Test Registry](../00_TEST_REGISTRY.md) | v0.1 | IN REVIEW | BLOCKED |

## 4. Canonical identity scope

| Namespace | Candidate baseline identity | Count | Freeze result |
|---|---|---:|---|
| DEC | DEC-001~112 | 112 | unique; status normalization required |
| TRACE | TRACE-001~024 | 24 | unique |
| Publication | runtime opaque `publication_id`; PUB-STATE-001~008 vocabulary | 8 states | unique |
| WF | WF-001~012 | 12 | unique |
| API | API-001~019 | 19 | unique |
| SEC | SEC-001~034 | 34 | unique |
| PRJ | PRJ-001~008 | 8 | unique |
| EVT | EVT-001~012 | 12 | unique |
| OPS | frozen OPS-001~032 | 32 | unique; requested alias conflict unresolved |
| TST | TST-001~010 | 10 | unique; frozen TEST-001~056 preserved separately |

Canonical ID는 이 review에서 추가, 삭제, 재번호화 또는 변경하지 않는다.

## 5. Canonical vocabulary scope

Candidate baseline은 다음 vocabulary를 normative하게 포함해야 한다.

- Business command: `Publish`, `Withdraw`, `Republish`.
- Technical processing: `Replay`, `Rebuild`, `Recover`.
- Derived/fact contracts: `Projection`, `Event`.
- Governance concepts: `Capability`, `Authority`, `Approval`, `Validation`.
- Publication canonical lifecycle: `READY`, `EXECUTION_PENDING`, `ACTIVE`, `RECONCILIATION_REQUIRED`, `WITHDRAWAL_PENDING`, `WITHDRAWN`, `SUPERSEDED`, `TERMINATED`.
- Operational capability: `Deploy`, `Rollback`, `Backup`, `Restore`, `Replay`, `Rebuild`, `Recover`, `Monitor`, `Validate` after GAP-CR-003/004 disposition.

Legacy term은 explicit alias/deprecated record로만 남겨야 하며 현재 DEC status와 OPS conflict는 baseline에 동결할 수 없다.

## 6. Governance rules included

- Architecture precedence, Document Governance/Lifecycle와 Glossary.
- Zero Trust, Default Deny, session-derived actor, purpose limitation와 classification inheritance.
- Human Authority, actor-level SoD, immutable audit, provenance와 safe error.
- AI/Projection/Event/Operations/Test non-authority boundary.
- Registry reciprocal mapping, RTM and evidence trace.
- Change Request → impact/trace → ADR/approval → version → validation → new freeze manifest.

## 7. Deferred boundary excluded from freeze gap

Physical payload/serialization, Queue/Event Bus/Event Store, worker topology, runtime SLO와 product selection은 [Deferred Decision Review Evidence](PHASE11_12_DEFERRED_DECISIONS.md)에 따라 implementation/release gate로 남긴다. 이들은 logical authority, contract와 owner가 확정된 경우 candidate content gap이 아니다.

## 8. Candidate snapshot requirements

Freeze 가능한 baseline은 최소 다음 evidence를 가져야 한다.

1. exact included-document registry and count;
2. each document ID/path/version/status/owner;
3. content checksum manifest;
4. immutable repository commit/reference;
5. resolved gap and cross-registry validation reports;
6. Architecture Owner/User freeze approval and date;
7. prior v1.0 baseline relationship and supersession scope.

현재 v1.1 candidate에는 1~6의 complete approved evidence가 없다.

## 9. Baseline decision

- Existing Architecture Bible v1.0: `FROZEN`, unchanged.
- Proposed Architecture v1.1 content set: identified but `NOT FROZEN`.
- Baseline inclusion of Phase 11 registries: deferred until GAP-CR-001~008 resolution.
- FEAT-015 implementation baseline: not established.

## 10. Recommendation

`MODIFY_AND_REVIEW`

이 정의는 future freeze candidate의 scope를 제한하지만 freeze 선언이나 implementation authorization은 아니다.
