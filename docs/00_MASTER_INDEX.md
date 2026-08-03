# AI MLS Platform Architecture Bible — Master Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-001 |
| 문서 버전 | v2.3 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-24 |

이 문서는 Architecture Bible의 master navigation이자 계획 manifest다. `AVAILABLE`은 현재 파일이 존재함을, `PLANNED`는 해당 Brief에서 생성할 예정임을 뜻한다. 문서 상태(`DRAFT` 등)와 파일 존재 상태(`AVAILABLE` 등)는 서로 다른 값이다.

## 시작점과 A0 기반 문서

| 구분 | 문서 | 존재 상태 |
|---|---|---|
| Project overview | [README](../README.md) | AVAILABLE |
| Codex rules | [AGENTS](../AGENTS.md) | AVAILABLE |
| Brief master set | [AI MLS Codex Documentation Briefs](../AI_MLS_CODEX_DOCUMENTATION_BRIEFS.md) | AVAILABLE |
| Governance | [Document Governance](00_DOCUMENT_GOVERNANCE.md) | AVAILABLE |
| Terminology | [Glossary](00_GLOSSARY.md) | AVAILABLE |
| Change record | [Version History](00_VERSION_HISTORY.md) | AVAILABLE |
| ADR workflow | [ADR Index and Workflow](adr/README.md) | AVAILABLE |
| Review workflow | [Review Index and Workflow](reviews/README.md) | AVAILABLE |
| ADR template | [ADR Template](templates/ADR_TEMPLATE.md) | AVAILABLE |
| Review template | [Review Template](templates/REVIEW_TEMPLATE.md) | AVAILABLE |
| Completion template | [Phase Completion Template](templates/PHASE_COMPLETION_TEMPLATE.md) | AVAILABLE |
| A0 report | [A0 Completion](reviews/A0_COMPLETION.md) | AVAILABLE |

## Documentation Quality Foundation (A0.5)

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-CORE-013 | [Risk Register](00_RISK_REGISTER.md) | architecture/business risk와 mitigation 추적 | AVAILABLE |
| DOC-CORE-014 | [Assumption Register](00_ASSUMPTION_REGISTER.md) | 검증 전 architecture assumption 추적 | AVAILABLE |
| DOC-CORE-015 | [Naming Convention](00_NAMING_CONVENTION.md) | database, API, TypeScript, React, file/document/Git naming 통일 | AVAILABLE |
| DOC-CORE-016 | [Document ID Rule](00_DOCUMENT_ID_RULE.md) | 영구 문서 identifier와 replacement 규칙 | AVAILABLE |
| DOC-CORE-017 | [Mermaid Style Guide](00_MERMAID_STYLE_GUIDE.md) | diagram syntax, naming, layout와 acceptance 통일 | AVAILABLE |
| DOC-CORE-018 | [Review Checklist](00_REVIEW_CHECKLIST.md) | 모든 Book의 공통 quality gate | AVAILABLE |
| DOC-CORE-019 | [Traceability Rule](00_TRACEABILITY_RULE.md) | business goal부터 release까지 연결 규칙 | AVAILABLE |
| DOC-REVIEW-002 | [A0.5 Completion](reviews/A0_5_COMPLETION.md) | Documentation Quality Foundation 완료 증거 | AVAILABLE |

## Documentation Governance Enhancement (A0.6)

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-CORE-020 | [Decision Register](00_DECISION_REGISTER.md) | architecture 및 governance decision 추적 | AVAILABLE |
| DOC-CORE-021 | [Change Request Register](00_CHANGE_REQUEST_REGISTER.md) | 요청 변경의 접수, review, approval과 구현 추적 | AVAILABLE |
| DOC-CORE-022 | [Architecture Review Board](00_ARCHITECTURE_REVIEW_BOARD.md) | board 역할, voting, conflict와 emergency process | AVAILABLE |
| DOC-CORE-023 | [Release Policy](00_RELEASE_POLICY.md) | documentation release, version, approval과 archive 정책 | AVAILABLE |
| DOC-CORE-024 | [Document Lifecycle](00_DOCUMENT_LIFECYCLE.md) | `DRAFT`부터 `ARCHIVED`까지 canonical lifecycle | AVAILABLE |
| DOC-CORE-025 | [Approval Workflow](00_APPROVAL_WORKFLOW.md) | author부터 user/freeze approval까지 evidence workflow | AVAILABLE |
| DOC-REVIEW-003 | [A0.6 Completion](reviews/A0_6_COMPLETION.md) | Documentation Governance Enhancement 완료 증거 | AVAILABLE |

## Book 0 — Project Constitution (A1)

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-CORE-026 | [Project Constitution](book-0/00_PROJECT_CONSTITUTION.md) | project 최고 architecture authority와 mandatory requirements | AVAILABLE |
| DOC-CORE-027 | [Mission, Vision, and Values](book-0/01_MISSION_VISION_VALUES.md) | internal-first mission과 long-term cooperative MLS vision | AVAILABLE |
| DOC-CORE-028 | [Product Principles](book-0/02_PRODUCT_PRINCIPLES.md) | product identity, boundary, MVP와 external-use policy | AVAILABLE |
| DOC-CORE-029 | [AI Principles](book-0/03_AI_PRINCIPLES.md) | AI role, authority limit, review, transparency와 audit | AVAILABLE |
| DOC-CORE-030 | [Data Principles](book-0/04_DATA_PRINCIPLES.md) | provenance, authority states, retention와 master data 원칙 | AVAILABLE |
| DOC-CORE-031 | [Security and Privacy Principles](book-0/05_SECURITY_PRIVACY_PRINCIPLES.md) | least privilege, contact, audit, encryption과 privacy | AVAILABLE |
| DOC-CORE-032 | [Development Principles](book-0/06_DEVELOPMENT_PRINCIPLES.md) | documentation/architecture-first, ADR, test와 delivery 원칙 | AVAILABLE |
| DOC-CORE-033 | [Decision Rules](book-0/07_DECISION_RULES.md) | authority, conflict, exception, emergency와 approval 규칙 | AVAILABLE |
| DOC-CORE-034 | [Definition of Done](book-0/08_DEFINITION_OF_DONE.md) | document/architecture/development/feature/phase/release Done | AVAILABLE |
| DOC-REVIEW-004 | [A1 Completion](reviews/A1_COMPLETION.md) | Book 0 완료 evidence와 A2 gate | AVAILABLE |

## Canonical Traceability Foundation (Phase 15)

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-CORE-035 | [Canonical Traceability Matrix](00_CANONICAL_TRACEABILITY_MATRIX.md) | requirement부터 test까지 단일 authoritative zero-orphan trace | AVAILABLE |

## Phase 11-1 — Decision Register Alignment

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-CORE-020 | [Decision Register v1.3 candidate](00_DECISION_REGISTER.md) | AO-023–AO-035를 DEC-100–DEC-112로 canonical 등록 | AVAILABLE |
| DOC-CORE-036 | [Decision Index](00_DECISION_INDEX.md) | AO/DEC one-to-one 탐색과 status/version 정렬 | AVAILABLE |
| DOC-CORE-037 | [Decision Dependency Matrix](00_DECISION_DEPENDENCY_MATRIX.md) | 선행·후속·refinement와 cycle 검증 | AVAILABLE |
| DOC-CORE-038 | [Decision Trace Matrix](00_DECISION_TRACE_MATRIX.md) | Registry, API, Workflow, Security, Test와 RTM 연결 | AVAILABLE |
| DOC-REVIEW-031 | [Phase 11-1 Decision Validation](reviews/PHASE11_1_DECISION_VALIDATION.md) | uniqueness, dependency, reference와 freeze readiness 검증 | AVAILABLE |
| DOC-REVIEW-032 | [Phase 11-1 Completion](reviews/PHASE11_1_COMPLETION.md) | 범위, 변경, gap과 다음 prerequisite evidence | AVAILABLE |

## Phase 11-2 — Requirements Traceability Matrix Alignment

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-CORE-035 | [Canonical Traceability Matrix v1.3 candidate](00_CANONICAL_TRACEABILITY_MATRIX.md) | AO-023–AO-035 requirement-to-validation alignment | AVAILABLE |
| DOC-CORE-039 | [Requirement Index](00_REQUIREMENT_INDEX.md) | Requirement category, Decision relationship와 validation 탐색 | AVAILABLE |
| DOC-REVIEW-033 | [Phase 11-2 Trace Validation](reviews/PHASE11_2_TRACE_VALIDATION.md) | missing/orphan/duplicate/broken/circular trace 검증 | AVAILABLE |
| DOC-REVIEW-034 | [Phase 11-2 RTM Coverage](reviews/PHASE11_2_RTM_COVERAGE.md) | Requirement, Decision, Registry, Test coverage 집계 | AVAILABLE |
| DOC-REVIEW-035 | [Phase 11-2 Completion](reviews/PHASE11_2_COMPLETION.md) | 범위, 변경, limitation과 approval prerequisite evidence | AVAILABLE |

## Phase 11-3 — Publication Registry Alignment

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-CORE-040 | [Canonical Publication Registry](00_PUBLICATION_REGISTRY.md) | aggregate, lifecycle, version, authority, Withdrawal/Republish governance | AVAILABLE |
| DOC-CORE-041 | [Publication Index](00_PUBLICATION_INDEX.md) | state, operation, version, vocabulary와 Decision 탐색 | AVAILABLE |
| DOC-REVIEW-036 | [Phase 11-3 Publication Validation](reviews/PHASE11_3_PUBLICATION_VALIDATION.md) | lifecycle/version/mapping/duplicate/broken reference 검증 | AVAILABLE |
| DOC-REVIEW-037 | [Phase 11-3 Publication Coverage](reviews/PHASE11_3_PUBLICATION_COVERAGE.md) | AO/DEC/state/transition/version/Registry coverage 집계 | AVAILABLE |
| DOC-REVIEW-038 | [Phase 11-3 Completion](reviews/PHASE11_3_COMPLETION.md) | 범위, inconsistency, limitation과 approval prerequisite evidence | AVAILABLE |

## Phase 11-4 — Workflow Registry Alignment

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-CORE-042 | [Canonical Workflow Registry](00_WORKFLOW_REGISTRY.md) | workflow identity, path, transition, command와 authority governance | AVAILABLE |
| DOC-CORE-043 | [Workflow Index](00_WORKFLOW_INDEX.md) | canonical Workflow/path/command 탐색 | AVAILABLE |
| DOC-REVIEW-039 | [Phase 11-4 Workflow Validation](reviews/PHASE11_4_WORKFLOW_VALIDATION.md) | workflow/transition/command/mapping/duplicate/cycle 검증 | AVAILABLE |
| DOC-REVIEW-040 | [Phase 11-4 Workflow Coverage](reviews/PHASE11_4_WORKFLOW_COVERAGE.md) | AO/DEC/workflow/path/command/Registry coverage 집계 | AVAILABLE |
| DOC-REVIEW-041 | [Phase 11-4 Completion](reviews/PHASE11_4_COMPLETION.md) | 범위, inconsistency, limitation과 approval prerequisite evidence | AVAILABLE |

## Phase 11-5 — API Registry Alignment

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-CORE-044 | [Canonical API Registry](00_API_REGISTRY.md) | API identity, contract, command/query/internal, version와 authority governance | AVAILABLE |
| DOC-CORE-045 | [API Index](00_API_INDEX.md) | canonical API classification과 Publication API boundary 탐색 | AVAILABLE |
| DOC-REVIEW-042 | [Phase 11-5 API Validation](reviews/PHASE11_5_API_VALIDATION.md) | API/contract/version/mapping/authority/duplicate 검증 | AVAILABLE |
| DOC-REVIEW-043 | [Phase 11-5 API Coverage](reviews/PHASE11_5_API_COVERAGE.md) | AO/DEC/API/contract/version/Registry coverage 집계 | AVAILABLE |
| DOC-REVIEW-044 | [Phase 11-5 Completion](reviews/PHASE11_5_COMPLETION.md) | 범위, inconsistency, limitation과 approval prerequisite evidence | AVAILABLE |

## Phase 11-6 — Security Registry Alignment

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-CORE-046 | [Canonical Security Registry](00_SECURITY_REGISTRY.md) | control, authority, SoD, classification, audit/event/projection security governance | AVAILABLE |
| DOC-CORE-047 | [Security Index](00_SECURITY_INDEX.md) | canonical Security Control category와 authority/classification 탐색 | AVAILABLE |
| DOC-REVIEW-045 | [Phase 11-6 Security Validation](reviews/PHASE11_6_SECURITY_VALIDATION.md) | control/mapping/authority/SoD/classification/duplicate 검증 | AVAILABLE |
| DOC-REVIEW-046 | [Phase 11-6 Security Coverage](reviews/PHASE11_6_SECURITY_COVERAGE.md) | AO/DEC/control/category/Registry coverage 집계 | AVAILABLE |
| DOC-REVIEW-047 | [Phase 11-6 Completion](reviews/PHASE11_6_COMPLETION.md) | 범위, inconsistency, limitation과 approval prerequisite evidence | AVAILABLE |

## Phase 11-7 — Canonical Projection Registry

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-CORE-048 | [Canonical Projection Registry](00_PROJECTION_REGISTRY.md) | PRJ definition, catalog, lifecycle, ownership, version, security와 rebuild governance | AVAILABLE |
| DOC-CORE-049 | [Projection Index](00_PROJECTION_INDEX.md) | canonical Projection/type/lifecycle/version 탐색 | AVAILABLE |
| DOC-REVIEW-048 | [Phase 11-7 Projection Validation](reviews/PHASE11_7_PROJECTION_VALIDATION.md) | projection/owner/lifecycle/version/mapping/duplicate 검증 | AVAILABLE |
| DOC-REVIEW-049 | [Phase 11-7 Projection Coverage](reviews/PHASE11_7_PROJECTION_COVERAGE.md) | PRJ/type/version/drift/rebuild/Registry coverage 집계 | AVAILABLE |
| DOC-REVIEW-050 | [Phase 11-7 Completion](reviews/PHASE11_7_COMPLETION.md) | 범위, inconsistency, limitation과 approval prerequisite evidence | AVAILABLE |

## Phase 11-8 — Canonical Event Registry

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-CORE-050 | [Canonical Event Registry](00_EVENT_REGISTRY.md) | EVT catalog, identity, ordering, version, classification, replay와 retention governance | AVAILABLE |
| DOC-CORE-051 | [Event Index](00_EVENT_INDEX.md) | canonical Event/category/aggregate/projection 탐색 | AVAILABLE |
| DOC-REVIEW-051 | [Phase 11-8 Event Validation](reviews/PHASE11_8_EVENT_VALIDATION.md) | catalog/identity/order/version/replay/retention/mapping 검증 | AVAILABLE |
| DOC-REVIEW-052 | [Phase 11-8 Event Coverage](reviews/PHASE11_8_EVENT_COVERAGE.md) | EVT/category/Workflow/API/Projection/Security/Test coverage 집계 | AVAILABLE |
| DOC-REVIEW-053 | [Phase 11-8 Completion](reviews/PHASE11_8_COMPLETION.md) | 범위, inconsistency, limitation과 approval prerequisite evidence | AVAILABLE |

