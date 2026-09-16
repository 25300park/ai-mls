# REL-001 Phase 5C Screen E2E Traceability

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-233 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / UI Owner |

## Six-screen boundary

| Screen | Route | Trusted boundary | Owning runtime | Classification |
|---|---|---|---|---|
| `UI-006` | `/administration` | Phase 1D Session → Console | API-015 HTTP | `EXECUTABLE_WITH_DEFERRED_DEPENDENCY`; Core API-001/002 remains unavailable |
| `UI-031` | `/publication/operations` | Phase 1D Session → Console | API-014 read port | `EXECUTABLE` |
| `UI-032` | `/publication/revalidation` | Phase 1D Session → Console | API-014 read port | `EXECUTABLE` |
| `UI-033` | `/publication/recovery` | Phase 1D Session → Console | API-014/F19 read port | `EXECUTABLE` |
| `UI-035` | `/publication/audit` | Phase 1D Session → Console | API-016 read port | `EXECUTABLE` |
| `UI-036` | `/administration/governance` | Phase 1D Session → Console | API-015 HTTP read/controlled command | `EXECUTABLE` |

## Cross-layer evidence

| Requirement | Evidence | Result |
|---|---|---|
| route and owner isolation | `staging-console-composition.test.ts` six-screen routing | PASS |
| trusted Session per request | `staging-console-session-ingress.test.ts`; Phase 1D regression | PASS |
| API-015 read/propose/approve/reject/Role/Team/Decision | existing API-015 Console and closed-contract suites | PASS |
| API-016 chronology/safe evidence/source link | existing Console/API-016 and Phase 2E suites | PASS |
| API-017 readiness/failure/lineage | existing Phase 3 and Phase 5B suites | PASS |
| provider truth | provider-independent `READY`; live `NOT_READY`; `DEC-162 IN_REVIEW` | PASS |
| accessibility | existing FEAT-021 route, keyboard, focus, error and controlled-write suites | PASS |

Supporting `/system/operations` is not a seventh canonical screen. No new route or mutation control is introduced.
