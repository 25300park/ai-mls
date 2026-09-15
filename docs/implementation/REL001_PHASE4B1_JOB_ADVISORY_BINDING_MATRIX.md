# REL-001 Phase 4B.1 Job-to-Advisory Binding Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-190 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / AI Reviewer / API Owner |
| 기준일 | 2026-09-15 |
| Decision | `DEC-156` (`APPROVED`) |

## 1. Closed static mappings

| Job type | Capability | Application port | Application service owner | Input contract | Output contract | Audit/evidence mapping |
|---|---|---|---|---|---|---|
| `AI_LISTING_PARSE` | `AI-001` | `Ai001ListingParseApplicationPort` | FEAT-022 / Listing Data Owner | `Ai001AdvisoryExecutionRequest`; `AdvisoryExecutionRequest` narrowed to AI-001 and listing-parser schema | `Ai001AcceptedAdvisoryRecord` containing `Ai001Output` | existing DEC-151 Job lifecycle intents/events; result advisory reference/checksum and safe evidence refs |
| `AI_REQUIREMENT_PARSE` | `AI-004` | `Ai004RequirementParseApplicationPort` | FEAT-022 / Business Owner | `Ai004AdvisoryExecutionRequest`; narrowed to AI-004 and requirement-parser schema | `Ai004AcceptedAdvisoryRecord` containing `Ai004Output` | same existing Job lifecycle mapping; no new Audit event |
| `AI_MATCHING` | `AI-005` | `Ai005MatchingApplicationPort` | FEAT-022 / Matching Owner | `Ai005AdvisoryExecutionRequest`; narrowed to AI-005 and matching-result schema | `Ai005AcceptedAdvisoryRecord` containing `Ai005Output` | same existing Job lifecycle mapping; no new Audit event |

Schema IDs are exactly:

- AI-001: `urn:ai-mls:schema:listing-parser-output:v0.1`
- AI-004: `urn:ai-mls:schema:requirement-parser-output:v0.1`
- AI-005: `urn:ai-mls:schema:matching-result:v0.1`

## 2. Construction rules

The handler-specific adapter constructs only its statically narrowed request from trusted durable Job tenant/scope, initiating-principal provenance, immutable input reference/version and approved prompt/config references. FEAT-022's existing resolver remains authoritative for subject/provenance/input/evidence fingerprints.

The accepted advisory maps to Job `resultReference`, `resultChecksum` and bounded `evidenceRefs`. It does not become verified truth or business mutation authority.

## 3. Prohibitions

- generic AI execution Job: `0`
- caller-supplied capability dispatch: `0`
- dynamic service lookup: `0`
- handler provider/model/prompt/retry/credential logic: `0`
- current Session reconstruction: `0`
- direct handler final API-016 Audit Event creation: `0`

## 4. Closure

Job-to-Advisory binding: `3/3 CLOSED`. Concrete adapters remain an implementation gap.
