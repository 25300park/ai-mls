# Property Normalization

| 항목 | 값 |
|---|---|
| Document ID | DOC-AI-006 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | AI Reviewer / Property Data Steward |
| 기준일 | 2026-07-14 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Capability

`AI-002 Property Normalization` proposes mappings from raw property/location expressions to existing canonical Property, Building, Tower, Floor, Unit, Location and Alias entities. AI may rank candidates or recommend “unresolved/new candidate”; it cannot create, merge, split or rename canonical master automatically.

## Canonical property identification

| Evidence class | Examples | Use |
|---|---|---|
| Strong identity | approved official/developer identifier, exact scoped unit reference | candidate support; still validate source/scope |
| Structural | hierarchy-compatible location/property/tower/unit | candidate generation and contradiction check |
| Lexical | canonical name, alias, language/script, abbreviation | similarity signal only |
| Geospatial | approved coordinate/address with precision/source | candidate support; privacy/precision rules apply |
| Contextual | nearby landmark, source history, offer context | weak/supporting signal; not decisive alone |

Result lists candidate canonical IDs, evidence contributions, contradictions, confidence and recommended disposition.

## Alias handling

- raw alias text and source provenance remain unchanged.
- proposed alias specifies target entity type/ID, language/script, alias type and confidence.
- a new alias or alias retarget requires Property Data Steward review.
- shared/common names do not imply identity; alias collision is explicit.
- rejected alias suggestion remains evaluation evidence according to retention policy.

## Location normalization

- extract location components without inventing missing hierarchy.
- preserve raw local name and distinguish exact, approximate, landmark and “near” semantics.
- resolve to canonical Location candidates with precision/ambiguity.
- do not convert client location preference into property fact.
- private exact unit/residential coordinates are minimized and role-controlled.

## Building, tower and unit matching

- hierarchy scope is mandatory: unit label similarity is not global identity.
- optional/non-applicable levels follow Book 3 semantics.
- tower/building aliases, floor/unit conventions and source context contribute separately.
- conflict between strong identifiers and lexical similarity routes to human review.
- same Unit with different Offer remains one physical candidate with separate offers; model never merges offers as identity cleanup.

## Ambiguity handling

| Outcome | Meaning | Next step |
|---|---|---|
| MATCH_CANDIDATE | one or more plausible existing masters | human/application review; no write |
| UNRESOLVED | evidence insufficient | keep Candidate unresolved; request context/manual search |
| NEW_MASTER_CANDIDATE | likely valid entity absent from master | steward create-review workflow |
| CONFLICT | evidence supports incompatible identities | block automatic use; escalation |
| NOT_APPLICABLE | hierarchy level genuinely absent | preserve explicit semantics |

## Validation and confidence

Output follows `property-normalization-output`. Validator checks entity existence/version, hierarchy compatibility, evidence pointers, candidate uniqueness, allowed outcome, confidence and prohibited mutation. high confidence does not bypass human approval for canonical change.

## Failure and fallback

When AI/provider fails, deterministic exact/alias lookup and manual master search remain. A failed normalization does not block Raw Source capture or Candidate draft; it marks unresolved state and prevents false canonical linkage.

## Quality metrics

top-k candidate recall, accepted mapping precision, false merge/split rate, unresolved rate, alias correction rate and reviewer effort are measured by version/cohort. canonical safety outweighs auto-match rate.

> **OPEN DECISION:** address hierarchy/geo data, candidate limit, normalization evaluation set and steward approval SLA.

