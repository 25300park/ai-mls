# F20-A Operations Console Canonical Inventory & Gap Report

| 항목 | 값 |
|---|---|
| Document ID | F20-A-REPORT |
| Version | v0.1 |
| Status | IN REVIEW |
| Owner | Architecture Owner |
| Completion date | 2026-09-03 |
| Brief | F20-A — Operations Console Canonical Inventory |
| Baseline | `3407f84b084cc546789040eff2c77370baff8173` |
| Final Recommendation | `APPROVE_F20_A_CANONICAL_CONSOLE_INVENTORY` |

## 1. Objective

기존 Operations/Admin Console, UI-031~036, API-014/016/018/019 및 F17/F18/F19 runtime evidence를 대조해 F20이 재사용할 수 있는 safe read/command boundary와 정확한 gap을 확정한다. Production UI와 backend behavior는 변경하지 않는다.

## 2. Documents read

- Architecture Owner의 `F20 — OPERATIONS CONSOLE EXPANSION CONTINUOUS EXECUTION BRIEF`.
- [Book 7 Screen Catalog](../book-7/04_SCREEN_CATALOG.md), [Screen Specifications](../book-7/05_SCREEN_SPECIFICATIONS.md), [Screen Registry](../book-7/15_SCREEN_REGISTRY.md).
- [API Registry](../00_API_REGISTRY.md), [Security Registry](../00_SECURITY_REGISTRY.md), [Operations Registry](../00_OPERATIONS_REGISTRY.md).
- [FEAT-019 Final Gate](F19_FINAL_GATE_REPORT.md) 및 F17/F18/F19 implementation evidence.
- Current Console server, read/administration adapters, renderer, composition 및 tests.
- API-014, API-016, API-018, API-019와 F19 recovery contracts/application boundaries.

## 3. Canonical boundary summary

Console은 business authority가 아니다. 모든 read/action은 trusted Session을 사용하는 existing application/runtime/API boundary를 통과해야 하며 direct database/provider/connector access는 금지한다.

| Boundary | Canonical use in F20 | Authority limit |
|---|---|---|
| API-014 | Publication 6 queries와 승인된 12 commands | Publication business authority는 backend에 유지 |
| API-016 | scoped audit/history query | evidence read/export only |
| API-018 | Connector technical operations; HTTP query는 `ReadBatchStatus` | business reconciliation, forced checkpoint 금지 |
| API-019 | HTTP query `ReadExternalMapping`, `ReadIntegrationContract` | technical identity/evidence only; command는 internal-only |
| F19 | `READ_RECOVERY_CASE`와 bounded internal orchestration | duplicate domain truth/API-017 recovery authority 금지 |
| API-015 | existing UI-036 administration | F16-owned; F20에서 변경하지 않음 |

## 4. A — Existing screens

Current browser routes는 정확히 다음 9개다.

| Route | Screen | Current behavior |
|---|---|---|
| `/` | Dashboard | Publication-centered health summary |
| `/publication/operations` | UI-031 | API-014 Publication operations read |
| `/publication/revalidation` | UI-032 | API-014 revalidation read |
| `/publication/recovery` | UI-033 | API-014 Publication recovery read only |
| `/publication/audit` | UI-035 | API-014 bounded Publication audit history |
| `/administration` | UI-006 | API-015 administration overview |
| `/administration/governance` | UI-036 | existing F16 governed administration controls |
| `/system/projection` | PRJ-002 | Listing Projection read only |
| `/system/operations` | Operations | Publication component health/metrics |

UI-034 Background Jobs route는 없다. Connector, External Integration 및 cross-domain Recovery Case 전용 route도 없다.

## 5. B–D — Existing reads and mutations

### Existing read-only views

- API-014: `GET_PUBLICATION`, `GET_PUBLICATION_OPERATIONS_VIEW`, `GET_PUBLICATION_REVALIDATION_VIEW`, `GET_PUBLICATION_RECOVERY_VIEW`, `GET_PUBLICATION_AUDIT_VIEW`, `GET_LISTING_PROJECTION`.
- API-018: `ReadBatchStatus`만 canonical query/HTTP read다.
- API-019: `ReadExternalMapping`, `ReadIntegrationContract`만 HTTP read다.
- F19: `READ_RECOVERY_CASE`가 exact `recoveryCaseId`에 대해 존재하지만 Runtime/Host/HTTP와 Console adapter는 없다.
- API-016: `AdminAuditApi.queryAudit()`가 scoped query를 제공하지만 Console integration은 없다.