## Phase 11-9 — Operations Registry Alignment

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-CORE-052 | [Operations Registry Alignment Candidate](00_OPERATIONS_REGISTRY.md) | frozen OPS catalog, classification, authority, recovery, monitoring, audit와 Registry mapping 정렬 | AVAILABLE |
| DOC-CORE-053 | [Operations Index](00_OPERATIONS_INDEX.md) | canonical Operation/category/capability/Registry 탐색 | AVAILABLE |
| DOC-REVIEW-054 | [Phase 11-9 Operations Validation](reviews/PHASE11_9_OPERATIONS_VALIDATION.md) | catalog identity, authority, recovery, monitoring, audit와 mapping 검증 | AVAILABLE |
| DOC-REVIEW-055 | [Phase 11-9 Operations Coverage](reviews/PHASE11_9_OPERATIONS_COVERAGE.md) | OPS/capability/category/Registry/security/test coverage 집계 | AVAILABLE |
| DOC-REVIEW-056 | [Phase 11-9 Completion](reviews/PHASE11_9_COMPLETION.md) | conflict, limitation, disposition과 approval prerequisite evidence | AVAILABLE |

## Phase 11-10 — Test Registry Alignment

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-CORE-054 | [Canonical Test Registry Alignment Candidate](00_TEST_REGISTRY.md) | TST catalog, classification, evidence, coverage와 cross-registry validation governance | AVAILABLE |
| DOC-CORE-055 | [Test Index](00_TEST_INDEX.md) | TST/TEST namespace, category, Registry, chain와 gap 탐색 | AVAILABLE |
| DOC-REVIEW-057 | [Phase 11-10 Test Validation](reviews/PHASE11_10_TEST_VALIDATION.md) | catalog, policy, evidence, Registry coverage와 chain 검증 | AVAILABLE |
| DOC-REVIEW-058 | [Phase 11-10 Test Coverage](reviews/PHASE11_10_TEST_COVERAGE.md) | TST/category/Registry/chain/evidence coverage 집계 | AVAILABLE |
| DOC-REVIEW-059 | [Phase 11-10 Completion](reviews/PHASE11_10_COMPLETION.md) | gap, inconsistency, disposition과 approval prerequisite evidence | AVAILABLE |

## Phase 11-11 — Cross-Registry Consistency Review

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-REVIEW-060 | [Cross-Registry Consistency Report](reviews/PHASE11_11_CROSS_REGISTRY_CONSISTENCY.md) | 10개 Registry identity/authority/vocabulary/mapping/trace consistency 최종 검토 | AVAILABLE |
| DOC-REVIEW-061 | [Registry Matrix](reviews/PHASE11_11_REGISTRY_MATRIX.md) | required chain, pairwise reference와 consistency dimension matrix | AVAILABLE |
| DOC-REVIEW-062 | [Consistency Validation Report](reviews/PHASE11_11_CONSISTENCY_VALIDATION.md) | identity, decision, vocabulary, authority, lifecycle, mapping과 trace 검증 | AVAILABLE |
| DOC-REVIEW-063 | [Architecture Gap Report](reviews/PHASE11_11_ARCHITECTURE_GAPS.md) | blocking/high governance gap와 correction dependency | AVAILABLE |
| DOC-REVIEW-064 | [Phase 11-11 Completion](reviews/PHASE11_11_COMPLETION.md) | final recommendation, limitation과 approval prerequisite evidence | AVAILABLE |

## Phase 11-12 — Architecture Freeze Review

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-REVIEW-065 | [Architecture Freeze Report](reviews/PHASE11_12_ARCHITECTURE_FREEZE.md) | v1.1 freeze와 FEAT-015 authorization 최종 gate 판정 | AVAILABLE |
| DOC-REVIEW-066 | [Baseline Definition](reviews/PHASE11_12_BASELINE_DEFINITION.md) | existing v1.0과 proposed v1.1 candidate scope/identity/governance 경계 | AVAILABLE |
| DOC-REVIEW-067 | [Freeze Validation Report](reviews/PHASE11_12_FREEZE_VALIDATION.md) | Book/Registry/zero-gap/deferred/immutable baseline 검증 | AVAILABLE |
| DOC-REVIEW-068 | [Deferred Decision Register — Review Evidence](reviews/PHASE11_12_DEFERRED_DECISIONS.md) | 8개 implementation/runtime/product deferred topic 분리 | AVAILABLE |
| DOC-REVIEW-069 | [Phase 11-12 Completion](reviews/PHASE11_12_COMPLETION.md) | freeze result, limitation과 correction prerequisite evidence | AVAILABLE |

## Phase 13-15 — FEAT-015 Final Architecture Verification

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-REVIEW-074 | [Phase 13-15 End-to-End Architecture Verification](reviews/PHASE13_15_END_TO_END_ARCHITECTURE_VERIFICATION_REPORT.md) | FEAT-015 전체 계층, dependency, regression, diagnostics와 final assessment evidence | AVAILABLE |
| DOC-REVIEW-075 | [F15-TASK-005 Authorization Implementation](reviews/F15_TASK_005_AUTHORIZATION_IMPLEMENTATION_REPORT.md) | session-derived Actor, SoD, live revalidation 및 immutable authorization evidence | AVAILABLE |

## Book 1 — Business Strategy (A2)

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-BIZ-001 | [Business Strategy Index](book-1/00_BUSINESS_STRATEGY_INDEX.md) | Book 1 navigation, thesis와 business-goal coverage | AVAILABLE |
| DOC-BIZ-002 | [Problem Statement](book-1/01_PROBLEM_STATEMENT.md) | current problem, pain, opportunity와 target state | AVAILABLE |
| DOC-BIZ-003 | [Current Workflow Analysis](book-1/02_CURRENT_WORKFLOW_ANALYSIS.md) | stakeholder, bottleneck, decision, risk와 future workflow | AVAILABLE |
| DOC-BIZ-004 | [Target Users and Personas](book-1/03_TARGET_USERS_AND_PERSONAS.md) | internal/customer/partner persona goal과 success criteria | AVAILABLE |
| DOC-BIZ-005 | [Value Proposition](book-1/04_VALUE_PROPOSITION.md) | business/customer/operational/network value | AVAILABLE |
| DOC-BIZ-006 | [US MLS Comparison](book-1/05_US_MLS_COMPARISON.md) | cooperative MLS와 candidate discovery platform 비교 | AVAILABLE |
| DOC-BIZ-007 | [Philippine Market Context](book-1/06_PHILIPPINE_MARKET_CONTEXT.md) | local regulation, ecosystem assumption, opportunity와 challenge | AVAILABLE |
| DOC-BIZ-008 | [Business Model](book-1/07_BUSINESS_MODEL.md) | current productivity와 future revenue hypothesis | AVAILABLE |
| DOC-BIZ-009 | [Product Scope and Non-Goals](book-1/08_PRODUCT_SCOPE_AND_NON_GOALS.md) | MVP/phase/POST-MVP/out-of-scope 경계 | AVAILABLE |
| DOC-BIZ-010 | [Success Metrics](book-1/09_SUCCESS_METRICS.md) | measurable KPI, baseline/target와 guardrail | AVAILABLE |
| DOC-BIZ-011 | [Long-Term Roadmap](book-1/10_LONG_TERM_ROADMAP.md) | 1/3/5/10-year outcome horizon | AVAILABLE |
| DOC-REVIEW-005 | [A2 Completion](reviews/A2_COMPLETION.md) | Book 1 completion evidence와 A3 handoff | AVAILABLE |

## Book 2 — System Architecture (A3)

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-ARCH-001 | [Architecture Index](book-2/00_ARCHITECTURE_INDEX.md) | Book 2 navigation과 architecture coverage | AVAILABLE |
| DOC-ARCH-002 | [System Overview](book-2/01_SYSTEM_OVERVIEW.md) | goals, principles, boundary와 core module overview | AVAILABLE |
| DOC-ARCH-003 | [Context Architecture](book-2/02_CONTEXT_ARCHITECTURE.md) | actor, external system, trust boundary | AVAILABLE |
| DOC-ARCH-004 | [Container Architecture](book-2/03_CONTAINER_ARCHITECTURE.md) | logical runtime/data responsibility | AVAILABLE |
| DOC-ARCH-005 | [Module Architecture](book-2/04_MODULE_ARCHITECTURE.md) | module purpose, I/O, dependency와 authority boundary | AVAILABLE |
| DOC-ARCH-006 | [Data Flow Architecture](book-2/05_DATA_FLOW_ARCHITECTURE.md) | intake에서 publication까지의 information flow | AVAILABLE |
| DOC-ARCH-007 | [Event and Job Architecture](book-2/06_EVENT_AND_JOB_ARCHITECTURE.md) | logical job, retry, schedule와 event flow | AVAILABLE |
| DOC-ARCH-008 | [Integration Architecture](book-2/07_INTEGRATION_ARCHITECTURE.md) | rbs-homes, AI, future connector/integration boundary | AVAILABLE |
| DOC-ARCH-009 | [Failure Isolation](book-2/08_FAILURE_ISOLATION.md) | 장애 격리, fail-closed와 recovery posture | AVAILABLE |
| DOC-ARCH-010 | [Scalability Strategy](book-2/09_SCALABILITY_STRATEGY.md) | MVP부터 future distributed network까지의 evolution | AVAILABLE |
| DOC-ARCH-011 | [Architecture Decisions](book-2/10_ARCHITECTURE_DECISIONS.md) | A3 결정 요약과 ADR linkage | AVAILABLE |
| DOC-REVIEW-006 | [A3 Completion](reviews/A3_COMPLETION.md) | Book 2 completion evidence와 Phase 4 handoff | AVAILABLE |

## Book 3 — Database Architecture (Phase 4)

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-DATA-001 | [Database Architecture Index](book-3/00_DATABASE_ARCHITECTURE_INDEX.md) | Book 3 navigation, principles와 capability coverage | AVAILABLE |
| DOC-DATA-002 | [Data Domain Model](book-3/01_DATA_DOMAIN_MODEL.md) | business domain, bounded context, ownership, authority와 lifecycle | AVAILABLE |
| DOC-DATA-003 | [Entity Relationship Model](book-3/02_ENTITY_RELATIONSHIP_MODEL.md) | logical entity relationship, cardinality와 reference rules | AVAILABLE |
| DOC-DATA-004 | [Database Standards](book-3/03_DATABASE_STANDARDS.md) | logical naming, identity, timestamp, deletion, status, version와 audit standards | AVAILABLE |
| DOC-DATA-005 | [Source and Raw Data Model](book-3/04_SOURCE_AND_RAW_DATA_MODEL.md) | source registry, raw evidence, collector, provenance와 retention | AVAILABLE |
| DOC-DATA-006 | [Property Master Model](book-3/05_PROPERTY_MASTER_MODEL.md) | property/building/tower/floor/unit/location/alias hierarchy | AVAILABLE |
| DOC-DATA-007 | [Candidate and Offer Model](book-3/06_CANDIDATE_AND_OFFER_MODEL.md) | candidate, offer, source, duplicate, availability와 lifecycle | AVAILABLE |
| DOC-DATA-008 | [Contact Model](book-3/07_CONTACT_MODEL.md) | contact, organization, communication, permission과 privacy | AVAILABLE |
| DOC-DATA-009 | [Client and Requirement Model](book-3/08_CLIENT_AND_REQUIREMENT_MODEL.md) | client, requirement, budget/preference와 history | AVAILABLE |
| DOC-DATA-010 | [Matching Model](book-3/09_MATCHING_MODEL.md) | match result, score, explanation, confidence, ranking와 history | AVAILABLE |
| DOC-DATA-011 | [Verification and Permission Model](book-3/10_VERIFICATION_AND_PERMISSION_MODEL.md) | verification, verifier, permission, expiry와 reverification | AVAILABLE |
| DOC-DATA-012 | [Publication Model](book-3/11_PUBLICATION_MODEL.md) | publication target, status, history, correction과 rollback | AVAILABLE |
| DOC-DATA-013 | [Audit and History Model](book-3/12_AUDIT_AND_HISTORY_MODEL.md) | audit, status, decision, approval와 user action history | AVAILABLE |
| DOC-DATA-014 | [Retention and Deletion Model](book-3/13_RETENTION_AND_DELETION_MODEL.md) | retention, archive, deletion, recovery와 legal hold | AVAILABLE |
| DOC-DATA-015 | [Indexing and Search Strategy](book-3/14_INDEXING_AND_SEARCH_STRATEGY.md) | search, duplicate, property, geo, contact index strategy | AVAILABLE |
| DOC-DATA-016 | [Data Dictionary](book-3/15_DATA_DICTIONARY.md) | logical entity별 owner, identifier, attributes, lifecycle, authority와 privacy | AVAILABLE |
| DOC-REVIEW-007 | [Phase 4 Completion](reviews/PHASE4_COMPLETION.md) | Database Architecture completion evidence와 Phase 5 handoff | AVAILABLE |

## Book 4 — AI Architecture (Phase 5)

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-AI-001 | [AI Architecture Index](book-4/00_AI_ARCHITECTURE_INDEX.md) | Book 4 navigation, principles와 capability trace | AVAILABLE |
| DOC-AI-002 | [AI Overview](book-4/01_AI_OVERVIEW.md) | objectives, scope, responsibilities, limitations와 lifecycle | AVAILABLE |
| DOC-AI-003 | [AI Boundaries](book-4/02_AI_BOUNDARIES.md) | allowed/prohibited action, authority, trust와 human boundary | AVAILABLE |
| DOC-AI-004 | [Provider Abstraction](book-4/03_PROVIDER_ABSTRACTION.md) | provider-neutral intent/result, selection, fallback와 expansion | AVAILABLE |
| DOC-AI-005 | [Listing Parser](book-4/04_LISTING_PARSER.md) | input/output, fields, validation, confidence와 failure/review | AVAILABLE |
| DOC-AI-006 | [Property Normalization](book-4/05_PROPERTY_NORMALIZATION.md) | canonical candidate, alias/location/building matching과 ambiguity | AVAILABLE |
| DOC-AI-007 | [Duplicate Detection](book-4/06_DUPLICATE_DETECTION.md) | relationship logic, similarity, recommendation와 human disposition | AVAILABLE |
| DOC-AI-008 | [Requirement Parser](book-4/07_REQUIREMENT_PARSER.md) | natural-language requirement, constraint와 structured output | AVAILABLE |
| DOC-AI-009 | [Matching and Ranking](book-4/08_MATCHING_AND_RANKING.md) | factors, score, weight, rank, explanation와 adjustment | AVAILABLE |
| DOC-AI-010 | [Natural Language Search](book-4/09_NATURAL_LANGUAGE_SEARCH.md) | read-only intent/entity/filter interpretation와 fallback | AVAILABLE |
| DOC-AI-011 | [Confidence and Validation](book-4/10_CONFIDENCE_AND_VALIDATION.md) | scale, validation, threshold, rejection, review와 metrics | AVAILABLE |
| DOC-AI-012 | [Human Review](book-4/11_HUMAN_REVIEW.md) | review, correction, feedback, escalation와 authority separation | AVAILABLE |
| DOC-AI-013 | [Prompt Governance](book-4/12_PROMPT_GOVERNANCE.md) | prompt owner, version, approval, testing, rollback와 sensitive data | AVAILABLE |
| DOC-AI-014 | [AI Observability](book-4/13_AI_OBSERVABILITY.md) | logging, quality, latency, failure, monitoring와 cost | AVAILABLE |
| DOC-AI-015 | [AI Output Schemas](book-4/14_AI_OUTPUT_SCHEMAS.md) | documentation-only JSON Schema contracts for seven outputs | AVAILABLE |
| DOC-AI-016 | [AI Prompt Library Guide](book-4/15_AI_PROMPT_LIBRARY_GUIDE.md) | prompt category, naming, lifecycle, testing, documentation와 review | AVAILABLE |
| DOC-REVIEW-008 | [Phase 5 Completion](reviews/PHASE5_COMPLETION.md) | AI Architecture completion evidence와 Phase 6 handoff | AVAILABLE |

