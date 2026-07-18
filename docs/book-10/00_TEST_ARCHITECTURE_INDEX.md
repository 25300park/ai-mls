# Test & Quality Architecture Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-TEST-001 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Quality Owner / Architecture Owner |
| 기준일 | 2026-07-15 |
| Phase | Phase 11 |

## Purpose

Book 10은 requirement부터 workflow/entity/API/UI/AI/security/operations/release까지의 logical validation architecture와 acceptance evidence를 정의한다. Executable test code, Playwright/Cypress/Postman collection, load script와 vendor tool configuration은 범위 밖이다.

## Mandatory principles

1. 모든 `REQ-CONST-*`는 최소 하나의 `TEST-*`를 가진다.
2. WF-001–012, API-001–019, UI-001–037, AI-001–007, SEC-001–034와 OPS-001–032를 모두 검증한다.
3. positive path만으로 acceptance하지 않고 bypass, stale/conflict, deny, retry/duplicate, failure/recovery와 privacy leakage를 포함한다.
4. AI score는 human authority가 아니며 evaluation dataset/version, threshold와 human review evidence를 가진다.
5. backup/recovery/DR는 문서 존재가 아니라 실제 exercise evidence로 검증한다.
6. blocking defect, missing trace/evidence 또는 failed hard guardrail이 있으면 release할 수 없다.

## Document map

| Document ID | 문서 | 책임 |
|---|---|---|
| DOC-TEST-002 | [Test Strategy](01_TEST_STRATEGY.md) | objectives, principles, lifecycle, roles |
| DOC-TEST-003 | [Requirement Traceability Matrix](02_REQUIREMENT_TRACEABILITY_MATRIX.md) | 13 constitutional requirements end-to-end mapping |
| DOC-TEST-004 | [Test Levels](03_TEST_LEVELS.md) | unit/integration/system/regression/UAT/operational/security/AI |
| DOC-TEST-005 | [Test Data Strategy](04_TEST_DATA_STRATEGY.md) | synthetic/privacy/refresh/isolation |
| DOC-TEST-006 | [Functional Tests](05_FUNCTIONAL_TESTS.md) | workflows, business/approval/publication/exception |
| DOC-TEST-007 | [AI Validation](06_AI_VALIDATION.md) | AI-001–007 evaluation and human review |
| DOC-TEST-008 | [Security Tests](07_SECURITY_TESTS.md) | authentication/authorization/permission/session/audit/privacy |
| DOC-TEST-009 | [Performance Tests](08_PERFORMANCE_TESTS.md) | search/matching/publication/jobs/scaling |
| DOC-TEST-010 | [Backup and Recovery Tests](09_BACKUP_AND_RECOVERY_TESTS.md) | backup/restore/integrity/audit |
| DOC-TEST-011 | [Disaster Recovery Tests](10_DISASTER_RECOVERY_TESTS.md) | scenarios/failover/continuity/recovery |
| DOC-TEST-012 | [UAT Strategy](11_UAT_STRATEGY.md) | user/business acceptance and sign-off |
| DOC-TEST-013 | [Release Acceptance](12_RELEASE_ACCEPTANCE.md) | release gates/blockers/rollback evidence |
| DOC-TEST-014 | [Defect Management](13_DEFECT_MANAGEMENT.md) | severity/priority/lifecycle/RCA/verification |
| DOC-TEST-015 | [Quality Metrics](14_QUALITY_METRICS.md) | coverage/pass/defect/AI/operations/business quality |
| DOC-TEST-016 | [Test Registry](15_TEST_REGISTRY.md) | TEST-001–056 canonical mappings |

## Scope and status

All test cases are logical `DEFINED` specifications, not executed/passed evidence. Execution status and release evidence require future implementation and approved environment/data.

