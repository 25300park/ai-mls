# REL-002 Phase 1G Salvage Runtime Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-302 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-09-18 |

| 요구사항 | 구현 | 검증 | 상태 |
|---|---|---|---|
| Evidence authority | read-only Identity/API-016 ports + exact registration binding adapter | missing/mutable/non-final/mismatch/extra/unavailable negative tests | VERIFIED |
| Workload subject | registration/version/tenant/principal/SERVICE/WORKLOAD/evidence refs only | caller authority field absence, no synthetic Session | VERIFIED |
| Live authorization | existing live assignment resolver and policy engine; operation-bound revalidation adapter; API-017 `JobExecutionAdmissionPort` / `job.execute` claim+commit checks | allow, revocation, tenant mismatch, human-only action, commit denial with success/failure mutation zero | VERIFIED |
| Strict Identity schema | versioned contract, SHA-256 fingerprint, xinfo/index/FK/trigger/metadata equality | missing/index/version/fingerprint/extra-column failures | VERIFIED |
| Canonical entry | `startProductionRuntime()` exact ordering and fail-safe cleanup | pre-gate zero effects, post-gate reverse cleanup, false READY zero | VERIFIED |
| Actual roots | closed API-014/015/018/019/FEAT-022 registry with deferred activation and retained listener handles | exact 5/5 imports, prepared schema mode 5/5, all prepare before runtime/listener activation | VERIFIED |
| Bypass prevention | governed app roots require explicit environment; Production requires issued context; source-wide issuer/engine/factory import allowlists | separate Production process bypass rejection and architecture allowlist scan | VERIFIED |
| Human Session preservation | existing `evaluate()` / `SessionAccessCoordinator` unchanged | affected Authorization/Production composition regression | VERIFIED |
| Staging preservation | existing direct test/Staging compositions remain available through explicit environment declaration | affected regression 112/112 | VERIFIED |
| Secret/provider hold | no secret value; provider authorization remains false | pre-gate/provider side-effect tests | VERIFIED |
| Migration boundary | all six Production stores use fail-closed prepared-schema mode | missing-schema tests; runtime DDL/migration zero | VERIFIED |

## Gap 재평가

| Gap | 구현 상태 | Production readiness |
|---|---|---|
| REL002-GAP-004 | bounded implementation complete | `PARTIAL`, `BLOCKING` — concrete delivery/platform evidence outstanding |
| REL002-GAP-005 | reference boundary retained | `PARTIAL`, `BLOCKING` — concrete secret backend/rotation remains future authorized work |
| REL002-GAP-006 | workload identity/evidence/live authorization implementation complete | `STAGING_ONLY`, `BLOCKING` — Phase 2 schema/migration and Production-bound proof required |
