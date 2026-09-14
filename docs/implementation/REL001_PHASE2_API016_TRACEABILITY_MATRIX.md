# REL-001 Phase 2 API-016 Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-108 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Security/Governance Owner / Audit Owner |
| 기준 commit | `e5a2cfc9a17cdb20c0c3db1e79e3184e7a09052f` |

## 1. Traceability status

| Requirement | Canonical evidence | Current implementation | Direct verification | Status |
|---|---|---|---|---|
| Intent is not final event | [Phase 1G-C Decision](REL001_PHASE1GC_AUDIT_ATOMICITY_DECISION.md) | seven stores persist intent only | Phase 1G architecture test | PASS |
| API-016 final ownership | [Admin and Audit API](../book-6/10_ADMIN_AND_AUDIT_API.md) | API-016-owned `DurableAuditEventStore`; Core source port is read-only | Phase 2C focused store/materializer tests | PASS — six-source partial runtime |
| Intent materialization | Phase 2C Brief / DOC-DEV-115~119 | strict v2 materializer with closed six-source allowlist | v1/blocker/mapping assertions | PASS — eligible subset only |
| Durable final event | DOC-SEC-008 append-oriented integrity | SQLite final-event store with explicit path and strict schema | reopen and weakened-schema assertions | PASS |
| Exactly-once replay | Phase 1G-C stable intent identity | durable source-domain/intent identity plus canonical fingerprint | replay/restart/conflict assertions | PASS |
| Append-only history | DOC-API-011 correction rule | insert-only table with update/delete triggers | schema and conflict-preservation assertions | PASS |
| Source chronology | DOC-SEC-008 trusted event/ingest time | `occurredAt=committedAt`; separate trusted `materializedAt` | chronology assertion | PASS |
| Tenant/scope preservation | DOC-SEC-008 context/scope principle | immutable TENANT_BOUND/SYSTEM_BOUND visibility in final record | tenant/scope assertion | PASS |
| Trusted actor provenance | DOC-DEV-117 | snapshot or immutable evidence reference only; no Session lookup | processing-time resolver non-use assertion | PASS |
| Safe evidence refs | DOC-SEC-013 privacy/redaction | strict shape, mapping and reference validation; rebuilt bounded event | unknown/raw/path rejection assertions | PASS |
| Failed materialization recoverability | Phase 2 Brief | source port has no mutation/delete method; failed final commit rolls back | injected failure/source retention assertion | PASS |
| No Core final-event ownership | Phase 1G-C Decision | no final event table in Core stores | Phase 1G architecture test | PASS |
| No HTTP/public API expansion | Phase 2 Brief | in-process Staging composition only | source diff inspection | PASS |
| No API-017 semantics | Phase 2 Brief | synchronous bounded consumption only | source diff inspection | PASS |
| Phase 2A structural closure | [Phase 2A Closure Report](../reviews/REL001_PHASE2A_API016_CANONICAL_CLOSURE_REPORT.md) | identity/chronology, visibility, reader and runtime contracts only | document/link/ID validation | PASS |
| Phase 2A mapping closure | [Intent/Event Mapping Matrix](REL001_PHASE2A_AUDIT_INTENT_EVENT_MAPPING_MATRIX.md) | exact event and principal/context mappings absent | Production/Test changes `0` | BLOCKED |
| Phase 2B v2 contract closure | [Versioned Enriched Intent Contract](REL001_PHASE2B_VERSIONED_ENRICHED_INTENT_CONTRACT.md) | docs-only; six source contracts eligible | document/link/ID validation | PARTIAL |
| Legacy v1 containment | [Materialization Eligibility Matrix](REL001_PHASE2B_MATERIALIZATION_ELIGIBILITY_MATRIX.md) | all current v1 intents remain immutable and non-materializable | Production/Test changes `0` | PASS |
| Phase 2C partial runtime | Phase 2C authorization | `DurableAuditEventStore`, `AuditIntentMaterializer`, bounded source port and Staging composition | focused `17/17`; affected `65/65`; full regression recorded in DOC-REVIEW-178 | PASS |
| Client/Requirement exclusion | DOC-DEV-116/119 | sourceDomain and invented `CLIENT_UPDATED` are rejected | direct zero-event assertion | PASS |
| Phase 2D six-source enriched intent wiring | [Phase 2D Source Mapping Traceability](REL001_PHASE2D_SOURCE_MAPPING_TRACEABILITY.md) | six owner-local stores persist strict v2 intents; API-016 read-only adapter composes exactly six ports; Property outcome is canonical `COMPLETED` | Phase 2D focused `90/90` | PASS — direct scope only |
| Phase 2D review corrections | [Phase 2D Completion Report](../reviews/REL001_PHASE2D_COMPLETION_REPORT.md) | stale Phase 1G Property legacy fixture/cleanup corrected test-only; Property runtime/test outcome aligned from `ACCEPTED` to canonical `COMPLETED` | isolated `1/1`; affected `469/469`; full `1351/1351` | PASS; final independent review `Critical 0 / Important 0 / Minor 1 — READY` |
| Phase 2D composed principal coverage | Pre-existing `api016-production-composition.ts` | no `principalEvidenceResolver` injection; `IMMUTABLE_REFERENCE` fails closed in Staging composition | independent review Minor | canonical-compliant, snapshot-only; no resolver support claim; not a Phase 2D defect |

