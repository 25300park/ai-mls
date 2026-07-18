# A3 Completion — System Architecture

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-006 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-13 |
| Brief | A3 — System Architecture |

## 1. Objective

Book 0의 Constitution과 Book 1의 Business Strategy를 구현 독립적인 logical system architecture로 전환했다. system/context/container/module/data flow/event and job/integration/failure isolation/scalability 경계를 정의하고, 중요한 기술 방향은 승인 전 ADR로 분리했다. application code, database schema, API specification/implementation, deployment implementation은 만들지 않았다.

## 2. Documents Read

- [README](../../README.md), [AGENTS](../../AGENTS.md)
- [Master Index](../00_MASTER_INDEX.md), [Document Governance](../00_DOCUMENT_GOVERNANCE.md), [Glossary](../00_GLOSSARY.md), [Document ID Rule](../00_DOCUMENT_ID_RULE.md), [Traceability Rule](../00_TRACEABILITY_RULE.md)
- [Book 0 — Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md)의 index와 모든 하위 문서
- [Book 1 — Business Strategy](../book-1/00_BUSINESS_STRATEGY_INDEX.md)의 index와 모든 하위 문서
- [A1 Completion](A1_COMPLETION.md), [A2 Completion](A2_COMPLETION.md)

## 3. Files Created

### Book 2 — System Architecture

1. [00_ARCHITECTURE_INDEX.md](../book-2/00_ARCHITECTURE_INDEX.md)
2. [01_SYSTEM_OVERVIEW.md](../book-2/01_SYSTEM_OVERVIEW.md)
3. [02_CONTEXT_ARCHITECTURE.md](../book-2/02_CONTEXT_ARCHITECTURE.md)
4. [03_CONTAINER_ARCHITECTURE.md](../book-2/03_CONTAINER_ARCHITECTURE.md)
5. [04_MODULE_ARCHITECTURE.md](../book-2/04_MODULE_ARCHITECTURE.md)
6. [05_DATA_FLOW_ARCHITECTURE.md](../book-2/05_DATA_FLOW_ARCHITECTURE.md)
7. [06_EVENT_AND_JOB_ARCHITECTURE.md](../book-2/06_EVENT_AND_JOB_ARCHITECTURE.md)
8. [07_INTEGRATION_ARCHITECTURE.md](../book-2/07_INTEGRATION_ARCHITECTURE.md)
9. [08_FAILURE_ISOLATION.md](../book-2/08_FAILURE_ISOLATION.md)
10. [09_SCALABILITY_STRATEGY.md](../book-2/09_SCALABILITY_STRATEGY.md)
11. [10_ARCHITECTURE_DECISIONS.md](../book-2/10_ARCHITECTURE_DECISIONS.md)

### Architecture Decision Records

12. [ADR-001 — Separate AI MLS Repository](../adr/ADR-001-SEPARATE-AI-MLS-REPOSITORY.md)
13. [ADR-002 — Modular Monolith MVP](../adr/ADR-002-MODULAR-MONOLITH-MVP.md)
14. [ADR-003 — PostgreSQL Preferred](../adr/ADR-003-POSTGRESQL-PREFERRED.md)
15. [ADR-004 — Human Approval for Publication](../adr/ADR-004-HUMAN-APPROVAL-FOR-PUBLICATION.md)
16. [ADR-005 — Connector Isolation](../adr/ADR-005-CONNECTOR-ISOLATION.md)
17. [ADR-006 — Provider-independent AI Layer](../adr/ADR-006-PROVIDER-INDEPENDENT-AI-LAYER.md)
18. [A3_COMPLETION.md](A3_COMPLETION.md)

## 4. Files Updated