## Book 5 — Workflow Architecture (Phase 6)

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-WF-001 | [Workflow Index](book-5/00_WORKFLOW_INDEX.md) | Book 5 navigation, workflow chain과 mandatory principles | AVAILABLE |
| DOC-WF-002 | [Listing Discovery Workflow](book-5/01_LISTING_DISCOVERY_WORKFLOW.md) | source discovery, policy review와 intake handoff | AVAILABLE |
| DOC-WF-003 | [Manual Intake Workflow](book-5/02_MANUAL_INTAKE_WORKFLOW.md) | raw evidence 등록, 검증, 정정과 candidate draft | AVAILABLE |
| DOC-WF-004 | [AI Processing Workflow](book-5/03_AI_PROCESSING_WORKFLOW.md) | advisory AI job/result, validation과 human review | AVAILABLE |
| DOC-WF-005 | [Duplicate Review Workflow](book-5/04_DUPLICATE_REVIEW_WORKFLOW.md) | duplicate suggestion, human disposition과 rollback | AVAILABLE |
| DOC-WF-006 | [Client Requirement Workflow](book-5/05_CLIENT_REQUIREMENT_WORKFLOW.md) | requirement 등록, history, priority와 match trigger | AVAILABLE |
| DOC-WF-007 | [Matching Workflow](book-5/06_MATCHING_WORKFLOW.md) | ranking, review, shortlist disposition과 staleness | AVAILABLE |
| DOC-WF-008 | [Contact and Verification Workflow](book-5/07_CONTACT_AND_VERIFICATION_WORKFLOW.md) | contact, verification과 separate permission lifecycle | AVAILABLE |
| DOC-WF-009 | [Client Proposal Workflow](book-5/08_CLIENT_PROPOSAL_WORKFLOW.md) | client-scoped proposal approval, sharing과 feedback | AVAILABLE |
| DOC-WF-010 | [Publication Approval Workflow](book-5/09_PUBLICATION_APPROVAL_WORKFLOW.md) | exact representation의 human publication approval | AVAILABLE |
| DOC-WF-011 | [Publication Workflow](book-5/10_PUBLICATION_WORKFLOW.md) | delivery, reconciliation, correction, withdrawal와 republish | AVAILABLE |
| DOC-WF-012 | [Expiration and Reverification Workflow](book-5/11_EXPIRATION_AND_REVERIFICATION_WORKFLOW.md) | expiry, reminder, eligibility block와 reverification | AVAILABLE |
| DOC-WF-013 | [Exception and Recovery Workflow](book-5/12_EXCEPTION_AND_RECOVERY_WORKFLOW.md) | failure containment, retry, escalation, recovery와 closure | AVAILABLE |
| DOC-WF-014 | [Status Dictionary](book-5/13_STATUS_DICTIONARY.md) | canonical aggregate-scoped workflow status semantics | AVAILABLE |
| DOC-WF-015 | [State Transition Rules](book-5/14_STATE_TRANSITION_RULES.md) | allowed/forbidden transition, authority와 rollback rules | AVAILABLE |
| DOC-REVIEW-009 | [Phase 6 Completion](reviews/PHASE6_COMPLETION.md) | Workflow Architecture completion evidence와 Phase 7 gate | AVAILABLE |

## Book 6 — API & Integration Architecture (Phase 7)

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-API-001 | [API Architecture Index](book-6/00_API_ARCHITECTURE_INDEX.md) | Book 6 navigation, mandatory principles와 trace bindings | AVAILABLE |
| DOC-API-002 | [API Principles](book-6/01_API_PRINCIPLES.md) | REST, versioning, idempotency, query, trace와 error conventions | AVAILABLE |
| DOC-API-003 | [Authentication API](book-6/02_AUTHENTICATION_API.md) | identity, role/permission, token과 session lifecycle | AVAILABLE |
| DOC-API-004 | [Source and Intake API](book-6/03_SOURCE_AND_INTAKE_API.md) | source policy, raw evidence와 manual intake contracts | AVAILABLE |
| DOC-API-005 | [Property and Listing API](book-6/04_PROPERTY_AND_LISTING_API.md) | property master, candidate/offer와 duplicate contracts | AVAILABLE |
| DOC-API-006 | [Contact API](book-6/05_CONTACT_API.md) | restricted contact/channel/communication contracts | AVAILABLE |
| DOC-API-007 | [Client and Requirement API](book-6/06_CLIENT_AND_REQUIREMENT_API.md) | client, requirement, revision와 history contracts | AVAILABLE |
| DOC-API-008 | [Matching API](book-6/07_MATCHING_API.md) | match execution, ranking, review와 staleness contracts | AVAILABLE |
| DOC-API-009 | [Verification API](book-6/08_VERIFICATION_API.md) | verification, permission와 reverification contracts | AVAILABLE |
| DOC-API-010 | [Publication API](book-6/09_PUBLICATION_API.md) | proposal, approval, delivery, reconciliation와 withdrawal | AVAILABLE |
| DOC-API-011 | [Admin and Audit API](book-6/10_ADMIN_AND_AUDIT_API.md) | governed administration과 restricted audit contracts | AVAILABLE |
| DOC-API-012 | [Background Job Contracts](book-6/11_BACKGROUND_JOB_CONTRACTS.md) | async job, retry, cancellation과 result contracts | AVAILABLE |
| DOC-API-013 | [Connector Contracts](book-6/12_CONNECTOR_CONTRACTS.md) | current/planned/assumed connector boundary | AVAILABLE |
| DOC-API-014 | [External Integration](book-6/13_EXTERNAL_INTEGRATION.md) | integration inventory, direction, SoR와 authority | AVAILABLE |
| DOC-API-015 | [API Error Standard](book-6/14_API_ERROR_STANDARD.md) | stable safe error envelope와 taxonomy | AVAILABLE |
| DOC-API-016 | [API Versioning](book-6/15_API_VERSIONING.md) | compatibility, deprecation, migration와 retirement | AVAILABLE |
| DOC-API-017 | [API Registry](book-6/16_API_REGISTRY.md) | API-001–019 capability mappings source of truth | AVAILABLE |
| DOC-REVIEW-010 | [Phase 7 Completion](reviews/PHASE7_COMPLETION.md) | API & Integration Architecture completion evidence와 Phase 7.5 gate | AVAILABLE |

## Phase 7.5 — Cross-Phase Consistency Review

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-REVIEW-011 | [Phase 7.5 Consistency Review](reviews/PHASE7_5_CONSISTENCY_REVIEW.md) | terminology/status/entity/workflow/API/AI/registry/trace 전면 검토 | AVAILABLE |
| DOC-REVIEW-012 | [Phase 7.5 Corrections](reviews/PHASE7_5_CORRECTIONS.md) | approved consistency correction과 영향 파일 기록 | AVAILABLE |
| DOC-REVIEW-013 | [Phase 7.5 Decision Summary](reviews/PHASE7_5_DECISION_SUMMARY.md) | existing decision 적용과 remaining decision dependency | AVAILABLE |
| DOC-REVIEW-014 | [Phase 7.5 Completion](reviews/PHASE7_5_COMPLETION.md) | cross-phase consistency completion evidence와 Phase 8 gate | AVAILABLE |

## Book 7 — UI/UX Architecture (Phase 8)

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-UI-001 | [UI/UX Architecture Index](book-7/00_UI_ARCHITECTURE_INDEX.md) | Book 7 navigation, mandatory UI principles와 scope | AVAILABLE |
| DOC-UI-002 | [Information Architecture](book-7/01_INFORMATION_ARCHITECTURE.md) | domain/content/object/decision hierarchy | AVAILABLE |
| DOC-UI-003 | [Navigation Structure](book-7/02_NAVIGATION_STRUCTURE.md) | global, role, domain, object와 task navigation | AVAILABLE |
| DOC-UI-004 | [User Roles and Dashboards](book-7/03_USER_ROLES_AND_DASHBOARDS.md) | role별 dashboard와 authority boundary | AVAILABLE |
| DOC-UI-005 | [Screen Catalog](book-7/04_SCREEN_CATALOG.md) | UI-001–037 logical screen inventory | AVAILABLE |
| DOC-UI-006 | [Screen Specifications](book-7/05_SCREEN_SPECIFICATIONS.md) | screen input/output/action/mapping 계약 | AVAILABLE |
| DOC-UI-007 | [Form Standard](book-7/06_FORM_STANDARD.md) | form structure, validation, safety와 privacy | AVAILABLE |
| DOC-UI-008 | [Search and Filter Standard](book-7/07_SEARCH_AND_FILTER_STANDARD.md) | structured/AI search, filter, sort와 result integrity | AVAILABLE |
| DOC-UI-009 | [Table and List Standard](book-7/08_TABLE_AND_LIST_STANDARD.md) | collection, row, bulk action와 responsive behavior | AVAILABLE |
| DOC-UI-010 | [Notification and Feedback](book-7/09_NOTIFICATION_AND_FEEDBACK.md) | task, warning, async/AI feedback와 privacy | AVAILABLE |
| DOC-UI-011 | [Design System Guide](book-7/10_DESIGN_SYSTEM_GUIDE.md) | semantic foundations와 domain patterns | AVAILABLE |
| DOC-UI-012 | [Responsive Strategy](book-7/11_RESPONSIVE_STRATEGY.md) | viewport별 task continuity와 priorities | AVAILABLE |
| DOC-UI-013 | [Accessibility Guide](book-7/12_ACCESSIBILITY_GUIDE.md) | WCAG 2.2 AA architecture target와 evidence | AVAILABLE |
| DOC-UI-014 | [Error and Empty State](book-7/13_ERROR_AND_EMPTY_STATE.md) | API error mapping과 safe recovery | AVAILABLE |
| DOC-UI-015 | [UI State Model](book-7/14_UI_STATE_MODEL.md) | UI state와 canonical business state 분리 | AVAILABLE |
| DOC-UI-016 | [Screen Registry](book-7/15_SCREEN_REGISTRY.md) | screen/workflow/entity/API/AI/permission mapping | AVAILABLE |
| DOC-REVIEW-015 | [Phase 8 Completion](reviews/PHASE8_COMPLETION.md) | UI/UX Architecture completion evidence와 Phase 9 gate | AVAILABLE |

## Book 8 — Security & Privacy Architecture (Phase 9)

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-SEC-001 | [Security Architecture Index](book-8/00_SECURITY_ARCHITECTURE_INDEX.md) | Book 8 navigation, mandatory control과 scope | AVAILABLE |
| DOC-SEC-002 | [Security Principles](book-8/01_SECURITY_PRINCIPLES.md) | objectives, Zero Trust, least privilege와 privacy by design | AVAILABLE |
| DOC-SEC-003 | [Identity and Authentication](book-8/02_IDENTITY_AND_AUTHENTICATION.md) | human/service identity, MFA와 authentication lifecycle | AVAILABLE |
| DOC-SEC-004 | [Authorization Model](book-8/03_AUTHORIZATION_MODEL.md) | scoped RBAC, POST-MVP ABAC와 authority separation | AVAILABLE |
| DOC-SEC-005 | [Permission Matrix](book-8/04_PERMISSION_MATRIX.md) | 15 roles, UI-001–037, API-001–019와 operation grants | AVAILABLE |
| DOC-SEC-006 | [Data Classification](book-8/05_DATA_CLASSIFICATION.md) | Public/Internal/Confidential/Restricted handling | AVAILABLE |
| DOC-SEC-007 | [Privacy Model](book-8/06_PRIVACY_MODEL.md) | purpose, consent, minimization, deletion와 legal hold | AVAILABLE |
| DOC-SEC-008 | [Audit and Compliance](book-8/07_AUDIT_AND_COMPLIANCE.md) | audit scope/evidence/trace와 compliance principles | AVAILABLE |
| DOC-SEC-009 | [Encryption and Key Management](book-8/08_ENCRYPTION_AND_KEY_MANAGEMENT.md) | encryption, key rotation와 secret principles | AVAILABLE |
| DOC-SEC-010 | [Session and Access Control](book-8/09_SESSION_AND_ACCESS_CONTROL.md) | session lifecycle, timeout, reauthentication와 device control | AVAILABLE |
| DOC-SEC-011 | [Security Event Model](book-8/10_SECURITY_EVENT_MODEL.md) | login, permission, publication, export와 suspicious events | AVAILABLE |
| DOC-SEC-012 | [Threat Model](book-8/11_THREAT_MODEL.md) | assets, actors, scenarios, mitigations와 residual risk | AVAILABLE |
| DOC-SEC-013 | [Security Logging](book-8/12_SECURITY_LOGGING.md) | log categories, integrity, privacy, access와 review | AVAILABLE |
| DOC-SEC-014 | [Incident Response](book-8/13_INCIDENT_RESPONSE.md) | detection, containment, recovery와 post-incident review | AVAILABLE |
| DOC-SEC-015 | [Backup and Recovery Security](book-8/14_BACKUP_AND_RECOVERY_SECURITY.md) | backup protection, recovery authorization/integrity/audit | AVAILABLE |
| DOC-SEC-016 | [Security Registry](book-8/15_SECURITY_REGISTRY.md) | SEC-001–034 cross-phase control mappings | AVAILABLE |
| DOC-REVIEW-016 | [Phase 9 Completion](reviews/PHASE9_COMPLETION.md) | Security & Privacy Architecture completion evidence와 Phase 10 gate | AVAILABLE |