## 2. Required RED matrix

| Required test | Expected canonical behavior | Current result |
|---|---|---|
| duplicate final event | exact replay returns same logical event, append count unchanged | PASS |
| restart identity | durable identity survives reopen | PASS |
| conflicting same intent | fail closed, prior event unchanged | PASS |
| mutable final event | update/delete rejected | PASS — schema triggers verified |
| Core creates final event | architecture boundary rejects ownership duplication | existing boundary PASS |
| tenant binding lost | materialization rejected | PASS |
| caller tenant override | source/trusted binding remains authoritative | PASS |
| unsafe content | unsafe diagnostic/raw payload rejected | PASS |
| processing time replaces chronology | committed chronology remains authoritative | PASS |
| failure deletes intent | intent remains recoverable | PASS |
| API-017 retry semantics | architecture rejects job lifecycle expansion | no Phase 2 Production changes PASS |

## 3. Phase 2D verified boundary

- Source Registry, Intake, Property, Listing, Contact와 Matching의 strict v2 mapping/hardening/API-016 composition 직접 검증은 `90/90 PASS`다.
- Client / Requirement는 `NOT_MATERIALIZATION_READY`이며 current v1 materialization은 `0/7`이다.
- final Audit Event 생성은 API-016-owned `DurableAuditEventStore`와 materializer에만 남는다.
- public HTTP, API-017, dependency와 later-phase completion 추가는 `0`이다.
- Phase 1G Property compatibility assertion의 bounded test-only fixture/cleanup correction과 Property canonical `COMPLETED` outcome alignment를 포함한 fresh isolated/affected/full gate를 통과했다.
- Phase 2D final gate는 `PASS`다.
- Final independent whole-branch review는 `Critical 0 / Important 0 / Minor 1 — READY`다.
- Pre-existing Staging composition은 `principalEvidenceResolver`를 inject하지 않아 `IMMUTABLE_REFERENCE`가 fail closed한다. Composed verification은 snapshot-only이며 resolver support는 Phase 2D 범위나 claim이 아니다.

## 4. Current verdict

Phase 2C의 API-016-owned partial durable runtime과 Phase 2D의 six-source direct wiring은 direct/affected/full regression으로 검증됐다. Existing v1 records, Client / Requirement, public HTTP와 API-017 scheduling은 계속 제외한다.

`APPROVE_REL001_PHASE2D_ENRICHED_AUDIT_INTENT_SOURCE_WIRING`
