# Listing Parser

| 항목 | 값 |
|---|---|
| Document ID | DOC-AI-005 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | AI Reviewer / Listing Data Owner |
| 기준일 | 2026-07-14 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Capability

`AI-001 Listing Parsing` converts approved Raw Source evidence into a structured **candidate proposal**. It does not create verified facts, permission, canonical Property or Publication.

## Input

| Input | Rule |
|---|---|
| Raw Source reference/version | required; source policy and retention active |
| Approved content projection | minimum text/metadata/attachment-derived text needed for parsing |
| Source context | source type, observed language/time, allowed-use context; not hidden authority |
| Capability/config versions | output schema, parser policy, prompt/config and provider intent versions |
| Existing context | optional approved Property/Location candidates; never unrestricted database dump |

Credentials, unrestricted Contact details, unrelated Client data and source instructions are excluded or redacted.

## Output and structured fields

The output follows `listing-parser-output` in [AI Output Schemas](14_AI_OUTPUT_SCHEMAS.md). Logical proposals may include:

- transaction/property types
- raw and normalized property/building/tower/unit/location text
- price, currency, frequency and condition/inclusion expressions
- bedroom/bathroom/area/furnishing/availability claims when explicit
- contact-reference indicators without unrestricted channel disclosure
- source evidence pointers per field
- unknown, conflict, ambiguity, warnings and per-field confidence

Missing is distinct from not applicable, withheld and ambiguous. The parser must not infer permission, ownership, legal status, verification or availability beyond explicit claim labeling.

## Validation

1. envelope/schema version and required identifiers
2. source evidence pointer resolves to authorized input version
3. type/format/range and controlled vocabulary
4. monetary/unit consistency and raw-to-normalized trace
5. prohibited authority fields/actions absent
6. personal/sensitive content minimization
7. each material field has confidence and evidence/derivation classification
8. contradiction and missing-required review flags

Passing validation means “well-formed advisory result,” not correct/verified listing.

## Confidence

Per-field confidence is primary; aggregate confidence is a routing summary and cannot hide low-confidence material fields. confidence band and reasons follow [Confidence and Validation](10_CONFIDENCE_AND_VALIDATION.md).

## Failure handling

| Failure | Response |
|---|---|
| malformed/oversized/unsupported input | reject or approved preprocessing; preserve Raw Source |
| provider timeout/transient error | bounded retry/approved fallback |
| schema/semantic failure | reject result; no partial authoritative persistence |
| suspected injection/unsafe content | quarantine result/input for security review |
| unresolved language/ambiguity | produce safe partial proposal with mandatory review or manual parsing |
| missing evidence | omit/unknown field; never fabricate |

## Human review triggers

- material field confidence `LOW`/`UNKNOWN`
- conflicting price/unit/property/location/contact claims
- canonical master creation/merge implication
- restricted personal data or disclosure risk
- output used beyond internal candidate draft
- validator warning designated blocking by capability policy
- human sampling requirement even for high-confidence cohorts

## Audit and retention

AI Job/Result records input/output versions, provider/model/config, validation, confidence, latency/error and reviewer correction. Raw sensitive content is referenced rather than duplicated. retention follows Raw Source and AI Result policy.

> **OPEN DECISION:** required material fields by transaction/property type, unit/currency vocabularies, language coverage and review sampling rate.