## Book 9 — Deployment & Operations (Phase 10)

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-OPS-001 | [Deployment & Operations Index](book-9/00_DEPLOYMENT_OPERATIONS_INDEX.md) | Book 9 navigation, mandatory operations principles와 scope | AVAILABLE |
| DOC-OPS-002 | [Deployment Architecture](book-9/01_DEPLOYMENT_ARCHITECTURE.md) | logical topology, tiers, worker/storage/service와 trust boundaries | AVAILABLE |
| DOC-OPS-003 | [Environment Strategy](book-9/02_ENVIRONMENT_STRATEGY.md) | development/test/staging/production isolation와 promotion | AVAILABLE |
| DOC-OPS-004 | [Configuration Management](book-9/03_CONFIGURATION_MANAGEMENT.md) | configuration/secret reference/flag ownership와 lifecycle | AVAILABLE |
| DOC-OPS-005 | [Release Management](book-9/04_RELEASE_MANAGEMENT.md) | release approval, verification, rollback와 evidence | AVAILABLE |
| DOC-OPS-006 | [Operation Runbook](book-9/05_OPERATION_RUNBOOK.md) | daily/weekly/monthly/emergency/maintenance responsibilities | AVAILABLE |
| DOC-OPS-007 | [Monitoring and Observability](book-9/06_MONITORING_AND_OBSERVABILITY.md) | health, technical/business/security metrics와 alert/dashboard | AVAILABLE |
| DOC-OPS-008 | [Backup and Recovery](book-9/07_BACKUP_AND_RECOVERY.md) | tiered backup, RPO/RTO, integrity와 recovery tests | AVAILABLE |
| DOC-OPS-009 | [Disaster Recovery](book-9/08_DISASTER_RECOVERY.md) | scenarios, priorities, activation/workflow/validation | AVAILABLE |
| DOC-OPS-010 | [Business Continuity](book-9/09_BUSINESS_CONTINUITY.md) | critical service, manual/degraded operation와 recovery priority | AVAILABLE |
| DOC-OPS-011 | [Capacity and Scaling](book-9/10_CAPACITY_AND_SCALING.md) | workload assumptions, scaling, performance와 resource planning | AVAILABLE |
| DOC-OPS-012 | [Operational SLA/SLO](book-9/11_OPERATIONAL_SLA_SLO.md) | provisional availability/response/recovery targets와 indicators | AVAILABLE |
| DOC-OPS-013 | [Incident and Change Management](book-9/12_INCIDENT_AND_CHANGE_MANAGEMENT.md) | severity/escalation, change approval와 emergency change | AVAILABLE |
| DOC-OPS-014 | [Operation Security](book-9/13_OPERATION_SECURITY.md) | operational/admin/privileged access, audit와 compliance | AVAILABLE |
| DOC-OPS-015 | [Operation Registry](book-9/14_OPERATION_REGISTRY.md) | OPS-001–032 workflow/entity/API/UI/security mappings | AVAILABLE |
| DOC-OPS-016 | [Operation Checklist](book-9/15_OPERATION_CHECKLIST.md) | deployment/release/rollback/backup/recovery/monitoring/incident/security checklists | AVAILABLE |
| DOC-REVIEW-017 | [Phase 10 Completion](reviews/PHASE10_COMPLETION.md) | Deployment & Operations completion evidence와 Phase 11 gate | AVAILABLE |

## Book 10 — Test & Quality (Phase 11)

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-TEST-001 | [Test Architecture Index](book-10/00_TEST_ARCHITECTURE_INDEX.md) | Book 10 navigation, mandatory quality principles와 scope | AVAILABLE |
| DOC-TEST-002 | [Test Strategy](book-10/01_TEST_STRATEGY.md) | quality objectives, lifecycle, roles와 evidence | AVAILABLE |
| DOC-TEST-003 | [Requirement Traceability Matrix](book-10/02_REQUIREMENT_TRACEABILITY_MATRIX.md) | REQ-CONST-001–013 complete downstream/test mapping | AVAILABLE |
| DOC-TEST-004 | [Test Levels](book-10/03_TEST_LEVELS.md) | unit/integration/system/regression/UAT/operational/security/AI | AVAILABLE |
| DOC-TEST-005 | [Test Data Strategy](book-10/04_TEST_DATA_STRATEGY.md) | synthetic data, privacy, refresh와 isolation | AVAILABLE |
| DOC-TEST-006 | [Functional Tests](book-10/05_FUNCTIONAL_TESTS.md) | workflow/business/approval/publication/exception validation | AVAILABLE |
| DOC-TEST-007 | [AI Validation](book-10/06_AI_VALIDATION.md) | AI-001–007 evaluation, confidence와 human review | AVAILABLE |
| DOC-TEST-008 | [Security Tests](book-10/07_SECURITY_TESTS.md) | authentication/authorization/session/audit/privacy tests | AVAILABLE |
| DOC-TEST-009 | [Performance Tests](book-10/08_PERFORMANCE_TESTS.md) | search/matching/publication/jobs/scaling tests | AVAILABLE |
| DOC-TEST-010 | [Backup and Recovery Tests](book-10/09_BACKUP_AND_RECOVERY_TESTS.md) | backup/restore/integrity/recovery audit | AVAILABLE |
| DOC-TEST-011 | [Disaster Recovery Tests](book-10/10_DISASTER_RECOVERY_TESTS.md) | disaster/failover/recovery/continuity validation | AVAILABLE |
| DOC-TEST-012 | [UAT Strategy](book-10/11_UAT_STRATEGY.md) | persona/business acceptance와 sign-off | AVAILABLE |
| DOC-TEST-013 | [Release Acceptance](book-10/12_RELEASE_ACCEPTANCE.md) | checklist/gate/blocker/rollback acceptance | AVAILABLE |
| DOC-TEST-014 | [Defect Management](book-10/13_DEFECT_MANAGEMENT.md) | severity/priority/lifecycle/RCA/verification | AVAILABLE |
| DOC-TEST-015 | [Quality Metrics](book-10/14_QUALITY_METRICS.md) | coverage/pass/defect/AI/operations/business metrics | AVAILABLE |
| DOC-TEST-016 | [Test Registry](book-10/15_TEST_REGISTRY.md) | TEST-001–056 complete cross-phase mappings | AVAILABLE |
| DOC-REVIEW-018 | [Phase 11 Completion](reviews/PHASE11_COMPLETION.md) | Test & Quality completion evidence와 Phase 12 gate | AVAILABLE |

## Book 11 — Developer Bible (Phase 12)

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-DEV-001 | [Developer Bible Index](book-11/00_DEVELOPER_BIBLE_INDEX.md) | Book 11 navigation, mandatory principles와 scope | AVAILABLE |
| DOC-DEV-002 | [Development Principles](book-11/01_DEVELOPMENT_PRINCIPLES.md) | architecture/documentation/quality-first delivery | AVAILABLE |
| DOC-DEV-003 | [Repository Structure](book-11/02_REPOSITORY_STRUCTURE.md) | logical application/docs/tests/scripts/assets/config zones | AVAILABLE |
| DOC-DEV-004 | [Coding Standards](book-11/03_CODING_STANDARDS.md) | formatting, error, logging, dependency와 data rules | AVAILABLE |
| DOC-DEV-005 | [Naming Conventions](book-11/04_NAMING_CONVENTIONS.md) | file/folder/code/database/API identifier rules | AVAILABLE |
| DOC-DEV-006 | [Folder and Module Rules](book-11/05_FOLDER_AND_MODULE_RULES.md) | module boundaries, dependency direction와 isolation | AVAILABLE |
| DOC-DEV-007 | [Git Workflow](book-11/06_GIT_WORKFLOW.md) | commit, PR, review, merge와 emergency flow | AVAILABLE |
| DOC-DEV-008 | [Branching and Release](book-11/07_BRANCHING_AND_RELEASE.md) | branch classes, tagging와 version policy | AVAILABLE |
| DOC-DEV-009 | [Development Traceability](book-11/08_DEVELOPMENT_TRACEABILITY.md) | requirement-to-DEV-to-commit-to-test chain | AVAILABLE |
| DOC-DEV-010 | [Code Review Guide](book-11/09_CODE_REVIEW_GUIDE.md) | architecture/security/performance/maintainability review | AVAILABLE |
| DOC-DEV-011 | [Definition of Ready](book-11/10_DEFINITION_OF_READY.md) | development entry conditions와 rejection | AVAILABLE |
| DOC-DEV-012 | [Definition of Done — Development](book-11/11_DEFINITION_OF_DONE_DEVELOPMENT.md) | development exit conditions와 hard blockers | AVAILABLE |
| DOC-DEV-013 | [Technical Debt Policy](book-11/12_TECHNICAL_DEBT_POLICY.md) | debt classification, approval, resolution와 review | AVAILABLE |
| DOC-DEV-014 | [Documentation Rules](book-11/13_DOCUMENTATION_RULES.md) | implementation-linked documentation/version/link upkeep | AVAILABLE |
| DOC-DEV-015 | [Code Generation Policy](book-11/14_CODE_GENERATION_POLICY.md) | Codex/AI-assisted coding, human review와 ownership | AVAILABLE |
| DOC-DEV-016 | [Developer Registry](book-11/15_DEVELOPER_REGISTRY.md) | DEV-001–024 complete cross-phase logical work packages | AVAILABLE |
| DOC-REVIEW-019 | [Phase 12 Completion](reviews/PHASE12_COMPLETION.md) | Developer Bible completion evidence와 Phase 13 gate | AVAILABLE |

## Book 12 — Master Development Roadmap (Phase 13)

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-ROADMAP-001 | [Master Development Roadmap Index](book-12/00_MASTER_DEVELOPMENT_ROADMAP_INDEX.md) | Book 12 navigation, ID model와 scope | AVAILABLE |
| DOC-ROADMAP-002 | [Implementation Strategy](book-12/01_IMPLEMENTATION_STRATEGY.md) | architecture/risk/MVP/POST-MVP implementation strategy | AVAILABLE |
| DOC-ROADMAP-003 | [Epic Breakdown](book-12/02_EPIC_BREAKDOWN.md) | DEV-001–024를 EPIC-001–010에 배정 | AVAILABLE |
| DOC-ROADMAP-004 | [Feature Breakdown](book-12/03_FEATURE_BREAKDOWN.md) | FEAT-001–024 complete cross-layer mapping | AVAILABLE |
| DOC-ROADMAP-005 | [Development Sequence](book-12/04_DEVELOPMENT_SEQUENCE.md) | prerequisite-ordered implementation sequence | AVAILABLE |
| DOC-ROADMAP-006 | [Sprint Plan](book-12/05_SPRINT_PLAN.md) | date-free SP-000–010 logical plan | AVAILABLE |
| DOC-ROADMAP-007 | [Release Plan](book-12/06_RELEASE_PLAN.md) | MVP/Beta/RC/Production/POST-MVP gates | AVAILABLE |
| DOC-ROADMAP-008 | [Dependency Matrix](book-12/07_DEPENDENCY_MATRIX.md) | DEV/Epic/module/risk dependencies | AVAILABLE |
| DOC-ROADMAP-009 | [Implementation Traceability](book-12/08_IMPLEMENTATION_TRACEABILITY.md) | requirement-to-release-to-test chain | AVAILABLE |
| DOC-ROADMAP-010 | [Development Risk Register](book-12/09_DEVELOPMENT_RISK_REGISTER.md) | RISK-DEV-001–012와 mitigation | AVAILABLE |
| DOC-ROADMAP-011 | [Migration Strategy](book-12/10_MIGRATION_STRATEGY.md) | legacy/data/feature migration와 rollback | AVAILABLE |
| DOC-ROADMAP-012 | [Cutover Strategy](book-12/11_CUTOVER_STRATEGY.md) | go-live phases, stop/rollback와 communication | AVAILABLE |
| DOC-ROADMAP-013 | [Go-Live Checklist](book-12/12_GO_LIVE_CHECKLIST.md) | architecture/data/security/operations/test/doc/approval gate | AVAILABLE |
| DOC-ROADMAP-014 | [Post-Go-Live Plan](book-12/13_POST_GO_LIVE_PLAN.md) | monitoring, hypercare, issue와 improvement | AVAILABLE |
| DOC-ROADMAP-015 | [Release Registry](book-12/14_RELEASE_REGISTRY.md) | REL-001–005 complete release mappings | AVAILABLE |
| DOC-ROADMAP-016 | [Implementation Registry](book-12/15_IMPLEMENTATION_REGISTRY.md) | IMP-001–024 complete roadmap trace | AVAILABLE |
| DOC-REVIEW-020 | [Phase 13 Completion](reviews/PHASE13_COMPLETION.md) | roadmap completion evidence와 next review gate | AVAILABLE |

## Phase 14 — Architecture Review

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-REVIEW-021 | [Phase 14 Architecture Review](reviews/PHASE14_ARCHITECTURE_REVIEW.md) | final pre-freeze consistency, quality와 readiness assessment | AVAILABLE |
| DOC-REVIEW-022 | [Phase 14 Findings](reviews/PHASE14_FINDINGS.md) | critical/major/minor findings와 evidence | AVAILABLE |
| DOC-REVIEW-023 | [Phase 14 Recommendations](reviews/PHASE14_RECOMMENDATIONS.md) | corrections와 DEC/CR/ADR/assumption/planned disposition | AVAILABLE |
| DOC-REVIEW-024 | [Phase 14 Action Items](reviews/PHASE14_ACTION_ITEMS.md) | Phase 15 correction-only action register | AVAILABLE |
| DOC-REVIEW-025 | [Phase 14 Completion](reviews/PHASE14_COMPLETION.md) | review completion evidence와 Phase 15 gate | AVAILABLE |

## Phase 15 — Architecture Corrections

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-REVIEW-026 | [Phase 15 Correction Report](reviews/PHASE15_CORRECTION_REPORT.md) | ACT-14-001–012 resolution과 affected-document evidence | AVAILABLE |
| DOC-REVIEW-027 | [Phase 15 Validation Report](reviews/PHASE15_VALIDATION_REPORT.md) | ID/link/status/registry/trace/no-code validation evidence | AVAILABLE |
| DOC-REVIEW-028 | [Phase 15 Completion](reviews/PHASE15_COMPLETION.md) | correction completion과 Phase 16 recommendation | AVAILABLE |

## Phase 16 — Architecture Freeze v1.0

| Document ID | 문서 | 목적 | 존재 상태 |
|---|---|---|---|
| DOC-FREEZE-001 | [Freeze Manifest v1.0](freeze/FREEZE_MANIFEST_V1.md) | frozen baseline statistics, approval와 readiness manifest | AVAILABLE |
| DOC-FREEZE-002 | [Freeze Summary](freeze/FREEZE_SUMMARY.md) | architecture domain별 v1.0 summary | AVAILABLE |
| DOC-FREEZE-003 | [Freeze Changelog](freeze/FREEZE_CHANGELOG.md) | Phase 0–15 major change history | AVAILABLE |
| DOC-FREEZE-004 | [Freeze Document Registry](freeze/FREEZE_DOCUMENT_REGISTRY.md) | every registered document의 version/status/owner snapshot | AVAILABLE |
| DOC-FREEZE-005 | [Freeze Traceability Report](freeze/FREEZE_TRACEABILITY_REPORT.md) | canonical coverage와 zero-orphan freeze evidence | AVAILABLE |
| DOC-FREEZE-006 | [Freeze Decision Summary](freeze/FREEZE_DECISION_SUMMARY.md) | ADR/DEC/CR/ASM status와 blocking effect snapshot | AVAILABLE |
| DOC-FREEZE-007 | [Freeze Known Open Items](freeze/FREEZE_KNOWN_OPEN_ITEMS.md) | approved open decisions/assumptions/future/POST-MVP snapshot | AVAILABLE |
| DOC-FREEZE-008 | [Freeze Baseline](freeze/FREEZE_BASELINE.md) | v1.0 declaration, scope, freeze/change policy | AVAILABLE |
| DOC-REVIEW-029 | [Phase 16 Freeze Validation](reviews/PHASE16_FREEZE_VALIDATION.md) | file/ID/link/status/trace/registry/no-code validation | AVAILABLE |
| DOC-REVIEW-030 | [Phase 16 Completion](reviews/PHASE16_COMPLETION.md) | freeze completion and Phase 17 gate | AVAILABLE |

## Canonical Document ID registry

이 표는 [Document ID Rule](00_DOCUMENT_ID_RULE.md)에 따른 현재 문서 ID의 source of truth다. Phase 15에서 legacy A0 header를 포함한 모든 registered file의 metadata ID를 이 registry와 동기화했다.