1. [Master Index](../00_MASTER_INDEX.md) — Book 2, ADR, completion report와 canonical Document ID 등록
2. [Version History](../00_VERSION_HISTORY.md) — A3 v0.1 DRAFT 기록
3. [Decision Register](../00_DECISION_REGISTER.md) — DEC-011–DEC-016을 `UNDER_REVIEW`로 등록
4. [Change Request Register](../00_CHANGE_REQUEST_REGISTER.md) — CR-005를 documentation scope의 `IMPLEMENTED`로 기록
5. [ADR Workflow and Register](../adr/README.md) — ADR-001–ADR-006 DRAFT 등록

## 5. Architecture Summary and Major Decisions

### Architecture Summary

- MVP 기본안은 명시적 module boundary를 가진 modular monolith이며, Background Worker는 동일한 application rule을 사용하는 별도 논리 failure/runtime 책임이다.
- AI Provider Layer, Future Connector, rbs-homes Adapter는 core domain에서 격리한다.
- source evidence, Candidate Listing, Verified Record, client-shareable output, Published Listing의 authority 의미를 분리한다.
- AI parsing, duplicate detection, matching은 advisory이며 사람의 verification과 publication approval을 대체하지 않는다.
- queue, scheduler, event bus, database, storage는 capability 수준으로만 정의했고 제품·schema·payload·topology는 확정하지 않았다.
- 확장은 실제 workload, failure, security/data ownership, team/release evidence가 있을 때 service extraction을 검토한다.

### Major Decisions

| Decision | ADR | Register status |
|---|---|---|
| Separate AI MLS repository | ADR-001 / DEC-011 | DRAFT / UNDER_REVIEW |
| Modular monolith MVP | ADR-002 / DEC-012 | DRAFT / UNDER_REVIEW |
| PostgreSQL preferred candidate | ADR-003 / DEC-013 | DRAFT / UNDER_REVIEW |
| Human approval for publication | ADR-004 / DEC-014 | DRAFT / UNDER_REVIEW |
| Connector isolation | ADR-005 / DEC-015 | DRAFT / UNDER_REVIEW |
| Provider-independent AI layer | ADR-006 / DEC-016 | DRAFT / UNDER_REVIEW |

어떤 A3 ADR도 `APPROVED`로 표시하지 않았다. 기존 DEC-002/DEC-005의 mandatory 방향을 구체화한 ADR-004/ADR-005 역시 formal review evidence가 생길 때까지 DRAFT다.

## 6. Cross References

- Book 2 index는 10개 하위 architecture 문서와 6개 ADR을 연결한다.
- Architecture Decisions 문서는 DEC-011–DEC-016과 ADR-001–ADR-006을 연결한다.
- Master Index는 DOC-ARCH-001–011, DOC-ADR-001–006, DOC-REVIEW-006을 canonical registry에 등록한다.
- A3 문서는 Book 0 authority, Book 1 scope, governance register와 후속 Book 경계를 상호 참조한다.

## 7. Validation Results

| 검증 | 결과 | Evidence/Note |
|---|---|---|
| Required Book 2 files | PASS | 11/11 존재 |
| Required ADR files | PASS | ADR-001–ADR-006, 6/6 존재 |
| Required diagrams | PASS | context, container, module, main data flow, event flow, failure isolation Mermaid 6/6 존재 |
| Required modules | PASS | 요청된 16개 module이 purpose/responsibility/input/output/dependency와 함께 존재 |
| Document IDs | PASS | A3 ID 18개가 canonical registry에 등록되고 metadata ID 중복 없음; Master registry unique ID 68개 |
| Version/status consistency | PASS | A3 산출물 v0.1 DRAFT; DEC-011–016 UNDER_REVIEW; approval evidence를 허위 생성하지 않음 |
| Markdown links | PASS WITH EXCLUSION | A3 산출물과 현재 control 문서의 A3 링크 해소; Master Index의 명시적 future PLANNED 경로는 규칙에 따라 제외 |
| Mermaid structure | PASS WITH LIMITATION | fence pairing과 required block 수 확인; Mermaid CLI 부재로 renderer compile은 미수행 |
| Implementation boundary | PASS | `CREATE/ALTER TABLE`, API route/method, deployment command 패턴 없음; application code·schema·API/deployment artifact 없음 |
| Phase 4 boundary | PASS | `docs/book-3` 산출물을 생성하지 않음 |

