# REL-001 Phase 1G-B Idempotency Closure Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-076 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Domain Owners / Data Owner |

`requestId` remains correlation evidence and is not a universal idempotency key. Store readiness requires every authoritative mutation in its approved surface to have an evidence-backed replay classification.

| Store | Existing supported classification | Covered mutation | Remaining authoritative mutations | Store result |
|---|---|---|---|---|
| Source Registry | none; `requestId` is correlation only | none | proposal key/fingerprint required by Phase 1A | `UNRESOLVED_IDEMPOTENCY` |
| Intake | `EXISTING_IDEMPOTENCY_KEY` only at API-017 job request boundary | AI request handoff only | create, attach, validate, review and local outcome routing | `UNRESOLVED_IDEMPOTENCY` |
| Property | `VERSION_CONFLICT_ONLY` for existing node decision | update conflict protection | proposal, alias and correction-proposal replay identity | `UNRESOLVED_IDEMPOTENCY` |
| Listing | `EXISTING_IDEMPOTENCY_KEY` for Candidate create; `VERSION_CONFLICT_ONLY` for updates | Candidate creation and stale-write rejection | Offer/Duplicate creation and revision/decision replay | `UNRESOLVED_IDEMPOTENCY` |
| Contact | `VERSION_CONFLICT_ONLY` for existing updates | stale-write rejection | create/correct/channel/attempt/DNC logical mutation identity | `UNRESOLVED_IDEMPOTENCY` |
| Client / Requirement | `VERSION_CONFLICT_ONLY` for versioned mutations | stale-write rejection | Client/Requirement create and transition replay | `UNRESOLVED_IDEMPOTENCY` |
| Matching | `EXISTING_IDEMPOTENCY_KEY` for Match request; `VERSION_CONFLICT_ONLY` for result update | Match run request and stale-write rejection | review/stale intent replay required by Phase 1A | `UNRESOLVED_IDEMPOTENCY` |

## Result

- Resolved idempotency: `0/7` stores.
- Unresolved idempotency: `7` stores.
- No generic table, universal key, new command identity or request-ID semantics is authorized.

## Phase 1G-C disposition

위 수치는 Phase 1G-B 당시 판정이다. [DOC-DEV-080](REL001_PHASE1GC_IDEMPOTENCY_POLICY_DECISION.md)의 후속 승인으로 current result는 resolved `7/7`, unresolved `0`이다. Generic table과 universal `requestId` semantics는 계속 금지한다.
