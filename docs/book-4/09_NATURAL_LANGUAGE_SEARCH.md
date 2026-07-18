# Natural Language Search

| 항목 | 값 |
|---|---|
| Document ID | DOC-AI-010 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | AI Reviewer / Search Owner |
| 기준일 | 2026-07-14 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Capability

`AI-006 Natural-language Search Interpretation` converts an authorized user's text into a read-only, bounded search interpretation. It does not query unrestricted data itself, broaden the user's authorization, execute writes or expose restricted contacts.

## Natural-language search flow

`User text → intent/entity extraction → validated search interpretation → authorization/policy filter → canonical search/index → result policy → user`

The AI output ends before authoritative query execution. The application compiles only allowlisted filters/operators.

## Intent extraction

Allowed intents include property/candidate discovery, requirement-based search, comparison, status/freshness inquiry and authorized operational lookup. write/approve/publish/delete/export/contact-unmask intents are rejected or routed to their explicit non-AI workflow.

## Entity extraction

- location/property/building/tower/unit raw mentions and canonical candidates
- transaction/property type, price/budget context and unit attributes
- availability/freshness/verification status request as policy-safe filters
- date/time and sort/ranking preferences
- unknown, ambiguity, negation and clarification needs

Extracted entity is a proposal; canonical resolution uses Property/Search models and authorization.

## Search interpretation

Output follows `search-interpretation-output`: supported intent, allowlisted filters/operators, sort, requested result class, unresolved terms, confidence, warnings and required clarification. It contains no SQL, API route, executable query string or direct database command.

## Authority and privacy

- model receives user role/policy context only as minimal abstract capabilities, not as permission to decide access.
- application rechecks authorization and audience eligibility for query and each result.
- contact/raw/client/audit search requires dedicated scope; default natural search cannot enumerate restricted data.
- search log/prompt retention minimizes sensitive query text and is purpose-bound.

## Fallback behavior

| Condition | Fallback |
|---|---|
| unsupported or write intent | explain unsupported category and route to normal workflow |
| ambiguous entity/filter | ask human to clarify via UI topic; do not guess material constraint |
| low/unknown confidence | show parsed draft or structured filter form |
| provider unavailable | deterministic keyword/filter search |
| invalid/prohibited filter | reject only affected interpretation; log policy-safe reason |
| search/index outage | canonical/manual workflow according to operations policy |

No fallback may widen access or omit required verification/permission filters.

## Validation

schema/version, intent allowlist, filter/operator/value bounds, canonical candidate references, negation, privacy/prohibited terms, confidence and no-action/no-query-language rules. Unknown fields/operators cause rejection, not pass-through.

## Metrics

intent/entity/filter accuracy, zero-result/refinement rate, unsafe intent rejection, unauthorized result count (target 0), correction rate, search latency and deterministic fallback success.

> **OPEN DECISION:** supported intents/operators/languages, clarification UX, query retention and evaluation corpus.