| Document ID | 문서 | 경로/링크 |
|---|---|---|
| DOC-CORE-001 | Master Index | [00_MASTER_INDEX.md](00_MASTER_INDEX.md) |
| DOC-CORE-002 | Project README | [README.md](../README.md) |
| DOC-CORE-003 | Codex Working Rules | [AGENTS.md](../AGENTS.md) |
| DOC-CORE-004 | Codex Documentation Brief Master Set | [AI_MLS_CODEX_DOCUMENTATION_BRIEFS.md](../AI_MLS_CODEX_DOCUMENTATION_BRIEFS.md) |
| DOC-CORE-005 | Document Governance | [00_DOCUMENT_GOVERNANCE.md](00_DOCUMENT_GOVERNANCE.md) |
| DOC-CORE-006 | Glossary | [00_GLOSSARY.md](00_GLOSSARY.md) |
| DOC-CORE-007 | Version History | [00_VERSION_HISTORY.md](00_VERSION_HISTORY.md) |
| DOC-CORE-008 | ADR Workflow | [adr/README.md](adr/README.md) |
| DOC-CORE-009 | Review Workspace | [reviews/README.md](reviews/README.md) |
| DOC-CORE-010 | ADR Template | [ADR_TEMPLATE.md](templates/ADR_TEMPLATE.md) |
| DOC-CORE-011 | Review Template | [REVIEW_TEMPLATE.md](templates/REVIEW_TEMPLATE.md) |
| DOC-CORE-012 | Phase Completion Template | [PHASE_COMPLETION_TEMPLATE.md](templates/PHASE_COMPLETION_TEMPLATE.md) |
| DOC-CORE-013 | Risk Register | [00_RISK_REGISTER.md](00_RISK_REGISTER.md) |
| DOC-CORE-014 | Assumption Register | [00_ASSUMPTION_REGISTER.md](00_ASSUMPTION_REGISTER.md) |
| DOC-CORE-015 | Naming Convention | [00_NAMING_CONVENTION.md](00_NAMING_CONVENTION.md) |
| DOC-CORE-016 | Document ID Rule | [00_DOCUMENT_ID_RULE.md](00_DOCUMENT_ID_RULE.md) |
| DOC-CORE-017 | Mermaid Style Guide | [00_MERMAID_STYLE_GUIDE.md](00_MERMAID_STYLE_GUIDE.md) |
| DOC-CORE-018 | Review Checklist | [00_REVIEW_CHECKLIST.md](00_REVIEW_CHECKLIST.md) |
| DOC-CORE-019 | Traceability Rule | [00_TRACEABILITY_RULE.md](00_TRACEABILITY_RULE.md) |
| DOC-CORE-020 | Decision Register | [00_DECISION_REGISTER.md](00_DECISION_REGISTER.md) |
| DOC-CORE-021 | Change Request Register | [00_CHANGE_REQUEST_REGISTER.md](00_CHANGE_REQUEST_REGISTER.md) |
| DOC-CORE-022 | Architecture Review Board | [00_ARCHITECTURE_REVIEW_BOARD.md](00_ARCHITECTURE_REVIEW_BOARD.md) |
| DOC-CORE-023 | Release Policy | [00_RELEASE_POLICY.md](00_RELEASE_POLICY.md) |
| DOC-CORE-024 | Document Lifecycle | [00_DOCUMENT_LIFECYCLE.md](00_DOCUMENT_LIFECYCLE.md) |
| DOC-CORE-025 | Approval Workflow | [00_APPROVAL_WORKFLOW.md](00_APPROVAL_WORKFLOW.md) |
| DOC-CORE-026 | Project Constitution | [00_PROJECT_CONSTITUTION.md](book-0/00_PROJECT_CONSTITUTION.md) |
| DOC-CORE-027 | Mission, Vision, and Values | [01_MISSION_VISION_VALUES.md](book-0/01_MISSION_VISION_VALUES.md) |
| DOC-CORE-028 | Product Principles | [02_PRODUCT_PRINCIPLES.md](book-0/02_PRODUCT_PRINCIPLES.md) |
| DOC-CORE-029 | AI Principles | [03_AI_PRINCIPLES.md](book-0/03_AI_PRINCIPLES.md) |
| DOC-CORE-030 | Data Principles | [04_DATA_PRINCIPLES.md](book-0/04_DATA_PRINCIPLES.md) |
| DOC-CORE-031 | Security and Privacy Principles | [05_SECURITY_PRIVACY_PRINCIPLES.md](book-0/05_SECURITY_PRIVACY_PRINCIPLES.md) |
| DOC-CORE-032 | Development Principles | [06_DEVELOPMENT_PRINCIPLES.md](book-0/06_DEVELOPMENT_PRINCIPLES.md) |
| DOC-CORE-033 | Decision Rules | [07_DECISION_RULES.md](book-0/07_DECISION_RULES.md) |
| DOC-CORE-034 | Definition of Done | [08_DEFINITION_OF_DONE.md](book-0/08_DEFINITION_OF_DONE.md) |
| DOC-CORE-035 | Canonical Traceability Matrix | [00_CANONICAL_TRACEABILITY_MATRIX.md](00_CANONICAL_TRACEABILITY_MATRIX.md) |
| DOC-CORE-036 | Decision Index | [00_DECISION_INDEX.md](00_DECISION_INDEX.md) |
| DOC-CORE-037 | Decision Dependency Matrix | [00_DECISION_DEPENDENCY_MATRIX.md](00_DECISION_DEPENDENCY_MATRIX.md) |
| DOC-CORE-038 | Decision Trace Matrix | [00_DECISION_TRACE_MATRIX.md](00_DECISION_TRACE_MATRIX.md) |
| DOC-CORE-039 | Requirement Index | [00_REQUIREMENT_INDEX.md](00_REQUIREMENT_INDEX.md) |
| DOC-CORE-040 | Canonical Publication Registry | [00_PUBLICATION_REGISTRY.md](00_PUBLICATION_REGISTRY.md) |
| DOC-CORE-041 | Publication Index | [00_PUBLICATION_INDEX.md](00_PUBLICATION_INDEX.md) |
| DOC-CORE-042 | Canonical Workflow Registry | [00_WORKFLOW_REGISTRY.md](00_WORKFLOW_REGISTRY.md) |
| DOC-CORE-043 | Workflow Index | [00_WORKFLOW_INDEX.md](00_WORKFLOW_INDEX.md) |
| DOC-CORE-044 | Canonical API Registry | [00_API_REGISTRY.md](00_API_REGISTRY.md) |
| DOC-CORE-045 | API Index | [00_API_INDEX.md](00_API_INDEX.md) |
| DOC-CORE-046 | Canonical Security Registry | [00_SECURITY_REGISTRY.md](00_SECURITY_REGISTRY.md) |
| DOC-CORE-047 | Security Index | [00_SECURITY_INDEX.md](00_SECURITY_INDEX.md) |
| DOC-CORE-048 | Canonical Projection Registry | [00_PROJECTION_REGISTRY.md](00_PROJECTION_REGISTRY.md) |
| DOC-CORE-049 | Projection Index | [00_PROJECTION_INDEX.md](00_PROJECTION_INDEX.md) |
| DOC-CORE-050 | Canonical Event Registry | [00_EVENT_REGISTRY.md](00_EVENT_REGISTRY.md) |
| DOC-CORE-051 | Event Index | [00_EVENT_INDEX.md](00_EVENT_INDEX.md) |
| DOC-CORE-052 | Operations Registry Alignment Candidate | [00_OPERATIONS_REGISTRY.md](00_OPERATIONS_REGISTRY.md) |
| DOC-CORE-053 | Operations Index | [00_OPERATIONS_INDEX.md](00_OPERATIONS_INDEX.md) |
| DOC-CORE-054 | Canonical Test Registry Alignment Candidate | [00_TEST_REGISTRY.md](00_TEST_REGISTRY.md) |
| DOC-CORE-055 | Test Index | [00_TEST_INDEX.md](00_TEST_INDEX.md) |
| DOC-BIZ-001 | Business Strategy Index | [00_BUSINESS_STRATEGY_INDEX.md](book-1/00_BUSINESS_STRATEGY_INDEX.md) |
| DOC-BIZ-002 | Problem Statement | [01_PROBLEM_STATEMENT.md](book-1/01_PROBLEM_STATEMENT.md) |
| DOC-BIZ-003 | Current Workflow Analysis | [02_CURRENT_WORKFLOW_ANALYSIS.md](book-1/02_CURRENT_WORKFLOW_ANALYSIS.md) |
| DOC-BIZ-004 | Target Users and Personas | [03_TARGET_USERS_AND_PERSONAS.md](book-1/03_TARGET_USERS_AND_PERSONAS.md) |
| DOC-BIZ-005 | Value Proposition | [04_VALUE_PROPOSITION.md](book-1/04_VALUE_PROPOSITION.md) |
| DOC-BIZ-006 | US MLS Comparison | [05_US_MLS_COMPARISON.md](book-1/05_US_MLS_COMPARISON.md) |
| DOC-BIZ-007 | Philippine Market Context | [06_PHILIPPINE_MARKET_CONTEXT.md](book-1/06_PHILIPPINE_MARKET_CONTEXT.md) |
| DOC-BIZ-008 | Business Model | [07_BUSINESS_MODEL.md](book-1/07_BUSINESS_MODEL.md) |
| DOC-BIZ-009 | Product Scope and Non-Goals | [08_PRODUCT_SCOPE_AND_NON_GOALS.md](book-1/08_PRODUCT_SCOPE_AND_NON_GOALS.md) |
| DOC-BIZ-010 | Success Metrics | [09_SUCCESS_METRICS.md](book-1/09_SUCCESS_METRICS.md) |
| DOC-BIZ-011 | Long-Term Roadmap | [10_LONG_TERM_ROADMAP.md](book-1/10_LONG_TERM_ROADMAP.md) |
| DOC-ARCH-001 | Architecture Index | [00_ARCHITECTURE_INDEX.md](book-2/00_ARCHITECTURE_INDEX.md) |
| DOC-ARCH-002 | System Overview | [01_SYSTEM_OVERVIEW.md](book-2/01_SYSTEM_OVERVIEW.md) |
| DOC-ARCH-003 | Context Architecture | [02_CONTEXT_ARCHITECTURE.md](book-2/02_CONTEXT_ARCHITECTURE.md) |
| DOC-ARCH-004 | Container Architecture | [03_CONTAINER_ARCHITECTURE.md](book-2/03_CONTAINER_ARCHITECTURE.md) |
| DOC-ARCH-005 | Module Architecture | [04_MODULE_ARCHITECTURE.md](book-2/04_MODULE_ARCHITECTURE.md) |
| DOC-ARCH-006 | Data Flow Architecture | [05_DATA_FLOW_ARCHITECTURE.md](book-2/05_DATA_FLOW_ARCHITECTURE.md) |
| DOC-ARCH-007 | Event and Job Architecture | [06_EVENT_AND_JOB_ARCHITECTURE.md](book-2/06_EVENT_AND_JOB_ARCHITECTURE.md) |
| DOC-ARCH-008 | Integration Architecture | [07_INTEGRATION_ARCHITECTURE.md](book-2/07_INTEGRATION_ARCHITECTURE.md) |
| DOC-ARCH-009 | Failure Isolation | [08_FAILURE_ISOLATION.md](book-2/08_FAILURE_ISOLATION.md) |
| DOC-ARCH-010 | Scalability Strategy | [09_SCALABILITY_STRATEGY.md](book-2/09_SCALABILITY_STRATEGY.md) |
| DOC-ARCH-011 | Architecture Decisions | [10_ARCHITECTURE_DECISIONS.md](book-2/10_ARCHITECTURE_DECISIONS.md) |
| DOC-DATA-001 | Database Architecture Index | [00_DATABASE_ARCHITECTURE_INDEX.md](book-3/00_DATABASE_ARCHITECTURE_INDEX.md) |
| DOC-DATA-002 | Data Domain Model | [01_DATA_DOMAIN_MODEL.md](book-3/01_DATA_DOMAIN_MODEL.md) |
| DOC-DATA-003 | Entity Relationship Model | [02_ENTITY_RELATIONSHIP_MODEL.md](book-3/02_ENTITY_RELATIONSHIP_MODEL.md) |
| DOC-DATA-004 | Database Standards | [03_DATABASE_STANDARDS.md](book-3/03_DATABASE_STANDARDS.md) |
| DOC-DATA-005 | Source and Raw Data Model | [04_SOURCE_AND_RAW_DATA_MODEL.md](book-3/04_SOURCE_AND_RAW_DATA_MODEL.md) |
| DOC-DATA-006 | Property Master Model | [05_PROPERTY_MASTER_MODEL.md](book-3/05_PROPERTY_MASTER_MODEL.md) |
| DOC-DATA-007 | Candidate and Offer Model | [06_CANDIDATE_AND_OFFER_MODEL.md](book-3/06_CANDIDATE_AND_OFFER_MODEL.md) |
| DOC-DATA-008 | Contact Model | [07_CONTACT_MODEL.md](book-3/07_CONTACT_MODEL.md) |
| DOC-DATA-009 | Client and Requirement Model | [08_CLIENT_AND_REQUIREMENT_MODEL.md](book-3/08_CLIENT_AND_REQUIREMENT_MODEL.md) |
| DOC-DATA-010 | Matching Model | [09_MATCHING_MODEL.md](book-3/09_MATCHING_MODEL.md) |
| DOC-DATA-011 | Verification and Permission Model | [10_VERIFICATION_AND_PERMISSION_MODEL.md](book-3/10_VERIFICATION_AND_PERMISSION_MODEL.md) |
| DOC-DATA-012 | Publication Model | [11_PUBLICATION_MODEL.md](book-3/11_PUBLICATION_MODEL.md) |
| DOC-DATA-013 | Audit and History Model | [12_AUDIT_AND_HISTORY_MODEL.md](book-3/12_AUDIT_AND_HISTORY_MODEL.md) |
| DOC-DATA-014 | Retention and Deletion Model | [13_RETENTION_AND_DELETION_MODEL.md](book-3/13_RETENTION_AND_DELETION_MODEL.md) |
| DOC-DATA-015 | Indexing and Search Strategy | [14_INDEXING_AND_SEARCH_STRATEGY.md](book-3/14_INDEXING_AND_SEARCH_STRATEGY.md) |
| DOC-DATA-016 | Data Dictionary | [15_DATA_DICTIONARY.md](book-3/15_DATA_DICTIONARY.md) |
| DOC-AI-001 | AI Architecture Index | [00_AI_ARCHITECTURE_INDEX.md](book-4/00_AI_ARCHITECTURE_INDEX.md) |
| DOC-AI-002 | AI Overview | [01_AI_OVERVIEW.md](book-4/01_AI_OVERVIEW.md) |
| DOC-AI-003 | AI Boundaries | [02_AI_BOUNDARIES.md](book-4/02_AI_BOUNDARIES.md) |
| DOC-AI-004 | Provider Abstraction | [03_PROVIDER_ABSTRACTION.md](book-4/03_PROVIDER_ABSTRACTION.md) |
| DOC-AI-005 | Listing Parser | [04_LISTING_PARSER.md](book-4/04_LISTING_PARSER.md) |
| DOC-AI-006 | Property Normalization | [05_PROPERTY_NORMALIZATION.md](book-4/05_PROPERTY_NORMALIZATION.md) |
| DOC-AI-007 | Duplicate Detection | [06_DUPLICATE_DETECTION.md](book-4/06_DUPLICATE_DETECTION.md) |
| DOC-AI-008 | Requirement Parser | [07_REQUIREMENT_PARSER.md](book-4/07_REQUIREMENT_PARSER.md) |
| DOC-AI-009 | Matching and Ranking | [08_MATCHING_AND_RANKING.md](book-4/08_MATCHING_AND_RANKING.md) |
| DOC-AI-010 | Natural Language Search | [09_NATURAL_LANGUAGE_SEARCH.md](book-4/09_NATURAL_LANGUAGE_SEARCH.md) |
| DOC-AI-011 | Confidence and Validation | [10_CONFIDENCE_AND_VALIDATION.md](book-4/10_CONFIDENCE_AND_VALIDATION.md) |
| DOC-AI-012 | Human Review | [11_HUMAN_REVIEW.md](book-4/11_HUMAN_REVIEW.md) |
| DOC-AI-013 | Prompt Governance | [12_PROMPT_GOVERNANCE.md](book-4/12_PROMPT_GOVERNANCE.md) |
| DOC-AI-014 | AI Observability | [13_AI_OBSERVABILITY.md](book-4/13_AI_OBSERVABILITY.md) |
| DOC-AI-015 | AI Output Schemas | [14_AI_OUTPUT_SCHEMAS.md](book-4/14_AI_OUTPUT_SCHEMAS.md) |
| DOC-AI-016 | AI Prompt Library Guide | [15_AI_PROMPT_LIBRARY_GUIDE.md](book-4/15_AI_PROMPT_LIBRARY_GUIDE.md) |
| DOC-WF-001 | Workflow Index | [00_WORKFLOW_INDEX.md](book-5/00_WORKFLOW_INDEX.md) |
| DOC-WF-002 | Listing Discovery Workflow | [01_LISTING_DISCOVERY_WORKFLOW.md](book-5/01_LISTING_DISCOVERY_WORKFLOW.md) |
| DOC-WF-003 | Manual Intake Workflow | [02_MANUAL_INTAKE_WORKFLOW.md](book-5/02_MANUAL_INTAKE_WORKFLOW.md) |
| DOC-WF-004 | AI Processing Workflow | [03_AI_PROCESSING_WORKFLOW.md](book-5/03_AI_PROCESSING_WORKFLOW.md) |
| DOC-WF-005 | Duplicate Review Workflow | [04_DUPLICATE_REVIEW_WORKFLOW.md](book-5/04_DUPLICATE_REVIEW_WORKFLOW.md) |
| DOC-WF-006 | Client Requirement Workflow | [05_CLIENT_REQUIREMENT_WORKFLOW.md](book-5/05_CLIENT_REQUIREMENT_WORKFLOW.md) |
| DOC-WF-007 | Matching Workflow | [06_MATCHING_WORKFLOW.md](book-5/06_MATCHING_WORKFLOW.md) |
| DOC-WF-008 | Contact and Verification Workflow | [07_CONTACT_AND_VERIFICATION_WORKFLOW.md](book-5/07_CONTACT_AND_VERIFICATION_WORKFLOW.md) |
| DOC-WF-009 | Client Proposal Workflow | [08_CLIENT_PROPOSAL_WORKFLOW.md](book-5/08_CLIENT_PROPOSAL_WORKFLOW.md) |
| DOC-WF-010 | Publication Approval Workflow | [09_PUBLICATION_APPROVAL_WORKFLOW.md](book-5/09_PUBLICATION_APPROVAL_WORKFLOW.md) |
| DOC-WF-011 | Publication Workflow | [10_PUBLICATION_WORKFLOW.md](book-5/10_PUBLICATION_WORKFLOW.md) |
| DOC-WF-012 | Expiration and Reverification Workflow | [11_EXPIRATION_AND_REVERIFICATION_WORKFLOW.md](book-5/11_EXPIRATION_AND_REVERIFICATION_WORKFLOW.md) |
| DOC-WF-013 | Exception and Recovery Workflow | [12_EXCEPTION_AND_RECOVERY_WORKFLOW.md](book-5/12_EXCEPTION_AND_RECOVERY_WORKFLOW.md) |
| DOC-WF-014 | Workflow Status Dictionary | [13_STATUS_DICTIONARY.md](book-5/13_STATUS_DICTIONARY.md) |
| DOC-WF-015 | Workflow State Transition Rules | [14_STATE_TRANSITION_RULES.md](book-5/14_STATE_TRANSITION_RULES.md) |
| DOC-API-001 | API Architecture Index | [00_API_ARCHITECTURE_INDEX.md](book-6/00_API_ARCHITECTURE_INDEX.md) |
| DOC-API-002 | API Principles | [01_API_PRINCIPLES.md](book-6/01_API_PRINCIPLES.md) |
| DOC-API-003 | Authentication API | [02_AUTHENTICATION_API.md](book-6/02_AUTHENTICATION_API.md) |
| DOC-API-004 | Source and Intake API | [03_SOURCE_AND_INTAKE_API.md](book-6/03_SOURCE_AND_INTAKE_API.md) |
| DOC-API-005 | Property and Listing API | [04_PROPERTY_AND_LISTING_API.md](book-6/04_PROPERTY_AND_LISTING_API.md) |
| DOC-API-006 | Contact API | [05_CONTACT_API.md](book-6/05_CONTACT_API.md) |
| DOC-API-007 | Client and Requirement API | [06_CLIENT_AND_REQUIREMENT_API.md](book-6/06_CLIENT_AND_REQUIREMENT_API.md) |
| DOC-API-008 | Matching API | [07_MATCHING_API.md](book-6/07_MATCHING_API.md) |
| DOC-API-009 | Verification API | [08_VERIFICATION_API.md](book-6/08_VERIFICATION_API.md) |
| DOC-API-010 | Publication API | [09_PUBLICATION_API.md](book-6/09_PUBLICATION_API.md) |
| DOC-API-011 | Admin and Audit API | [10_ADMIN_AND_AUDIT_API.md](book-6/10_ADMIN_AND_AUDIT_API.md) |
| DOC-API-012 | Background Job Contracts | [11_BACKGROUND_JOB_CONTRACTS.md](book-6/11_BACKGROUND_JOB_CONTRACTS.md) |
| DOC-API-013 | Connector Contracts | [12_CONNECTOR_CONTRACTS.md](book-6/12_CONNECTOR_CONTRACTS.md) |
| DOC-API-014 | External Integration | [13_EXTERNAL_INTEGRATION.md](book-6/13_EXTERNAL_INTEGRATION.md) |
| DOC-API-015 | API Error Standard | [14_API_ERROR_STANDARD.md](book-6/14_API_ERROR_STANDARD.md) |
| DOC-API-016 | API Versioning | [15_API_VERSIONING.md](book-6/15_API_VERSIONING.md) |
| DOC-API-017 | API Registry | [16_API_REGISTRY.md](book-6/16_API_REGISTRY.md) |
| DOC-UI-001 | UI/UX Architecture Index | [00_UI_ARCHITECTURE_INDEX.md](book-7/00_UI_ARCHITECTURE_INDEX.md) |
| DOC-UI-002 | Information Architecture | [01_INFORMATION_ARCHITECTURE.md](book-7/01_INFORMATION_ARCHITECTURE.md) |
| DOC-UI-003 | Navigation Structure | [02_NAVIGATION_STRUCTURE.md](book-7/02_NAVIGATION_STRUCTURE.md) |
| DOC-UI-004 | User Roles and Dashboards | [03_USER_ROLES_AND_DASHBOARDS.md](book-7/03_USER_ROLES_AND_DASHBOARDS.md) |
| DOC-UI-005 | Screen Catalog | [04_SCREEN_CATALOG.md](book-7/04_SCREEN_CATALOG.md) |
| DOC-UI-006 | Screen Specifications | [05_SCREEN_SPECIFICATIONS.md](book-7/05_SCREEN_SPECIFICATIONS.md) |
| DOC-UI-007 | Form Standard | [06_FORM_STANDARD.md](book-7/06_FORM_STANDARD.md) |
| DOC-UI-008 | Search and Filter Standard | [07_SEARCH_AND_FILTER_STANDARD.md](book-7/07_SEARCH_AND_FILTER_STANDARD.md) |
| DOC-UI-009 | Table and List Standard | [08_TABLE_AND_LIST_STANDARD.md](book-7/08_TABLE_AND_LIST_STANDARD.md) |
| DOC-UI-010 | Notification and Feedback | [09_NOTIFICATION_AND_FEEDBACK.md](book-7/09_NOTIFICATION_AND_FEEDBACK.md) |
| DOC-UI-011 | Design System Guide | [10_DESIGN_SYSTEM_GUIDE.md](book-7/10_DESIGN_SYSTEM_GUIDE.md) |
| DOC-UI-012 | Responsive Strategy | [11_RESPONSIVE_STRATEGY.md](book-7/11_RESPONSIVE_STRATEGY.md) |
| DOC-UI-013 | Accessibility Guide | [12_ACCESSIBILITY_GUIDE.md](book-7/12_ACCESSIBILITY_GUIDE.md) |
| DOC-UI-014 | Error and Empty State | [13_ERROR_AND_EMPTY_STATE.md](book-7/13_ERROR_AND_EMPTY_STATE.md) |
| DOC-UI-015 | UI State Model | [14_UI_STATE_MODEL.md](book-7/14_UI_STATE_MODEL.md) |
| DOC-UI-016 | Screen Registry | [15_SCREEN_REGISTRY.md](book-7/15_SCREEN_REGISTRY.md) |
| DOC-SEC-001 | Security Architecture Index | [00_SECURITY_ARCHITECTURE_INDEX.md](book-8/00_SECURITY_ARCHITECTURE_INDEX.md) |
| DOC-SEC-002 | Security Principles | [01_SECURITY_PRINCIPLES.md](book-8/01_SECURITY_PRINCIPLES.md) |
| DOC-SEC-003 | Identity and Authentication | [02_IDENTITY_AND_AUTHENTICATION.md](book-8/02_IDENTITY_AND_AUTHENTICATION.md) |
| DOC-SEC-004 | Authorization Model | [03_AUTHORIZATION_MODEL.md](book-8/03_AUTHORIZATION_MODEL.md) |
| DOC-SEC-005 | Permission Matrix | [04_PERMISSION_MATRIX.md](book-8/04_PERMISSION_MATRIX.md) |
| DOC-SEC-006 | Data Classification | [05_DATA_CLASSIFICATION.md](book-8/05_DATA_CLASSIFICATION.md) |
| DOC-SEC-007 | Privacy Model | [06_PRIVACY_MODEL.md](book-8/06_PRIVACY_MODEL.md) |
| DOC-SEC-008 | Audit and Compliance | [07_AUDIT_AND_COMPLIANCE.md](book-8/07_AUDIT_AND_COMPLIANCE.md) |
| DOC-SEC-009 | Encryption and Key Management | [08_ENCRYPTION_AND_KEY_MANAGEMENT.md](book-8/08_ENCRYPTION_AND_KEY_MANAGEMENT.md) |
| DOC-SEC-010 | Session and Access Control | [09_SESSION_AND_ACCESS_CONTROL.md](book-8/09_SESSION_AND_ACCESS_CONTROL.md) |
| DOC-SEC-011 | Security Event Model | [10_SECURITY_EVENT_MODEL.md](book-8/10_SECURITY_EVENT_MODEL.md) |
| DOC-SEC-012 | Threat Model | [11_THREAT_MODEL.md](book-8/11_THREAT_MODEL.md) |
| DOC-SEC-013 | Security Logging | [12_SECURITY_LOGGING.md](book-8/12_SECURITY_LOGGING.md) |
| DOC-SEC-014 | Incident Response | [13_INCIDENT_RESPONSE.md](book-8/13_INCIDENT_RESPONSE.md) |
| DOC-SEC-015 | Backup and Recovery Security | [14_BACKUP_AND_RECOVERY_SECURITY.md](book-8/14_BACKUP_AND_RECOVERY_SECURITY.md) |
| DOC-SEC-016 | Security Registry | [15_SECURITY_REGISTRY.md](book-8/15_SECURITY_REGISTRY.md) |
| DOC-OPS-001 | Deployment & Operations Index | [00_DEPLOYMENT_OPERATIONS_INDEX.md](book-9/00_DEPLOYMENT_OPERATIONS_INDEX.md) |
| DOC-OPS-002 | Deployment Architecture | [01_DEPLOYMENT_ARCHITECTURE.md](book-9/01_DEPLOYMENT_ARCHITECTURE.md) |
| DOC-OPS-003 | Environment Strategy | [02_ENVIRONMENT_STRATEGY.md](book-9/02_ENVIRONMENT_STRATEGY.md) |
| DOC-OPS-004 | Configuration Management | [03_CONFIGURATION_MANAGEMENT.md](book-9/03_CONFIGURATION_MANAGEMENT.md) |
| DOC-OPS-005 | Release Management | [04_RELEASE_MANAGEMENT.md](book-9/04_RELEASE_MANAGEMENT.md) |
| DOC-OPS-006 | Operation Runbook | [05_OPERATION_RUNBOOK.md](book-9/05_OPERATION_RUNBOOK.md) |
| DOC-OPS-007 | Monitoring and Observability | [06_MONITORING_AND_OBSERVABILITY.md](book-9/06_MONITORING_AND_OBSERVABILITY.md) |
| DOC-OPS-008 | Backup and Recovery | [07_BACKUP_AND_RECOVERY.md](book-9/07_BACKUP_AND_RECOVERY.md) |
| DOC-OPS-009 | Disaster Recovery | [08_DISASTER_RECOVERY.md](book-9/08_DISASTER_RECOVERY.md) |
| DOC-OPS-010 | Business Continuity | [09_BUSINESS_CONTINUITY.md](book-9/09_BUSINESS_CONTINUITY.md) |
| DOC-OPS-011 | Capacity and Scaling | [10_CAPACITY_AND_SCALING.md](book-9/10_CAPACITY_AND_SCALING.md) |
| DOC-OPS-012 | Operational SLA/SLO | [11_OPERATIONAL_SLA_SLO.md](book-9/11_OPERATIONAL_SLA_SLO.md) |
| DOC-OPS-013 | Incident and Change Management | [12_INCIDENT_AND_CHANGE_MANAGEMENT.md](book-9/12_INCIDENT_AND_CHANGE_MANAGEMENT.md) |
| DOC-OPS-014 | Operation Security | [13_OPERATION_SECURITY.md](book-9/13_OPERATION_SECURITY.md) |
| DOC-OPS-015 | Operation Registry | [14_OPERATION_REGISTRY.md](book-9/14_OPERATION_REGISTRY.md) |
| DOC-OPS-016 | Operation Checklist | [15_OPERATION_CHECKLIST.md](book-9/15_OPERATION_CHECKLIST.md) |
| DOC-TEST-001 | Test Architecture Index | [00_TEST_ARCHITECTURE_INDEX.md](book-10/00_TEST_ARCHITECTURE_INDEX.md) |
| DOC-TEST-002 | Test Strategy | [01_TEST_STRATEGY.md](book-10/01_TEST_STRATEGY.md) |
| DOC-TEST-003 | Requirement Traceability Matrix | [02_REQUIREMENT_TRACEABILITY_MATRIX.md](book-10/02_REQUIREMENT_TRACEABILITY_MATRIX.md) |
| DOC-TEST-004 | Test Levels | [03_TEST_LEVELS.md](book-10/03_TEST_LEVELS.md) |
| DOC-TEST-005 | Test Data Strategy | [04_TEST_DATA_STRATEGY.md](book-10/04_TEST_DATA_STRATEGY.md) |
| DOC-TEST-006 | Functional Tests | [05_FUNCTIONAL_TESTS.md](book-10/05_FUNCTIONAL_TESTS.md) |
| DOC-TEST-007 | AI Validation | [06_AI_VALIDATION.md](book-10/06_AI_VALIDATION.md) |
| DOC-TEST-008 | Security Tests | [07_SECURITY_TESTS.md](book-10/07_SECURITY_TESTS.md) |
| DOC-TEST-009 | Performance Tests | [08_PERFORMANCE_TESTS.md](book-10/08_PERFORMANCE_TESTS.md) |
| DOC-TEST-010 | Backup and Recovery Tests | [09_BACKUP_AND_RECOVERY_TESTS.md](book-10/09_BACKUP_AND_RECOVERY_TESTS.md) |
| DOC-TEST-011 | Disaster Recovery Tests | [10_DISASTER_RECOVERY_TESTS.md](book-10/10_DISASTER_RECOVERY_TESTS.md) |
| DOC-TEST-012 | UAT Strategy | [11_UAT_STRATEGY.md](book-10/11_UAT_STRATEGY.md) |
| DOC-TEST-013 | Release Acceptance | [12_RELEASE_ACCEPTANCE.md](book-10/12_RELEASE_ACCEPTANCE.md) |
| DOC-TEST-014 | Defect Management | [13_DEFECT_MANAGEMENT.md](book-10/13_DEFECT_MANAGEMENT.md) |
| DOC-TEST-015 | Quality Metrics | [14_QUALITY_METRICS.md](book-10/14_QUALITY_METRICS.md) |
| DOC-TEST-016 | Test Registry | [15_TEST_REGISTRY.md](book-10/15_TEST_REGISTRY.md) |
| DOC-DEV-001 | Developer Bible Index | [00_DEVELOPER_BIBLE_INDEX.md](book-11/00_DEVELOPER_BIBLE_INDEX.md) |
| DOC-DEV-002 | Development Principles | [01_DEVELOPMENT_PRINCIPLES.md](book-11/01_DEVELOPMENT_PRINCIPLES.md) |
| DOC-DEV-003 | Repository Structure | [02_REPOSITORY_STRUCTURE.md](book-11/02_REPOSITORY_STRUCTURE.md) |
| DOC-DEV-004 | Coding Standards | [03_CODING_STANDARDS.md](book-11/03_CODING_STANDARDS.md) |
| DOC-DEV-005 | Naming Conventions | [04_NAMING_CONVENTIONS.md](book-11/04_NAMING_CONVENTIONS.md) |
| DOC-DEV-006 | Folder and Module Rules | [05_FOLDER_AND_MODULE_RULES.md](book-11/05_FOLDER_AND_MODULE_RULES.md) |
| DOC-DEV-007 | Git Workflow | [06_GIT_WORKFLOW.md](book-11/06_GIT_WORKFLOW.md) |
| DOC-DEV-008 | Branching and Release | [07_BRANCHING_AND_RELEASE.md](book-11/07_BRANCHING_AND_RELEASE.md) |
| DOC-DEV-009 | Development Traceability | [08_DEVELOPMENT_TRACEABILITY.md](book-11/08_DEVELOPMENT_TRACEABILITY.md) |
| DOC-DEV-010 | Code Review Guide | [09_CODE_REVIEW_GUIDE.md](book-11/09_CODE_REVIEW_GUIDE.md) |
| DOC-DEV-011 | Definition of Ready | [10_DEFINITION_OF_READY.md](book-11/10_DEFINITION_OF_READY.md) |
| DOC-DEV-012 | Definition of Done — Development | [11_DEFINITION_OF_DONE_DEVELOPMENT.md](book-11/11_DEFINITION_OF_DONE_DEVELOPMENT.md) |
| DOC-DEV-013 | Technical Debt Policy | [12_TECHNICAL_DEBT_POLICY.md](book-11/12_TECHNICAL_DEBT_POLICY.md) |
| DOC-DEV-014 | Documentation Rules | [13_DOCUMENTATION_RULES.md](book-11/13_DOCUMENTATION_RULES.md) |
| DOC-DEV-015 | Code Generation Policy | [14_CODE_GENERATION_POLICY.md](book-11/14_CODE_GENERATION_POLICY.md) |
| DOC-DEV-016 | Developer Registry | [15_DEVELOPER_REGISTRY.md](book-11/15_DEVELOPER_REGISTRY.md) |
| DOC-ROADMAP-001 | Master Development Roadmap Index | [00_MASTER_DEVELOPMENT_ROADMAP_INDEX.md](book-12/00_MASTER_DEVELOPMENT_ROADMAP_INDEX.md) |
| DOC-ROADMAP-002 | Implementation Strategy | [01_IMPLEMENTATION_STRATEGY.md](book-12/01_IMPLEMENTATION_STRATEGY.md) |
| DOC-ROADMAP-003 | Epic Breakdown | [02_EPIC_BREAKDOWN.md](book-12/02_EPIC_BREAKDOWN.md) |
| DOC-ROADMAP-004 | Feature Breakdown | [03_FEATURE_BREAKDOWN.md](book-12/03_FEATURE_BREAKDOWN.md) |
| DOC-ROADMAP-005 | Development Sequence | [04_DEVELOPMENT_SEQUENCE.md](book-12/04_DEVELOPMENT_SEQUENCE.md) |
| DOC-ROADMAP-006 | Sprint Plan | [05_SPRINT_PLAN.md](book-12/05_SPRINT_PLAN.md) |
| DOC-ROADMAP-007 | Release Plan | [06_RELEASE_PLAN.md](book-12/06_RELEASE_PLAN.md) |
| DOC-ROADMAP-008 | Dependency Matrix | [07_DEPENDENCY_MATRIX.md](book-12/07_DEPENDENCY_MATRIX.md) |
| DOC-ROADMAP-009 | Implementation Traceability | [08_IMPLEMENTATION_TRACEABILITY.md](book-12/08_IMPLEMENTATION_TRACEABILITY.md) |
| DOC-ROADMAP-010 | Development Risk Register | [09_DEVELOPMENT_RISK_REGISTER.md](book-12/09_DEVELOPMENT_RISK_REGISTER.md) |
| DOC-ROADMAP-011 | Migration Strategy | [10_MIGRATION_STRATEGY.md](book-12/10_MIGRATION_STRATEGY.md) |
| DOC-ROADMAP-012 | Cutover Strategy | [11_CUTOVER_STRATEGY.md](book-12/11_CUTOVER_STRATEGY.md) |
| DOC-ROADMAP-013 | Go-Live Checklist | [12_GO_LIVE_CHECKLIST.md](book-12/12_GO_LIVE_CHECKLIST.md) |
| DOC-ROADMAP-014 | Post-Go-Live Plan | [13_POST_GO_LIVE_PLAN.md](book-12/13_POST_GO_LIVE_PLAN.md) |
| DOC-ROADMAP-015 | Release Registry | [14_RELEASE_REGISTRY.md](book-12/14_RELEASE_REGISTRY.md) |
| DOC-ROADMAP-016 | Implementation Registry | [15_IMPLEMENTATION_REGISTRY.md](book-12/15_IMPLEMENTATION_REGISTRY.md) |
| DOC-ADR-001 | Separate AI MLS Repository | [ADR-001-SEPARATE-AI-MLS-REPOSITORY.md](adr/ADR-001-SEPARATE-AI-MLS-REPOSITORY.md) |
| DOC-ADR-002 | Modular Monolith MVP | [ADR-002-MODULAR-MONOLITH-MVP.md](adr/ADR-002-MODULAR-MONOLITH-MVP.md) |
| DOC-ADR-003 | PostgreSQL Preferred | [ADR-003-POSTGRESQL-PREFERRED.md](adr/ADR-003-POSTGRESQL-PREFERRED.md) |
| DOC-ADR-004 | Human Approval for Publication | [ADR-004-HUMAN-APPROVAL-FOR-PUBLICATION.md](adr/ADR-004-HUMAN-APPROVAL-FOR-PUBLICATION.md) |
| DOC-ADR-005 | Connector Isolation | [ADR-005-CONNECTOR-ISOLATION.md](adr/ADR-005-CONNECTOR-ISOLATION.md) |
| DOC-ADR-006 | Provider-independent AI Layer | [ADR-006-PROVIDER-INDEPENDENT-AI-LAYER.md](adr/ADR-006-PROVIDER-INDEPENDENT-AI-LAYER.md) |
| DOC-FREEZE-001 | Freeze Manifest v1.0 | [FREEZE_MANIFEST_V1.md](freeze/FREEZE_MANIFEST_V1.md) |
| DOC-FREEZE-002 | Freeze Summary | [FREEZE_SUMMARY.md](freeze/FREEZE_SUMMARY.md) |
| DOC-FREEZE-003 | Freeze Changelog | [FREEZE_CHANGELOG.md](freeze/FREEZE_CHANGELOG.md) |
| DOC-FREEZE-004 | Freeze Document Registry | [FREEZE_DOCUMENT_REGISTRY.md](freeze/FREEZE_DOCUMENT_REGISTRY.md) |
| DOC-FREEZE-005 | Freeze Traceability Report | [FREEZE_TRACEABILITY_REPORT.md](freeze/FREEZE_TRACEABILITY_REPORT.md) |
| DOC-FREEZE-006 | Freeze Decision Summary | [FREEZE_DECISION_SUMMARY.md](freeze/FREEZE_DECISION_SUMMARY.md) |
| DOC-FREEZE-007 | Freeze Known Open Items | [FREEZE_KNOWN_OPEN_ITEMS.md](freeze/FREEZE_KNOWN_OPEN_ITEMS.md) |
| DOC-FREEZE-008 | Freeze Baseline | [FREEZE_BASELINE.md](freeze/FREEZE_BASELINE.md) |
| DOC-REVIEW-001 | A0 Completion Report | [A0_COMPLETION.md](reviews/A0_COMPLETION.md) |
| DOC-REVIEW-002 | A0.5 Completion Report | [A0_5_COMPLETION.md](reviews/A0_5_COMPLETION.md) |
| DOC-REVIEW-003 | A0.6 Completion Report | [A0_6_COMPLETION.md](reviews/A0_6_COMPLETION.md) |
| DOC-REVIEW-004 | A1 Completion Report | [A1_COMPLETION.md](reviews/A1_COMPLETION.md) |
| DOC-REVIEW-005 | A2 Completion Report | [A2_COMPLETION.md](reviews/A2_COMPLETION.md) |
| DOC-REVIEW-006 | A3 Completion Report | [A3_COMPLETION.md](reviews/A3_COMPLETION.md) |
| DOC-REVIEW-007 | Phase 4 Completion Report | [PHASE4_COMPLETION.md](reviews/PHASE4_COMPLETION.md) |
| DOC-REVIEW-008 | Phase 5 Completion Report | [PHASE5_COMPLETION.md](reviews/PHASE5_COMPLETION.md) |
| DOC-REVIEW-009 | Phase 6 Completion Report | [PHASE6_COMPLETION.md](reviews/PHASE6_COMPLETION.md) |
| DOC-REVIEW-010 | Phase 7 Completion Report | [PHASE7_COMPLETION.md](reviews/PHASE7_COMPLETION.md) |
| DOC-REVIEW-011 | Phase 7.5 Consistency Review | [PHASE7_5_CONSISTENCY_REVIEW.md](reviews/PHASE7_5_CONSISTENCY_REVIEW.md) |
| DOC-REVIEW-012 | Phase 7.5 Corrections | [PHASE7_5_CORRECTIONS.md](reviews/PHASE7_5_CORRECTIONS.md) |
| DOC-REVIEW-013 | Phase 7.5 Decision Summary | [PHASE7_5_DECISION_SUMMARY.md](reviews/PHASE7_5_DECISION_SUMMARY.md) |
| DOC-REVIEW-014 | Phase 7.5 Completion Report | [PHASE7_5_COMPLETION.md](reviews/PHASE7_5_COMPLETION.md) |
| DOC-REVIEW-015 | Phase 8 Completion Report | [PHASE8_COMPLETION.md](reviews/PHASE8_COMPLETION.md) |
| DOC-REVIEW-016 | Phase 9 Completion Report | [PHASE9_COMPLETION.md](reviews/PHASE9_COMPLETION.md) |
| DOC-REVIEW-017 | Phase 10 Completion Report | [PHASE10_COMPLETION.md](reviews/PHASE10_COMPLETION.md) |
| DOC-REVIEW-018 | Phase 11 Completion Report | [PHASE11_COMPLETION.md](reviews/PHASE11_COMPLETION.md) |
| DOC-REVIEW-019 | Phase 12 Completion Report | [PHASE12_COMPLETION.md](reviews/PHASE12_COMPLETION.md) |
| DOC-REVIEW-020 | Phase 13 Completion Report | [PHASE13_COMPLETION.md](reviews/PHASE13_COMPLETION.md) |
| DOC-REVIEW-021 | Phase 14 Architecture Review | [PHASE14_ARCHITECTURE_REVIEW.md](reviews/PHASE14_ARCHITECTURE_REVIEW.md) |
| DOC-REVIEW-022 | Phase 14 Findings | [PHASE14_FINDINGS.md](reviews/PHASE14_FINDINGS.md) |
| DOC-REVIEW-023 | Phase 14 Recommendations | [PHASE14_RECOMMENDATIONS.md](reviews/PHASE14_RECOMMENDATIONS.md) |
| DOC-REVIEW-024 | Phase 14 Action Items | [PHASE14_ACTION_ITEMS.md](reviews/PHASE14_ACTION_ITEMS.md) |
| DOC-REVIEW-025 | Phase 14 Completion Report | [PHASE14_COMPLETION.md](reviews/PHASE14_COMPLETION.md) |
| DOC-REVIEW-026 | Phase 15 Correction Report | [PHASE15_CORRECTION_REPORT.md](reviews/PHASE15_CORRECTION_REPORT.md) |
| DOC-REVIEW-027 | Phase 15 Validation Report | [PHASE15_VALIDATION_REPORT.md](reviews/PHASE15_VALIDATION_REPORT.md) |
| DOC-REVIEW-028 | Phase 15 Completion Report | [PHASE15_COMPLETION.md](reviews/PHASE15_COMPLETION.md) |
| DOC-REVIEW-029 | Phase 16 Freeze Validation | [PHASE16_FREEZE_VALIDATION.md](reviews/PHASE16_FREEZE_VALIDATION.md) |
| DOC-REVIEW-030 | Phase 16 Completion Report | [PHASE16_COMPLETION.md](reviews/PHASE16_COMPLETION.md) |
| DOC-REVIEW-031 | Phase 11-1 Decision Validation | [PHASE11_1_DECISION_VALIDATION.md](reviews/PHASE11_1_DECISION_VALIDATION.md) |
| DOC-REVIEW-032 | Phase 11-1 Completion Report | [PHASE11_1_COMPLETION.md](reviews/PHASE11_1_COMPLETION.md) |
| DOC-REVIEW-033 | Phase 11-2 Trace Validation | [PHASE11_2_TRACE_VALIDATION.md](reviews/PHASE11_2_TRACE_VALIDATION.md) |
| DOC-REVIEW-034 | Phase 11-2 RTM Coverage Report | [PHASE11_2_RTM_COVERAGE.md](reviews/PHASE11_2_RTM_COVERAGE.md) |
| DOC-REVIEW-035 | Phase 11-2 Completion Report | [PHASE11_2_COMPLETION.md](reviews/PHASE11_2_COMPLETION.md) |
| DOC-REVIEW-036 | Phase 11-3 Publication Validation | [PHASE11_3_PUBLICATION_VALIDATION.md](reviews/PHASE11_3_PUBLICATION_VALIDATION.md) |
| DOC-REVIEW-037 | Phase 11-3 Publication Coverage Report | [PHASE11_3_PUBLICATION_COVERAGE.md](reviews/PHASE11_3_PUBLICATION_COVERAGE.md) |
| DOC-REVIEW-038 | Phase 11-3 Completion Report | [PHASE11_3_COMPLETION.md](reviews/PHASE11_3_COMPLETION.md) |
| DOC-REVIEW-039 | Phase 11-4 Workflow Validation | [PHASE11_4_WORKFLOW_VALIDATION.md](reviews/PHASE11_4_WORKFLOW_VALIDATION.md) |
| DOC-REVIEW-040 | Phase 11-4 Workflow Coverage Report | [PHASE11_4_WORKFLOW_COVERAGE.md](reviews/PHASE11_4_WORKFLOW_COVERAGE.md) |
| DOC-REVIEW-041 | Phase 11-4 Completion Report | [PHASE11_4_COMPLETION.md](reviews/PHASE11_4_COMPLETION.md) |
| DOC-REVIEW-042 | Phase 11-5 API Validation | [PHASE11_5_API_VALIDATION.md](reviews/PHASE11_5_API_VALIDATION.md) |
| DOC-REVIEW-043 | Phase 11-5 API Coverage Report | [PHASE11_5_API_COVERAGE.md](reviews/PHASE11_5_API_COVERAGE.md) |
| DOC-REVIEW-044 | Phase 11-5 Completion Report | [PHASE11_5_COMPLETION.md](reviews/PHASE11_5_COMPLETION.md) |
| DOC-REVIEW-045 | Phase 11-6 Security Validation | [PHASE11_6_SECURITY_VALIDATION.md](reviews/PHASE11_6_SECURITY_VALIDATION.md) |
| DOC-REVIEW-046 | Phase 11-6 Security Coverage Report | [PHASE11_6_SECURITY_COVERAGE.md](reviews/PHASE11_6_SECURITY_COVERAGE.md) |
| DOC-REVIEW-047 | Phase 11-6 Completion Report | [PHASE11_6_COMPLETION.md](reviews/PHASE11_6_COMPLETION.md) |
| DOC-REVIEW-048 | Phase 11-7 Projection Validation | [PHASE11_7_PROJECTION_VALIDATION.md](reviews/PHASE11_7_PROJECTION_VALIDATION.md) |
| DOC-REVIEW-049 | Phase 11-7 Projection Coverage Report | [PHASE11_7_PROJECTION_COVERAGE.md](reviews/PHASE11_7_PROJECTION_COVERAGE.md) |
| DOC-REVIEW-050 | Phase 11-7 Completion Report | [PHASE11_7_COMPLETION.md](reviews/PHASE11_7_COMPLETION.md) |
| DOC-REVIEW-051 | Phase 11-8 Event Validation | [PHASE11_8_EVENT_VALIDATION.md](reviews/PHASE11_8_EVENT_VALIDATION.md) |
| DOC-REVIEW-052 | Phase 11-8 Event Coverage Report | [PHASE11_8_EVENT_COVERAGE.md](reviews/PHASE11_8_EVENT_COVERAGE.md) |
| DOC-REVIEW-053 | Phase 11-8 Completion Report | [PHASE11_8_COMPLETION.md](reviews/PHASE11_8_COMPLETION.md) |
| DOC-REVIEW-054 | Phase 11-9 Operations Validation | [PHASE11_9_OPERATIONS_VALIDATION.md](reviews/PHASE11_9_OPERATIONS_VALIDATION.md) |
| DOC-REVIEW-055 | Phase 11-9 Operations Coverage Report | [PHASE11_9_OPERATIONS_COVERAGE.md](reviews/PHASE11_9_OPERATIONS_COVERAGE.md) |
| DOC-REVIEW-056 | Phase 11-9 Completion Report | [PHASE11_9_COMPLETION.md](reviews/PHASE11_9_COMPLETION.md) |
| DOC-REVIEW-057 | Phase 11-10 Test Validation | [PHASE11_10_TEST_VALIDATION.md](reviews/PHASE11_10_TEST_VALIDATION.md) |
| DOC-REVIEW-058 | Phase 11-10 Test Coverage Report | [PHASE11_10_TEST_COVERAGE.md](reviews/PHASE11_10_TEST_COVERAGE.md) |
| DOC-REVIEW-059 | Phase 11-10 Completion Report | [PHASE11_10_COMPLETION.md](reviews/PHASE11_10_COMPLETION.md) |
| DOC-REVIEW-060 | Phase 11-11 Cross-Registry Consistency Report | [PHASE11_11_CROSS_REGISTRY_CONSISTENCY.md](reviews/PHASE11_11_CROSS_REGISTRY_CONSISTENCY.md) |
| DOC-REVIEW-061 | Phase 11-11 Registry Matrix | [PHASE11_11_REGISTRY_MATRIX.md](reviews/PHASE11_11_REGISTRY_MATRIX.md) |
| DOC-REVIEW-062 | Phase 11-11 Consistency Validation Report | [PHASE11_11_CONSISTENCY_VALIDATION.md](reviews/PHASE11_11_CONSISTENCY_VALIDATION.md) |
| DOC-REVIEW-063 | Phase 11-11 Architecture Gap Report | [PHASE11_11_ARCHITECTURE_GAPS.md](reviews/PHASE11_11_ARCHITECTURE_GAPS.md) |
| DOC-REVIEW-064 | Phase 11-11 Completion Report | [PHASE11_11_COMPLETION.md](reviews/PHASE11_11_COMPLETION.md) |
| DOC-REVIEW-065 | Phase 11-12 Architecture Freeze Report | [PHASE11_12_ARCHITECTURE_FREEZE.md](reviews/PHASE11_12_ARCHITECTURE_FREEZE.md) |
| DOC-REVIEW-066 | Phase 11-12 Baseline Definition | [PHASE11_12_BASELINE_DEFINITION.md](reviews/PHASE11_12_BASELINE_DEFINITION.md) |
| DOC-REVIEW-067 | Phase 11-12 Freeze Validation Report | [PHASE11_12_FREEZE_VALIDATION.md](reviews/PHASE11_12_FREEZE_VALIDATION.md) |
| DOC-REVIEW-068 | Phase 11-12 Deferred Decision Register — Review Evidence | [PHASE11_12_DEFERRED_DECISIONS.md](reviews/PHASE11_12_DEFERRED_DECISIONS.md) |
| DOC-REVIEW-069 | Phase 11-12 Completion Report | [PHASE11_12_COMPLETION.md](reviews/PHASE11_12_COMPLETION.md) |
| DOC-REVIEW-070 | Phase 12 Architecture Remediation Report | [PHASE12_ARCHITECTURE_REMEDIATION.md](reviews/PHASE12_ARCHITECTURE_REMEDIATION.md) |
| DOC-REVIEW-071 | Phase 12 Freeze Readiness Report | [PHASE12_FREEZE_READINESS.md](reviews/PHASE12_FREEZE_READINESS.md) |
| DOC-REVIEW-072 | Phase 12 Cross-Registry Final Validation Report | [PHASE12_CROSS_REGISTRY_FINAL_VALIDATION.md](reviews/PHASE12_CROSS_REGISTRY_FINAL_VALIDATION.md) |
| DOC-REVIEW-073 | Phase 12 Architecture Remediation Completion Report | [PHASE12_ARCHITECTURE_REMEDIATION_COMPLETION.md](reviews/PHASE12_ARCHITECTURE_REMEDIATION_COMPLETION.md) |
| DOC-REVIEW-074 | Phase 13-15 End-to-End Architecture Verification Report | [PHASE13_15_END_TO_END_ARCHITECTURE_VERIFICATION_REPORT.md](reviews/PHASE13_15_END_TO_END_ARCHITECTURE_VERIFICATION_REPORT.md) |
| DOC-REVIEW-075 | F15-TASK-005 Authorization Implementation Report | [F15_TASK_005_AUTHORIZATION_IMPLEMENTATION_REPORT.md](reviews/F15_TASK_005_AUTHORIZATION_IMPLEMENTATION_REPORT.md) |
| DOC-FREEZE-009 | Architecture v1.1 Baseline Manifest | [ARCHITECTURE_V1_1_BASELINE_MANIFEST.md](freeze/ARCHITECTURE_V1_1_BASELINE_MANIFEST.md) |

