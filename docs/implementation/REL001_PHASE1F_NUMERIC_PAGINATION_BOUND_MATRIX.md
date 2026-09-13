# REL-001 Phase 1F Numeric / Pagination Bound Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-066 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / API Owner / Security Owner |
| 적용 범위 | REL-001 / Staging API-001~010 transport fields |

## Classification rule

`CANONICAL_BOUND_EXISTS`는 frozen/approved contract의 exact value, `STORAGE_OR_DOMAIN_BOUND_EXISTS`는 동일 domain meaning을 보존하는 existing invariant, `NO_CANONICAL_BOUND`는 값 발명이 금지된 blocker다. Domain validation such as non-empty string is not a numeric transport bound.

## Field-level matrix

| Field family / affected operations | Classification | Exact existing value | Transport disposition |
|---|---|---:|---|
| Match execution input candidate cohort — API-010 Request Match | `STORAGE_OR_DOMAIN_BOUND_EXISTS` | `100` | reusable only for synchronous domain cohort validation; does not make the async API-017 route ready |
| Match review shortlist — current Matching domain projection | `STORAGE_OR_DOMAIN_BOUND_EXISTS` | `20` | internal projection invariant only; not a list-page maximum |
| Session idle lifetime — protected operations | `CANONICAL_BOUND_EXISTS` | `30m` | freshness only, not request size |
| Session absolute lifetime — protected operations | `CANONICAL_BOUND_EXISTS` | `12h` | freshness only, not request size |
| Privileged MFA freshness — protected operations | `CANONICAL_BOUND_EXISTS` | `15m` | authorization only, not request size |
| `x-session-id`, `x-correlation-id`, `x-request-id`, `idempotency-key` lengths | `NO_CANONICAL_BOUND` | — | all protected/command routes remain blocked where bounded parsing is required |
| Path identifier lengths for Session, Source, Intake, Property, Candidate, Offer, Duplicate Group, Contact, Channel, Contact Case, Client, Requirement, Match Run/Result | `NO_CANONICAL_BOUND` | — | affected single-resource routes remain blocked |
| `reason`, `purpose`, names, labels, query, language, evidence/fingerprint/reference strings | `NO_CANONICAL_BOUND` | — | affected bodies/queries remain blocked |
| Reference, method, purpose, constraint, location, gap, signal and contradiction arrays | `NO_CANONICAL_BOUND` | — | affected commands remain blocked |
| Nested normalized body byte size / object key count | `NO_CANONICAL_BOUND` | — | affected commands remain blocked |
| Cursor length and encoding size | `NO_CANONICAL_BOUND` | — | collection routes remain blocked |
| Page `limit` default/maximum | `NO_CANONICAL_BOUND` | — | collection routes remain blocked |
| History/result response collection maximum | `NO_CANONICAL_BOUND` | — | history/result reads remain blocked |
| Deadline horizon/serialized timestamp length for API-004 AI request | `NO_CANONICAL_BOUND` | — | also `DEFERRED_TO_PHASE_3` |

## Pagination matrix

| Operation | Model | Ordering | Continuation | Maximum | Result |
|---|---|---|---|---|---|
| API-003 List Sources | opaque cursor named | exact stable sort absent | binding rule conceptual only | absent | BLOCKED |
| API-005 Search Property Master | allowlisted sort/cursor conceptual | exact order absent | absent | absent | BLOCKED |
| API-006 List Candidates | cursor/limit named | exact order absent | absent | absent | BLOCKED |
| API-007 Search Contacts | filter and result contract absent | absent | absent | absent | BLOCKED |
| API-009 Read History | immutable history required | exact page/order contract absent | absent | absent | BLOCKED |
| API-010 List Results | ranked order exists in domain | cursor continuation absent | absent | absent | BLOCKED |

## Result

- Numeric-bound blockers: `45` operations. Every operation crosses at least one unbounded header, identifier, input or bounded-response field family.
- Pagination blockers: `6` operations.
- New numeric values introduced: `0`.

Related: [API Principles](../book-6/01_API_PRINCIPLES.md), [Phase 1F Eligibility](REL001_PHASE1F_TRANSPORT_ELIGIBILITY_MATRIX.md).
