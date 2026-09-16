# REL-001 Staging Acceptance Prerequisite Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-247 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Release Owner / Quality Owner |
| 기준일 | 2026-09-16 |

| Requirement | Exact candidate evidence | Freshness | Result | Reason / reference |
|---|---|---|---|---|
| Exact candidate identity | 18 roots, 65 files, all three fingerprints recomputed | FRESH | PASS | [Phase 7 candidate tests](../../modules/operations/src/release-candidate-artifact.test.ts), [Component Matrix](REL001_PHASE7_COMPONENT_FINGERPRINT_MATRIX.md) |
| Focused tests | Phase 7 `26/26`, Phase 6 `7/7`, Phase 5/FEAT-022 status `27/27` | FRESH | PASS | [Phase 7 tests](../../modules/operations/src/release-evidence-composition.test.ts), [Phase 6 E2E](../../apps/api/src/staging-integrated-runtime-e2e.test.ts), [Phase 5 Console](../../apps/admin-console/src/staging-console-composition.test.ts) |
| Full regression | `1476/1476` | FRESH | PASS | [Completion Report §8](../reviews/REL001_STAGING_ACCEPTANCE_COMPLETION_REPORT.md#8-validation-performed) |
| Lint / typecheck / clean build | PASS / PASS / PASS | FRESH | PASS | [Completion Report §8](../reviews/REL001_STAGING_ACCEPTANCE_COMPLETION_REPORT.md#8-validation-performed) |
| Architecture integrity | immutable baseline `153/153`, checksum unchanged | FRESH | PASS | `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` |
| Security / privacy | prior controls preserved; provider/credential calls `0/0` | FRESH | PASS | [Integrated runtime verification](../../apps/api/src/staging-integrated-runtime-verification.test.ts), [Completion Report §8](../reviews/REL001_STAGING_ACCEPTANCE_COMPLETION_REPORT.md#8-validation-performed) |
| Auditability | API-016 append-only evidence regression PASS | FRESH | PASS | [API-016 materializer tests](../../modules/audit/src/audit-intent-materializer.test.ts) |
| Operational readiness | deployment `NOT_READY`; backup/rollback `UNKNOWN` | FRESH | BLOCKED | [Manifest Reevaluation](REL001_STAGING_ACCEPTANCE_MANIFEST_REEVALUATION.md), [Handoff Reevaluation](REL001_PROMOTION_HANDOFF_REEVALUATION.md) |
| Restart / recovery | Phase 6 `7/7`; durable manifest append/reopen `22/22` store suite | FRESH | PASS | [Phase 6 E2E](../../apps/api/src/staging-integrated-runtime-e2e.test.ts), [Durable store tests](../../modules/operations/src/durable-release-acceptance-manifest-store.test.ts) |
| Tenant / scope | live authorization regression PASS | FRESH | PASS | [Session ingress tests](../../apps/api/src/staging-console-session-ingress.test.ts) |
| RBAC / MFA | `RELEASE_OWNER` + `release.accept` exists; positive decision not invoked | FRESH | NOT_APPLICABLE | [Authority tests](../../modules/operations/src/release-acceptance-authority-service.test.ts); result is `INCOMPLETE` |
| Evidence safety | strict DTO/reference validators and Gitleaks current tree `0` | FRESH | PASS | [Manifest validation tests](../../modules/operations/src/release-evidence-manifest.test.ts), [Completion Report §8](../reviews/REL001_STAGING_ACCEPTANCE_COMPLETION_REPORT.md#8-validation-performed) |
| UI / accessibility | 5 executable screens and truthful UI-006 deferral | FRESH | PASS | [Console tests](../../apps/admin-console/src/staging-console-composition.test.ts) |
| Known dependency disclosure | all three gaps and DEC-162 state explicit | FRESH | PASS | [Gap Disposition](REL001_STAGING_REMAINING_GAP_DISPOSITION.md) |
| Configuration truthfulness | live provider `0/3 NOT_READY`, DEC-162 `IN_REVIEW` | FRESH | PASS | [Phase 4D.8 Hold](REL001_PHASE4D8_EXTERNAL_PROVIDER_DEPENDENCY_HOLD.md) |
| Deployment independence | deployment/provider/network/credential actions `0` | FRESH | PASS | [Completion Report §8](../reviews/REL001_STAGING_ACCEPTANCE_COMPLETION_REPORT.md#8-validation-performed) |
| Dependency audit | no scoped network authorization | UNKNOWN | BLOCKED | [Completion Report §8](../reviews/REL001_STAGING_ACCEPTANCE_COMPLETION_REPORT.md#8-validation-performed); `NOT_RUN`, ACCEPTED path requires fresh audit evidence |
| Registry / candidate completeness | three required runtime gaps | FRESH | BLOCKED | [Candidate tests](../../modules/operations/src/release-candidate-artifact.test.ts), [Gap Disposition](REL001_STAGING_REMAINING_GAP_DISPOSITION.md) |
| Independent review | fresh bounded re-review | FRESH | PASS | [Completion Report §8](../reviews/REL001_STAGING_ACCEPTANCE_COMPLETION_REPORT.md#8-validation-performed) |

Blocking prerequisites prevent `ACCEPTED`; passing technical gates do not grant acceptance authority.

Related: [Acceptance Manifest Reevaluation](REL001_STAGING_ACCEPTANCE_MANIFEST_REEVALUATION.md), [Completion Report](../reviews/REL001_STAGING_ACCEPTANCE_COMPLETION_REPORT.md).
