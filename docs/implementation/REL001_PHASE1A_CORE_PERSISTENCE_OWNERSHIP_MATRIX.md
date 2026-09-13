# REL-001 Phase 1A Core Persistence Ownership Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-054 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Data Owner / Domain Owners |
| Baseline | `eccabb4cb55295815a5ad2e9e78929ec9ecd93e6` |
| Related decision | `DEC-125` (`APPROVED`) |

## 1. Canonical rule

Core persistence remains domain-owned. Phase 1A does not select a physical database, create a generic Core database, or authorize schema/migration. Each owner must expose its own repository/UoW contract; cross-domain composition coordinates through application ports, never shared tables or a global UoW.

## 2. Ownership matrix

| API | Authoritative owner / aggregate | Current implementation | Classification | Required transaction boundary | Idempotency boundary | Audit/evidence boundary |
|---|---|---|---|---|---|---|
| API-001 | Identity: Session, family, refresh consumption | process-local `Map/Set` in `SessionService` | `BOUNDED_DURABLE_EXTENSION` | issue/rotate/revoke plus family/replay state atomically | create/refresh/revoke intent and protected result | login/refresh/revoke outcome; no credential/token value |
| API-002 | Security: current Role Assignment/Policy; Session reference | existing durable Administration role/assignment owner is reusable; Session and decision audit durability remain missing | `BOUNDED_DURABLE_EXTENSION` | read-consistent current Session + assignment/policy evaluation | no mutation; correlation prevents stale decision reuse | immutable authorization decision audit |
| API-003 | Source: Source proposal/read model | process-local Source map | `BOUNDED_DURABLE_EXTENSION` | proposal plus version/history/audit | source proposal key/fingerprint | proposal/read/policy handoff evidence |
| API-004 | Intake: Intake, attachments, review/history; API-017 job ref | process-local Intake map/history | `BOUNDED_DURABLE_EXTENSION` | mutation plus evidence/history/idempotency; job handoff only through API-017 contract | create/evidence/validate/review/request key | append-only provenance/review/job request evidence |
| API-005 | Property: hierarchy, aliases, correction proposals | process-local node/alias maps; correction proposal absent | `BOUNDED_DURABLE_EXTENSION` | proposal/successor plus lineage/audit | correction proposal key | master correction evidence and before/after refs |
| API-006 | Listing: Candidate, Offer, Duplicate Group/history | process-local maps | `BOUNDED_DURABLE_EXTENSION` | aggregate mutation plus history/evidence/idempotency | every create/revision/decision | append-only provenance/duplicate decision evidence |
| API-007 | Contact: Contact, Channel, Case, Communication, DNC | process-local maps/set; protected raw channel value | `BOUNDED_DURABLE_EXTENSION` | privacy mutation plus history/audit/idempotency; protected channel storage owner-bound | attempts/mutations; safe reads | immutable access/disclosure/purpose/communication evidence |
| API-008 | Client: Client relationship | shared process-local Client/Requirement service map | `BOUNDED_DURABLE_EXTENSION` | Client mutation plus consent refs/audit/idempotency | create Client | scoped relationship/access evidence |
| API-009 | Requirement: revisions/history | shared process-local Client/Requirement maps/history | `BOUNDED_DURABLE_EXTENSION` | requirement successor plus history/audit/idempotency; AI job handoff owner-separated | create/revise/transition/request | immutable revision/provenance/job evidence |
| API-010 | Matching: Match Run/Result/history/idempotency | process-local maps | `BOUNDED_DURABLE_EXTENSION` | run/result/review/stale plus history/idempotency/audit | match/review/stale intent | input snapshot/version, ranking/review/stale evidence |

## 3. Required bounded repository/UoW properties

Every missing owner design must prove:

1. immutable snapshots on read and append-only history/evidence;
2. expected-version conditional write at persistence boundary;
3. state/history/audit/idempotency atomic commit where one owner controls them;
4. same key/same fingerprint replay and same key/different fingerprint conflict;
5. restart/reopen persistence, rollback and concurrent writer tests;
6. tenant/scope indexes do not bypass application authorization;
7. production-style Staging composition fails closed without explicit durable configuration;
8. existing process-local adapter is test/development only.

Cross-owner atomicity is not silently claimed. API-004/009/010 job handoff must use the existing API-017 owner contract or remain unavailable; Phase 1A does not create an outbox/message bus.

## 4. Summary

| Result | Count |
|---|---:|
| `EXISTING_DURABLE_OWNER` | `0` APIs / `0` operations fully ready |
| `BOUNDED_DURABLE_EXTENSION` | `10` APIs / `45` operations |
| `DURABLE_BOUNDARY_UNRESOLVED` | `0` |

Ownership is resolved, but implementation is not. Physical persistence and per-owner bounded designs remain AO-gated. Production implementation cannot use current `Map/Set` state as Staging authority.
