# REL-001 Phase 3E API-017 Recovery Traceability

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-151 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner |
| 기준일 | 2026-09-15 |
| 기준 commit | `6c67bfa45a3c604cefe4960c26fdcd9a42a198c3` |

## 1. Scope

Phase 3C durable Job store와 Phase 3D explicit one-shot runtime의 기존 계약을 유지하면서, concurrency, stale result, restart, interruption, idempotency, lineage, append-only evidence 및 safe failure 경계를 검증한다. 구현 변경은 기존 `DurableJobStore`의 read-integrity와 error-normalization 경계에 한정한다.

## 2. Required invariant traceability

| Required invariant | Production boundary | Direct / regression evidence | Result |
|---|---|---|---|
| concurrent execution single winner | SQL version CAS in `startJob`; one-shot runtime invokes only after durable start | `Phase 3E two durable adapters have one start winner...`; Phase 3D concurrent invocation | PASS |
| stale worker/result rejection | `succeedJob` / `failJob` expected version, attempt and worker binding | stale success after cancel; stale failure after committed success | PASS |
| terminal immutability | lifecycle validator plus SQL CAS and append-only history | Phase 3C terminal lifecycle; Phase 3E terminal replay after restart | PASS |
| exact replay / conflicting replay | owner-local operation idempotency and immutable fingerprint | Phase 3C submit/cancel/manual-successor exact and conflicting replay | PASS |
| restart / interrupted execution | durable `RUNNING` is preserved; runtime never blindly re-executes it | interrupted final persistence remains `RUNNING`; Phase 3D restart test | PASS |
| CAS failure after handler result | completion mutation uses the start winner's version and attempt identity | stale success and stale mapped failure tests | PASS |
| manual `RetryAsSuccessor` uniqueness | predecessor version CAS plus unique durable lineage | Phase 3C manual retry; Phase 3E missing-lineage corruption rejection | PASS |
| tenant/scope/provenance preservation | scoped reads and immutable stored identity | Phase 3E restart concealment; Phase 3C tenant/scope restart tests | PASS |
| audit evidence single append | Job mutation and enriched audit intent share owner transaction | two-adapter start audit assertion; Phase 3C rollback and append-only tests | PASS |
| corrupt durable state fail closed | current/latest-history equality, contiguous version history, bidirectional lineage | current row/history mismatch; missing successor lineage | PASS |
| safe durable errors | public mutation open guard and transaction acquisition normalization | lock acquisition and all closed-store mutations | PASS |
| unknown handler fail closed | closed Phase 3D registry | Phase 3E unknown durable handler after restart | PASS |

## 3. Required RED-case mapping

| Brief RED case | Evidence | Outcome |
|---|---|---|
| two workers complete same Job | two-store start winner plus stale completion regression | one durable winner |
| stale worker overwrites newer version | stale success after cancellation | `VERSION_CONFLICT`; newer state preserved |
| success overwritten by failure | stale mapped failure after success | success preserved |
| failure overwritten by stale success | version-bound completion plus terminal lifecycle regression | stale completion rejected |
| terminal Job reopens | Phase 3C lifecycle/reopen regression | rejected |
| same command executes twice | five-operation replay regression | prior result only |
| same command with different payload | conflicting replay regression | deterministic conflict |
| handler duplicate invocation | terminal replay after restart | handler `0` |
| restart loses version/state | durable reopen regressions | state/version preserved |
| process interruption after handler | injected final audit-intent failure | durable `RUNNING`; no blind rerun |
| CAS failure persists stale result | stale success/failure tests | stale result absent |
| duplicate retry creates two successors | Phase 3C manual successor regression | successor `1` |
| successful predecessor retried | Phase 3C successful retry rejection | rejected |
| automatic successor appears | surface and lineage assertions | `0` |
| recovery uses current tenant/session provenance | restart concealment/provenance regression | durable identity preserved |
| stale worker duplicates audit evidence | two-store winner audit count | duplicate `0` |
| raw SQLite/path/stack error leaks | lock/closed-store tests | bounded store error |
| corrupt lifecycle state read | current/history integrity test plus lifecycle-shape regression | fail closed |
| unknown handler fallback | restart unknown-handler test | fail closed |

## 4. Zero-surface assertions

| Surface | Result |
|---|---|
| new lifecycle state / lease / retry policy | `0 / 0 / 0` |
| automatic retry / scheduler / polling / worker daemon | `0 / 0 / 0 / 0` |
| new handler type / API operation / API-016 event | `0 / 0 / 0` |
| direct final API-016 Audit Event creation | `0` |
| queue / HTTP / RPC / external provider or network | `0 / 0 / 0 / 0` |
| dependency / lockfile change | `0 / 0` |

## 5. Verification evidence

- Expected RED: initial integrity/error cases `0/4 PASS`; independent-review identity/lineage/overlapping replay cases `12/15 PASS`; concealment regression `0/1 PASS` before their respective corrections.
- Phase 3E direct: `16/16 PASS`.
- Phase 3E plus Phase 3C/3D/API-017 focused: `61/61 PASS`.
- Jobs, API-016 and seven Phase 1G stores affected regression: `159/159 PASS`.
- Fresh clean-build full regression: `1412/1412 PASS`; fail/cancelled/skipped/todo `0/0/0/0`.
- Lint, typecheck, clean build and verification constituents: `PASS`.
- Dependency audit: `NOT_RUN`; Phase 3E scoped network approval 없음.
