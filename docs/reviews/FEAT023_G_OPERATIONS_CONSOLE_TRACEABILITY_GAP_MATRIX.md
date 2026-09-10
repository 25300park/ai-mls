# FEAT-023-G Operations Console / Traceability Gap Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-138 |
| Version | v0.1 |
| Status | IN REVIEW |
| Owner | Operations / Security / Privacy Owners |
| Baseline | `7af697a02b5ff7372adb2d12202382218783da79` |
| Production changes at matrix creation | `0` |

## 1. Objective

FEAT-023-B~F에서 검증된 operational evidence를 기존 단일 Operations Console의 read-only 경계와 대조한다. 이 문서는 Production 변경 전 gap만 확정하며 새 API, authority, lifecycle, vocabulary, persistence 또는 external monitoring을 승인하지 않는다.

## 2. Canonical boundary

- Console route는 기존 `/system/operations`와 `OPERATIONS` page를 그대로 사용한다.
- 데이터는 기존 `DurableOperationalEvidenceStore`와 `SecurityPrivacyOperationalControlService`를 통한 injected read port에서만 얻는다.
- 모든 disclosure는 trusted Session, live `audit.query`, fixed purpose `SECURITY_MONITORING`, MFA, tenant/scope concealment를 유지한다.
- Health, Readiness, Freshness는 서로 다른 canonical observation이며 business authorization이 아니다.
- `UNKNOWN`은 `READY`로 변환하거나 표시하지 않는다.
- telemetry, status, Alert, readiness evidence는 safe immutable DTO만 Console에 전달한다.

## 3. Console / traceability gap matrix

| Required area | Canonical source | Current Production path | Current verification | Gap | Bounded FEAT-023-G action |
|---|---|---|---|---|---|
| Telemetry read projection | FEAT-023-B `OperationalTelemetryRecord` / existing operational SQLite | scoped store read exists, but Console has no telemetry read port or rendering | store tenant/scope tests only | `MISSING_CONSOLE_PROJECTION` | add one injected internal operational status/evidence read port; expose only validated safe telemetry fields |
| Health rendering | FEAT-023-C `OperationalStatusSnapshot.health` | legacy Publication operations health is rendered; durable FEAT-023 status snapshots are not | legacy Console and FEAT-023-C store tests | `PARTIAL` | render scoped durable status rows with a separate Health column |
| Readiness rendering | FEAT-023-C status readiness and FEAT-023-F readiness projections | FEAT-023-F deployment/backup/rollback readiness table exists; general component readiness is absent | FEAT-023-F Console tests | `PARTIAL` | render scoped durable component Readiness separately; preserve existing readiness evidence table |
| Freshness rendering | FEAT-023-C `FRESH/STALE/UNKNOWN` | FEAT-023-F readiness table renders freshness; general status freshness is absent | readiness renderer tests | `PARTIAL` | render durable component Freshness as its own column; never infer a threshold |
| Alert rendering | FEAT-023-E durable `ACTIVE/CLEARED` Alert projection | injected authorized Alert read and table already exist | FEAT-023-E/F Console regression | `COMPLETE_PRESERVE` | preserve unchanged and include in integrated acceptance tests |
| Security/privacy summary | FEAT-023-D scoped telemetry/status plus fixed-purpose live authorization | security service authorizes reads, but Console has no bounded security summary | FEAT-023-D service tests only | `MISSING_CONSOLE_SUMMARY` | derive a read-only summary only from returned scoped canonical status/telemetry; no new security state vocabulary |
| Deployment readiness | FEAT-023-F `DEPLOYMENT` projection | existing readiness table renders it when supplied | direct Console test | `COMPLETE_PRESERVE` | verify normal, empty, unavailable and `UNKNOWN` rendering |
| Backup readiness | FEAT-023-F `BACKUP` projection | existing readiness table renders it when supplied | direct Console test | `COMPLETE_PRESERVE` | verify no configuration-only false `READY` presentation |
| Rollback readiness | FEAT-023-F `ROLLBACK` projection | generic readiness row supports it; explicit integrated assertion is absent | domain/store coverage, indirect renderer coverage | `EVIDENCE_GAP` | add direct integrated row assertion and zero rollback control assertion |
| Evidence provenance | immutable telemetry/status/readiness/Alert IDs and safe evidence references | Alert/readiness refs render; telemetry/status provenance is not shown | FEAT-023-E/F tests | `PARTIAL` | render bounded telemetry/status identity, correlation and safe evidence refs; raw payload/detail remains absent |
| Tenant/scope concealment | FEAT-023-D live-authorized service and scoped store | Alert/readiness paths are scoped; status store exposes no scoped Console method | Alert/readiness concealment tests | `PARTIAL_BLOCKER` | add scoped status query joined to existing append-only telemetry binding; Console uses service only |
| Safe errors | existing `CONSOLE_READ_UNAVAILABLE` and `UNAVAILABLE` section state | generic adapter errors are safe; telemetry/status absence has no explicit section state | Console safe-error regression | `PARTIAL` | optional missing/failing port renders bounded `UNAVAILABLE`; no exception, path or raw evidence |
| FEAT-021 accessibility | shared shell, labelled tables, textual status badges, responsive overflow | existing Operations sections use shared primitives | FEAT-021/F20 regressions | `COMPLETE_PRESERVE` | reuse labelled tables/headings/badges and add keyboard/screen-reader assertions only for new sections |
| Read-only architecture | FEAT-020/021 single Console boundary | current Operations page has no mutation controls | architecture/render tests | `COMPLETE_PRESERVE` | assert no form, command, retry, recover, deploy, backup, restore or rollback control |
| FEAT-023 A~G traceability | `FEAT023_TRACEABILITY_MATRIX.md` | A~F verified; G is `PLANNED` | reports DOC-REVIEW-132~137 | `OPEN` | update G only after actual tests and final review; do not pre-close H or Final Gate |

## 4. Proven implementation boundary

The smallest reusable path is:

```text
DurableOperationalEvidenceStore scoped reads
→ SecurityPrivacyOperationalControlService live authorization/MFA/concealment
→ one injected Console operational evidence/status read port
→ existing ConsoleReadAdapter OPERATIONS branch
→ existing renderOperations()
```

No HTTP API ID or new route is required. The existing Console server already serves `/system/operations`; FEAT-023-G changes only its injected read composition and read-only presentation.

## 5. Mandatory preservation

| Invariant | Required result |
|---|---|
| Console mutation controls | `0` |
| New API IDs | `0` |
| New business/monitoring authority | `0` |
| New lifecycle/status vocabulary | `0` |
| Secret/PII/raw provider/prompt/CoT fields | `0` |
| External monitoring/network | `0` |
| New persistence subsystem | `0` |
| Dependency/lockfile changes | `0` |
| `UNKNOWN → READY` conversion | `0` |

## 6. Design disposition

Recommended bounded design is an additive scoped-read extension of the existing operational store/service and the existing Console adapter/renderer. A parallel Console, repository access from UI, generic monitoring API, aggregate dashboard authority or new vocabulary is rejected.

Production implementation remains blocked until Architecture Owner approves this bounded design.
