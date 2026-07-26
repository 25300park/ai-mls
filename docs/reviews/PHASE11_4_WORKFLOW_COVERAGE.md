# Phase 11-4 Workflow Coverage Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-040 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 기준일 | 2026-07-24 |

## Coverage summary

| Dimension | Covered | Total | Coverage | Status |
|---|---:|---:|---:|---|
| Canonical workflows | 12 | 12 | 100% | VERIFIED/PARTIALLY_VERIFIED per row |
| Required workflow paths | 8 | 8 | 100% | 3 verified, 5 partial |
| Canonical commands | 6 | 6 | 100% | VERIFIED |
| Non-command exclusions | 5 | 5 | 100% | VERIFIED |
| Primary AO/DEC | 11 | 11 | 100% | 10 verified, AO-035 deferred registry artifact |
| Registry classes | 8 | 8 | 100% | 6 mapped, 2 approved placeholders |
| Entry/exit pairs | 20 | 20 | 100% | 12 workflows + 8 paths |

## Decision coverage

| Decision | Covered workflow concern | Evidence |
|---|---|---|
| AO-023 / DEC-100 | aggregate/Attempt/Evidence/Case ownership | WF-010, WF-012 |
| AO-024 / DEC-101 | lifecycle versus workflow boundary | WF-009, WF-010 |
| AO-027 / DEC-104 | API-014 command surface | WF-010~012 |
| AO-028 / DEC-105 | live revalidation | CMD-WF-004, transition guards |
| AO-029 / DEC-106 | SoD | WF-007, WF-009~012 |
| AO-030 / DEC-107 | idempotency/replay | command registry, guarded re-entry |
| AO-031 / DEC-108 | reconciliation | WFP-005, WF-012 |
| AO-032 / DEC-109 | materiality | WFP-007, CMD-WF-003 |
| AO-033 / DEC-110 | withdrawal | WFP-006, CMD-WF-002 |
| AO-034 / DEC-111 | republish | WFP-007, CMD-WF-003 |
| AO-035 / DEC-112 | projection consistency | projection/event boundary (`DEFERRED`) |

AO-025/DEC-102 Target/Channel binding과 AO-026/DEC-103 ownership separation은 supporting dependencies로 transition guards 및 authority boundary에 반영되었다.

## Test coverage mapping

| Concern | Test IDs | Status |
|---|---|---|
| Intake/provenance | TEST-004, TEST-010, TEST-015 | VERIFIED |
| Verification/expiry | TEST-002, TEST-020, TEST-024, TEST-032 | VERIFIED |
| Publication approval/SoD | TEST-021, TEST-022, TEST-033, TEST-047 | VERIFIED |
| Delivery/reconciliation | TEST-023, TEST-025, TEST-033, TEST-037 | PARTIALLY_VERIFIED |
| Connector isolation | TEST-008, TEST-036, TEST-037 | PARTIALLY_VERIFIED |
| Audit/recovery/operations | TEST-049, TEST-051~056 | PARTIALLY_VERIFIED |

## Deferred coverage

- Projection Registry identity and schema: `PRJ-PH`, `DEFERRED`.
- Event Registry identity and schema: `EVT-PH`, `DEFERRED`.
- Runtime FEAT-015 execution, physical connector, queue, DB schema and production adapter validation: 이번 Brief 범위 밖.

## Cross-references

- [Canonical Workflow Registry](../00_WORKFLOW_REGISTRY.md)
- [Workflow Validation Report](PHASE11_4_WORKFLOW_VALIDATION.md)
- [Phase 11-4 Completion](PHASE11_4_COMPLETION.md)
