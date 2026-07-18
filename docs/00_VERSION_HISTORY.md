# Version History

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-007 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |

Architecture Bible과 운영 문서의 release-level 변경 이력을 관리한다. 세부 절차는 [Document Governance](00_DOCUMENT_GOVERNANCE.md)를 따른다.

| 날짜 | Version | 상태 | 범위 | 변경 요약 | 승인/근거 |
|---|---|---|---|---|---|
| 2026-07-13 | v0.1 | DRAFT | A0 Documentation Workspace Foundation | 작업공간, master navigation, governance, glossary, ADR/review workflow와 template 최초 생성 | Brief A0; 승인 대기 |
| 2026-07-13 | v0.1 | DRAFT | A0.5 Documentation Quality Foundation | risk/assumption/naming/Document ID/Mermaid/review/traceability 규칙 생성 | A0.5 completion; 승인 대기 |
| 2026-07-13 | v0.1 | DRAFT | A0.6 Documentation Governance Enhancement | decision/change/ARB/release/lifecycle/approval governance 생성 | A0.6 completion; 승인 대기 |
| 2026-07-13 | v0.1 | DRAFT | A1 Book 0 — Project Constitution | Constitution과 product/AI/data/security/development/decision/Done 원칙 생성 | A1 completion; user review gate 대기 |
| 2026-07-13 | v0.1 | DRAFT | A2 Book 1 — Business Strategy | problem/workflow/persona/value/market/business model/scope/KPI/roadmap 생성 | A2 completion; review 대기 |
| 2026-07-13 | v0.1 | DRAFT | A3 Book 2 — System Architecture | system/context/container/module/data flow/event/integration/failure/scalability architecture와 ADR-001–006 생성 | A3 completion; architecture/ADR review 대기 |
| 2026-07-13 | v0.1 | DRAFT | Phase 4 Book 3 — Database Architecture | logical domain/ER/standards/source/property/candidate/contact/client/matching/verification/publication/audit/retention/index/data dictionary 생성 | Phase 4 completion; database review 대기 |
| 2026-07-14 | v0.1 | DRAFT | Phase 5 Book 4 — AI Architecture | AI boundary/provider/parser/normalization/duplicate/requirement/matching/search/confidence/review/prompt governance/observability/output schema/library guide 생성 | Phase 5 completion; AI/security review 대기 |
| 2026-07-14 | v0.1 | DRAFT | Phase 6 Book 5 — Workflow Architecture | discovery부터 publication, expiration, exception recovery까지 12 workflow와 canonical status/transition rules 생성 | Phase 6 completion; workflow/business/architecture review 대기 |
| 2026-07-14 | v0.1 | DRAFT | Phase 7 Book 6 — API & Integration Architecture | logical domain API, auth/session, job, connector/external integration, error/versioning 및 API registry 계약 생성 | Phase 7 completion; architecture/security/business/data/AI review 대기 |
| 2026-07-14 | v0.1 | DRAFT | Phase 7.5 Cross-Phase Consistency Review | Phase naming, canonical publication/audit status, missing entity mapping, registry/link/trace consistency를 교정·검증 | Phase 7.5 completion; user/reviewer confirmation 대기 |
| 2026-07-14 | v0.1 | DRAFT | Phase 8 Book 7 — UI/UX Architecture | information/navigation, role dashboard, UI-001–037 screen 계약, form/search/list/feedback/design/responsive/accessibility/error/state와 Screen Registry 생성 | Phase 8 completion; business/security/accessibility review 대기 |
| 2026-07-14 | v0.1 | DRAFT | Phase 9 Book 8 — Security & Privacy Architecture | Zero Trust, identity/authentication, scoped authorization, role/screen/API permission matrix, classification/privacy, audit/encryption/session/event/threat/logging/incident/backup와 SEC-001–034 registry 생성 | Phase 9 completion; security/privacy/business/architecture review 대기 |
| 2026-07-14 | v0.1 | DRAFT | Phase 10 Book 9 — Deployment & Operations | logical deployment/environment/configuration/release/runbook/observability/backup/DR/continuity/capacity/SLO/incident/change/security, OPS-001–032 registry와 operational checklist 생성 | Phase 10 completion; operations/security/business/architecture review 대기 |
| 2026-07-15 | v0.1 | DRAFT | Phase 11 Book 10 — Test & Quality | strategy/traceability/levels/data/functional/AI/security/performance/backup/DR/UAT/release/defect/metrics, TEST-001–056 registry와 13/13 requirement mapping 생성 | Phase 11 completion; quality/business/security/AI/operations review 대기 |
| 2026-07-15 | v0.1 | DRAFT | Phase 12 Book 11 — Developer Bible | development/repository/coding/naming/module/Git/branch/trace/review/Ready/Done/debt/documentation/code-generation standards와 DEV-001–024 registry 생성 | Phase 12 completion; development/architecture/security/quality review 대기 |
| 2026-07-15 | v0.1 | DRAFT | Phase 13 Book 12 — Master Development Roadmap | strategy, EPIC-001–010, FEAT/DEV/IMP-001–024, SP-000–010, REL-001–005, dependency/trace/risk/migration/cutover/go-live/post-live 계획과 registry 생성 | Phase 13 completion; full review gate 대기 |
| 2026-07-15 | v0.1 | DRAFT | Phase 14 — Architecture Review | Book 0–12/ADR/registry/review consistency, traceability, quality와 readiness 검토; findings/recommendations/action items 생성 | Phase 14 completion; score 78/100; Phase 15 corrections required |
| 2026-07-15 | v0.1 | APPROVED | Phase 15 — Architecture Corrections | ACT-14-001–012 교정, canonical trace matrix, metadata/status/ADR/DEC/ASM/registry synchronization과 zero-orphan validation | CR-018; DEC-093; Phase 15 user authorization; ADR-003/DEC-013/062/065 remain in review |
| 2026-07-15 | v1.0 | FROZEN | Phase 16 — Architecture Freeze v1.0 | 260 documents를 frozen baseline으로 전환하고 manifest/document snapshot/trace/decision/open-item/baseline/validation evidence 확립 | CR-019; DEC-094; DOC-FREEZE-001–008; DOC-REVIEW-029–030; ADR-003 remains IN REVIEW |
| 2026-07-15 | v1.0 | FROZEN | Sprint 0 implementation progress metadata | SP-000/EPIC-001/FEAT-024/DEV-024/IMP-024/TEST-056에 매핑된 repository·tooling placeholder와 execution evidence 생성; normative architecture 변경 없음 | User-authorized Sprint 0; `docs/development/SPRINT0_*` |

## 기록 규칙

- 문서 version 또는 status가 바뀔 때 한 행을 추가한다.
- 영향 문서, ADR 또는 review report, 승인 주체와 날짜를 연결한다.
- 기존 행을 지우거나 의미를 바꾸지 않고 정정 행을 추가한다.
- v1.0 freeze 행에는 F1 freeze report, manifest와 checksum 기준선을 연결한다.

Phase 16 resolution: Architecture Bible v1.0은 모든 included frozen document에 동일 `v1.0` metadata를 적용하는 baseline release다. 이후 compatible/non-compatible change는 [Freeze Baseline](freeze/FREEZE_BASELINE.md)의 `v1.x`/`v2.0` change process를 따른다.