### Existing backend mutations

- API-014 command surface는 12개지만 Console mutation route는 없다.
- API-018 HTTP technical commands는 존재하나 operator Console용 business control이 아니다. `AdvanceCheckpoint`는 internal-only다.
- API-019 commands 4개는 internal-only이며 HTTP query surface에서 실행할 수 없다.
- F19 resolve/authorize/recovery execution은 internal orchestration/application 경계이며 public Console mutation surface가 아니다.
- API-015 governed administration mutation만 현재 Console에 연결되어 있다.

### Existing UI mutations

UI mutation은 `/api/console/administration/command` 하나뿐이다. `/api/console/publication/command` 및 다른 non-administration POST는 명시적으로 거부된다. 따라서 F20 시작 시 Publication/Connector/Recovery direct UI mutation은 `0`이다.

## 6. E–I — Operational domain inventory

| Area | Existing safe evidence | Current Console gap |
|---|---|---|
| Recovery/Reconciliation | API-014 Publication recovery view; F19 exact-case read | F19 case list, parent/child navigation, finding/disposition split view 없음 |
| Connector | API-018 batch status; durable instance/lease/invocation/checkpoint/health records | batch 외 safe query 및 Console adapter/route 없음 |
| Publication | four existing API-014 operational views | command UX, permission projection, stale/confirmation/idempotency UX 없음 |
| Source/Intake | API-015 Source governance; F18 admission/Connector execution internals | operational Source/Connector read model 없음 |
| External Integration | API-019 mapping/contract reads | observation/conflict evidence list와 technical reconciliation drill-down 없음 |
| Audit/History | Publication audit view; API-016 query service | cross-domain Console evidence adapter/route 없음 |
| Health | Publication component operations read | Connector/API-019/F19 readiness/status projection 없음 |

## 7. J–L — Authority, MFA/SoD, version and idempotency

- Book 7 assigns UI-031 to Publication Owner/Reconciler, UI-033 to named Operations/Domain Owner, UI-035 to Security/Governance Owner and UI-036 to Administration Owner.
- Current Publication read adapter resolves a trusted active Session and evaluates `resource.view` or `audit.query`; UI-036 uses the existing backend API-015 authority.
- Current Console does not display authoritative actor capability, MFA state, SoD conflicts or executable eligibility for F17/F18/F19 actions.
- API-014/F18/F19 mutation contracts already enforce current authorization, expected version and idempotency. F20 must not duplicate or weaken those checks.
- No new effect-producing UI control is safe until exact closed operation, current resource version, capability/MFA/SoD requirements, confirmation and stale refresh behavior are proven.

## 8. M — Unsafe or missing UX flows

The following are gaps, not authorization to invent controls.

- No F19 case discovery/list path; known-ID `READ_RECOVERY_CASE` only.
- No Console separation of F19 finding versus disposition.
- No nested recovery case lineage navigation.
- No Connector instance/lease/invocation/checkpoint/health query surface beyond batch read.
- No API-019 observation/conflict evidence list read.
- No general API-016 audit/evidence Console view.
- No current authority/MFA/SoD/eligibility projection for potential actions.
- No non-administration stale-state/idempotent submission UX.
- No high-impact confirmation flow outside UI-036.
- No UI-034 job operations route; F20 does not create it without a separately usable existing boundary.

Unsupported views/actions must render `UNAVAILABLE` and remain non-executable. Free-text finding, forced retry/recovery/checkpoint, silent remap, raw provider data and credential UI remain prohibited.

## 9. N — Accessibility inventory

Existing Console uses semantic headings/tables/labels, text status badges, screen-reader-only labels, visible focus styling, responsive single-column forms and horizontal table overflow. Current tests cover route rendering, escaping, safe states and controlled confirmation mechanics.

Gaps requiring F20-G verification:

- keyboard sequence across new operations screens;
- confirmation focus entry/return and Escape/cancel behavior;
- live status/error announcement;
- error-to-control association;
- small-screen evidence/lineage navigation;
- contrast and status-not-by-color checks for new status vocabulary.

