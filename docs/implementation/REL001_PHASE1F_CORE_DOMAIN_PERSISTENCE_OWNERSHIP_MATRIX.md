# REL-001 Phase 1F Core Domain Persistence Ownership Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-067 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Data Owner / Domain Owners |
| 적용 범위 | REL-001 / Staging Core durable authority |

## Physical and logical rule

Existing repository persistence patterns and built-in `node:sqlite` may be reused without a dependency. One physical technology or configured database file may be shared only when tables, repositories, transactions and ownership remain domain-specific. A generic Core repository/UoW is prohibited.

## Ownership classification

| Domain boundary | Canonical aggregates/state | Classification | Required bounded store |
|---|---|---|---|
| Identity / Session | Session, family, version, revocation evidence | `EXISTING_DURABLE_REUSE` | Phase 1D `DurableSessionUnitOfWork` |
| Authorization authority | Role/assignment/team-scope policy sources | `EXISTING_DURABLE_REUSE` | existing durable Administration authority plus live resolver; Staging composition still required |
| Source Registry / API-003 read-proposal boundary | Source and source-policy proposal/read state only within existing ownership | `BOUNDED_DOMAIN_STORE_REQUIRED` | Source-owned repository/UoW; Connector/API-018 store is not a substitute |
| Intake | Intake aggregate, evidence references, review history, idempotency | `BOUNDED_DOMAIN_STORE_REQUIRED` | Intake-owned repository/UoW |
| Property | Property nodes, aliases and approved correction-proposal evidence | `BOUNDED_DOMAIN_STORE_REQUIRED` | Property-owned repository/UoW |
| Listing | Candidate, Offer, Duplicate Group, revisions/decisions/idempotency | `BOUNDED_DOMAIN_STORE_REQUIRED` | Listing-owned repository/UoW |
| Contact | Contact, Channel, Contact Case and Communication history | `BOUNDED_DOMAIN_STORE_REQUIRED` | Contact-owned repository/UoW with privacy/audit binding |
| Client / Requirement | Client, Requirement and immutable revision history | `BOUNDED_DOMAIN_STORE_REQUIRED` | Client/Requirement-owned repository/UoW |
| Matching | Match Run, Match Result, review/history/idempotency | `BOUNDED_DOMAIN_STORE_REQUIRED` | Matching-owned repository/UoW; API-017 job truth remains separate |

## Store contract requirements

Each required store must define before implementation:

- canonical aggregate identity and authoritative fields;
- tenant/team/scope binding and concealment-safe lookup;
- transaction boundary matching existing aggregate ownership;
- existing expected-version/CAS invariants where the domain already versions state;
- command-owned idempotency and conflicting-fingerprint rejection;
- restart/reopen durability and rollback;
- append-only revision/decision/evidence where already canonical;
- mandatory audit/evidence reference without storing raw secrets or unsafe payloads.

Persistence must not invent a lifecycle transition, cross-domain transaction owner or business authority.

## Result

| Classification | Count |
|---|---:|
| `EXISTING_DURABLE_REUSE` | `2` boundaries |
| `BOUNDED_DOMAIN_STORE_REQUIRED` | `7` stores |
| `BLOCKED_DOMAIN_OWNERSHIP` | `0` |

Store ownership is resolved; Production implementation authorization is not granted by this design document.

Related: [Phase 1A Persistence Ownership](REL001_PHASE1A_CORE_PERSISTENCE_OWNERSHIP_MATRIX.md), [Phase 1F Eligibility](REL001_PHASE1F_TRANSPORT_ELIGIBILITY_MATRIX.md).