## 계획된 Books

| Book | 주제 | Index | Brief | 존재 상태 |
|---|---|---|---|---|
| Book 0 | Project Constitution | [00_PROJECT_CONSTITUTION](book-0/00_PROJECT_CONSTITUTION.md) | A1 | AVAILABLE |
| Book 1 | Business Strategy | [00_BUSINESS_STRATEGY_INDEX](book-1/00_BUSINESS_STRATEGY_INDEX.md) | A2 | AVAILABLE |
| Book 2 | System Architecture | [00_ARCHITECTURE_INDEX](book-2/00_ARCHITECTURE_INDEX.md) | A3 | AVAILABLE |
| Book 3 | Database Architecture | [00_DATABASE_ARCHITECTURE_INDEX](book-3/00_DATABASE_ARCHITECTURE_INDEX.md) | Phase 4 | AVAILABLE |
| Book 4 | AI Architecture | [00_AI_ARCHITECTURE_INDEX](book-4/00_AI_ARCHITECTURE_INDEX.md) | Phase 5 | AVAILABLE |
| Book 5 | Workflow and Lifecycle Bible | [00_WORKFLOW_INDEX](book-5/00_WORKFLOW_INDEX.md) | Phase 6 | AVAILABLE |
| Book 6 | API and Integration Bible | [00_API_ARCHITECTURE_INDEX](book-6/00_API_ARCHITECTURE_INDEX.md) | Phase 7 | AVAILABLE |
| Book 7 | UI/UX Bible | [00_UI_ARCHITECTURE_INDEX](book-7/00_UI_ARCHITECTURE_INDEX.md) | Phase 8 | AVAILABLE |
| Book 8 | Security, Privacy, and Compliance Bible | [00_SECURITY_ARCHITECTURE_INDEX](book-8/00_SECURITY_ARCHITECTURE_INDEX.md) | Phase 9 | AVAILABLE |
| Book 9 | Deployment, Infrastructure, and Operations Bible | [00_DEPLOYMENT_OPERATIONS_INDEX](book-9/00_DEPLOYMENT_OPERATIONS_INDEX.md) | Phase 10 | AVAILABLE |
| Book 10 | Test and Quality Bible | [00_TEST_ARCHITECTURE_INDEX](book-10/00_TEST_ARCHITECTURE_INDEX.md) | Phase 11 | AVAILABLE |
| Book 11 | Codex Developer Bible | [00_DEVELOPER_BIBLE_INDEX](book-11/00_DEVELOPER_BIBLE_INDEX.md) | Phase 12 | AVAILABLE |
| Book 12 | Master Development Roadmap | [00_MASTER_DEVELOPMENT_ROADMAP_INDEX](book-12/00_MASTER_DEVELOPMENT_ROADMAP_INDEX.md) | Phase 13 | AVAILABLE |