## 8. Open Questions and Open Decisions

1. 실제 AI MLS repository 위치, owner, CI/release와 rbs-homes 간 변경 계약은 무엇인가?
2. Phase 4에서 authoritative entity/state, transaction, provenance, retention과 audit linkage를 어떻게 정의할 것인가?
3. PostgreSQL 선호안을 승인할 capability·운영 제약과 Database Reviewer는 누구인가?
4. rbs-homes에 실제 publish/reconcile/withdraw API가 있는가? 인증·idempotency·상태 조회 계약은 무엇인가?
5. identity provider, authorization policy model, approver role과 승인 유효기간은 무엇인가?
6. 초기 AI provider/model, 허용 data class, quality baseline, fallback과 budget policy는 무엇인가?
7. 실제 workload baseline과 latency, throughput, backlog, availability/recovery objective는 무엇인가?
8. future connector의 최초 허용 source와 약관·privacy review owner는 누구인가?

## 9. Inconsistencies and Known Limitations

### 발견한 불일치

- Book 0(A1)과 Book 1(A2)은 여전히 `DRAFT`이고 DEC-009/DEC-010도 `UNDER_REVIEW`다. A3는 이 문서들을 요청된 상위 입력으로 사용했지만, 승인·동결된 baseline으로 표현하지 않았다.
- rbs-homes integration은 business 방향에는 존재하지만 실제 API/contract evidence는 제공되지 않았다. 따라서 `ASSUMPTION`과 `OPEN DECISION`으로 표시했다.
- PostgreSQL은 원 Brief의 architecture 후보지만 Phase 4 data requirements와 운영 환경이 없으므로 “preferred candidate” 이상으로 확정하지 않았다.
- 기존 Master Index에는 Phase 4 이후의 계획 경로가 실제 파일보다 먼저 링크되어 있다. 이는 Master Index 자체가 명시한 계획 링크 예외이며 A3 broken-link 결함으로 계산하지 않았다.

### Known Limitations

- Mermaid renderer/CLI가 workspace에 없어 diagram source의 실제 render compile을 검증하지 못했다.
- workspace가 Git repository로 인식되지 않아 Git 기반 changed-file diff를 사용하지 못했고, 생성·수정 목록은 filesystem과 문서 registry를 기준으로 검증했다.
- architecture는 logical 수준이며 entity/field/schema, endpoint/payload, deployment topology/vendor, numeric SLO/capacity는 의도적으로 후속 Brief에 남겼다.
- 법률·source terms·privacy 및 외부 vendor capability에 대한 외부 evidence review는 이번 documentation-only 범위에 포함되지 않았다.

## 10. Recommendation for Phase 4 / 다음 Brief 진행 전 필요한 사항

Phase 4를 자동으로 시작하지 않는다. 진행 전 다음이 필요하다.

1. 사용자가 A3 completion을 검토하고 DEC-011–DEC-016을 승인·수정·defer할지 결정한다.
2. 최소한 Phase 4를 구속할 Constitution/Business Strategy 항목과 A3 authority-state 경계를 확인한다.
3. Database Reviewer, Security Reviewer, AI Reviewer와 Business Owner의 named owner 또는 승인 evidence 방식을 정한다.
4. authoritative data, contact/raw evidence classification, retention/deletion, duplicate/merge, verification/publication state에 대한 open question의 우선순위를 제공한다.
5. rbs-homes 계약 자료가 있다면 Phase 4의 external-reference/data ownership 판단 전에 제공한다.

이 보고서 생성으로 A3 작업을 중단한다. Phase 4는 별도 사용자 지시 없이는 시작하지 않는다.
