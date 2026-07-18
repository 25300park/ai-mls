# Requirement Parser

| 항목 | 값 |
|---|---|
| Document ID | DOC-AI-008 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | AI Reviewer / Business Owner |
| 기준일 | 2026-07-14 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Capability

`AI-004 Requirement Parsing` converts approved natural-language client input into a structured Requirement proposal while preserving original wording, ambiguity and client confirmation needs. It cannot silently activate/change a Requirement or infer consent.

## Input

- original requirement text/reference and language
- Client/Requirement identifiers and current revision where authorized
- approved Location/property-type vocabularies
- parser/output schema/config versions
- minimum conversation context explicitly selected for this purpose

Unrelated contact history, sensitive notes and full conversation archives are excluded by default.

## Parsed concepts

| Concept | Required interpretation |
|---|---|
| Intent | rent/buy/other approved transaction intent or unknown |
| Budget | amount/range, currency, frequency, inclusions, flexibility and ambiguity |
| Location | desired/avoided raw text, canonical candidate, near/radius/travel semantics, priority |
| Property type | requested type(s), exclusions and confidence |
| Preferences | soft preferences with priority/rationale where explicit |
| Constraints | hard constraints only when explicit or human-confirmed |
| Timing | desired move/view/decision window with source wording |
| Unknown/clarification | missing/conflicting items and suggested questions (not production prompt text) |

## Output schema

Output follows `requirement-parser-output`: exact input revision, proposed structured fields, raw spans/evidence references, `HARD/SOFT/INFORMATIONAL/UNKNOWN` classification, confidence per field, contradictions, validation warnings and clarification needs.

## Parsing rules

- “prefer,” “must,” “avoid,” “near,” “around,” “up to” and negation remain semantically distinct.
- no preference, unknown and omitted are different states.
- currency/frequency/inclusions are not assumed from amount alone.
- vague location does not become exact radius/coordinates.
- demographic/sensitive attributes are not inferred or used unless explicitly lawful, necessary and approved; discriminatory matching is prohibited.
- AI-generated clarification is a suggested topic, not an autonomous client message.

## Validation and human review

Validator checks vocabulary, monetary/timing consistency, hard/soft contradictions, evidence spans, privacy policy and current input revision. Human confirmation is mandatory for hard constraints, material budget/location interpretation, contradictions, sensitive preference, low/unknown confidence and any active Requirement revision.

## Failure and fallback

If input is unsupported, unsafe, too ambiguous or provider fails, retain original text and route to manual structured entry. Partial output may be shown as draft only when valid fields and missing/ambiguous flags are explicit.

## Quality metrics

field precision/recall, hard-vs-soft classification, negation accuracy, budget/location correctness, clarification rate, human correction, privacy finding and downstream match improvement by language/cohort.

> **OPEN DECISION:** supported languages, sensitive/disallowed attributes, currency/fee semantics, confirmation policy and evaluation dataset.