각 Book index는 해당 Brief에 명시된 모든 하위 문서를 열거하고 연결해야 한다. 아직 생성하지 않은 계획 경로는 깨진 Markdown link를 만들지 않도록 inline code로 표시하고, 파일 생성 시 `AVAILABLE` link로 전환한다.

## 계획된 Appendices와 control records

| Appendix/control set | 문서 | Brief | 존재 상태 |
|---|---|---|---|
| Architecture decisions | [ADR Workflow and Register](adr/README.md) | A3 이후 필요 시 | AVAILABLE |
| Architecture review | [PHASE14_ARCHITECTURE_REVIEW.md](reviews/PHASE14_ARCHITECTURE_REVIEW.md) | Phase 14 (`R1`) | AVAILABLE |
| Findings and open dispositions | [PHASE14_FINDINGS.md](reviews/PHASE14_FINDINGS.md) / [PHASE14_RECOMMENDATIONS.md](reviews/PHASE14_RECOMMENDATIONS.md) | Phase 14 (`R1`) | AVAILABLE |
| Traceability matrix | [00_CANONICAL_TRACEABILITY_MATRIX.md](00_CANONICAL_TRACEABILITY_MATRIX.md) | Phase 15 (`R2`) | AVAILABLE |
| Correction report | [PHASE15_CORRECTION_REPORT.md](reviews/PHASE15_CORRECTION_REPORT.md) | Phase 15 (`R2`) | AVAILABLE |
| Remaining open items | [PHASE15_COMPLETION.md](reviews/PHASE15_COMPLETION.md) | Phase 15 (`R2`) | AVAILABLE |
| v1 manifest and baseline | [Freeze Manifest](freeze/FREEZE_MANIFEST_V1.md) / [Freeze Baseline](freeze/FREEZE_BASELINE.md) | Phase 16 (`F1` legacy alias) | AVAILABLE |
| v1 document snapshot | [Freeze Document Registry](freeze/FREEZE_DOCUMENT_REGISTRY.md) | Phase 16 (`F1` legacy alias) | AVAILABLE |
| v1.1 candidate manifest/checksum | [Architecture v1.1 Baseline Manifest](freeze/ARCHITECTURE_V1_1_BASELINE_MANIFEST.md) / [Checksum](freeze/ARCHITECTURE_V1_1_BASELINE_CHECKSUM.sha256) | Phase 12 remediation | AVAILABLE |
| Trace/decision/open-item freeze evidence | [Freeze Traceability](freeze/FREEZE_TRACEABILITY_REPORT.md) / [Decision Summary](freeze/FREEZE_DECISION_SUMMARY.md) / [Known Open Items](freeze/FREEZE_KNOWN_OPEN_ITEMS.md) | Phase 16 (`F1` legacy alias) | AVAILABLE |
| Post-freeze control | [Freeze Baseline](freeze/FREEZE_BASELINE.md#future-change-process) | Phase 16 (`F1` legacy alias) | AVAILABLE |
| Development phase records | `docs/phases/PHASE_<N>_COMPLETION.md` | D0 이후 | PLANNED |

## Completion reports

모든 Brief는 `docs/reviews/<BRIEF>_COMPLETION.md`를 남긴다. Phase 14/15는 legacy `R1`/`R2`, Phase 16은 legacy `F1`의 canonical replacement다. D0는 `docs/phases/PHASE_0_COMPLETION.md`로 관리한다. 현재 완료 보고서는 [A0 Completion](reviews/A0_COMPLETION.md)부터 [Phase 16 Completion](reviews/PHASE16_COMPLETION.md)까지 canonical registry에 등록한다.

## 문서 진행 순서와 review gate

`A0 → A0.5 → A0.6 → A1 → A2 → A3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 7.5 → Phase 8 → Phase 9 → Phase 10 → Phase 11 → Phase 12 → Phase 13 → Phase 14 → Phase 15 → Phase 16 → D0`

사용자 review gate는 A1, Phase 4, Phase 6, Phase 7.5, Phase 9, Phase 13, Phase 14(`R1`), Phase 16(`F1`) 뒤에 적용한다. 현재 요청된 Brief가 끝나면 중단하고 다음 Brief를 자동 시작하지 않는다.