Current accessibility status: `PARTIALLY_VERIFIED`.

## 10. O — Exact canonical gaps and subphase applicability

| Subphase | Applicability | Bounded conclusion |
|---|---|---|
| F20-B Operations Read Models / API Projection | `REQUIRED` | Compose only existing safe query/application boundaries; unsupported list/detail remains `UNAVAILABLE` |
| F20-C Publication Operations Console | `REQUIRED` | Existing API-014 reads are sufficient for visibility; mutation controls require separate per-operation proof |
| F20-D Connector / Source Operations Console | `REQUIRED` | Start read-only with API-018 `ReadBatchStatus`; do not invent connector list/force-checkpoint controls |
| F20-E Reconciliation / Recovery Console | `REQUIRED` | Exact known-case read may be projected; list/discovery and mutations remain unavailable unless existing closed boundary proves sufficient |
| F20-F Audit / Evidence / Lineage | `REQUIRED` | Reuse API-014/API-016/API-019/F19 safe evidence only |
| F20-G UX Security / Accessibility / Stale State | `REQUIRED` | Mandatory negative/positive UX matrix |
| F20-H Final Integration / Hardening | `REQUIRED` | Full final gate |

No subphase is marked `NOT_APPLICABLE` at F20-A. UI-034 job operations remains outside initial implementation because no F20-specific approved safe control requirement was found.

## 11. Mandatory Stop review

F20-A itself requires no new API ID, backend business command, lifecycle state, decision vocabulary, authority, ownership change, persistence, provider/network/credential activation or direct data/execution access.

Mandatory Stop Condition 18 is not yet triggered because F20-B can begin by composing existing safe reads and representing unsupported capabilities as `UNAVAILABLE`. During F20-B or later, if a required control cannot be represented without extending a closed canonical operation or authority, that control and the continuous execution must stop for AO review.

## 12. Files created

- `docs/reviews/F20_A_OPERATIONS_CONSOLE_INVENTORY_GAP_REPORT.md` — canonical inventory, gap matrix and subphase applicability.

## 13. Files modified

None.

## 14. Key decisions added

- F20-B~H applicability is confirmed as listed above.
- F20 begins read-first. The existence of an API command does not authorize a UI action.
- Closed backend gaps render `UNAVAILABLE`; Console convenience cannot create a new operation.
- F16 UI-036 administration remains unchanged and F16-owned.

## 15. Open decisions

None for starting F20-B. Any later need for a new query/command/authority invokes the Mandatory Stop Conditions.

## 16. Inconsistencies found

- Book 7 describes UI-034 and broad UI-033/UI-035 concepts, while the executable Console currently exposes only Publication-centered UI-033/UI-035 and no UI-034. This is an implementation gap, not permission to expand backend authority.
- The repository has no standalone `docs/00_UI_REGISTRY.md`; Book 7 Screen Registry is the canonical UI registry evidence used here.

## 17. Validation performed

| Check | Result |
|---|---|
| Main baseline and isolated worktree | PASS |
| Current routes/screens inventory | PASS |
| API-014/016/018/019 operation inventory | PASS |
| F19 read/mutation boundary inventory | PASS |
| Security/Operations role and control mapping | PASS |
| Direct DB/provider/connector paths in Console | 0 |
| New API/authority/state/persistence | 0 |
| Subphase applicability and stop conditions | PASS |

## 18. Known limitations

- Inventory does not claim unavailable Connector/F19/API-019 list projections exist.
- No browser visual acceptance or accessibility automation was run because F20-A changes documentation only.
- Dependency audit is not required for this documentation-only subphase.

## 19. Next brief prerequisites

- F20-B must begin with RED tests for the bounded read adapter/projection and `UNAVAILABLE` containment.
- Reuse the existing Console composition and trusted Session; do not create a second Console state/client layer.
- Stop if F20-B requires a new canonical operation, authority or direct persistence access.

## Completion statement

F20-A canonical inventory, gap matrix and subphase applicability are complete. Final Recommendation은 `APPROVE_F20_A_CANONICAL_CONSOLE_INVENTORY`이며 production changes는 `0`이다. Continuous authorization에 따라 다음 단계는 F20-B다.
