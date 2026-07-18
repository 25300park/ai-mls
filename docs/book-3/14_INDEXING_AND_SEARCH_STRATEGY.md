# Indexing and Search Strategy

| 항목 | 값 |
|---|---|
| Document ID | DOC-DATA-015 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Database Reviewer |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Strategy

Index/search structures are derived access paths, not sources of truth. They preserve canonical identifier, source version, privacy scope and rebuild/reconciliation semantics. Exact database index syntax, search engine, extension, tokenizer and tuning values are deferred.

## Logical index families

| Index | Purpose | Candidate inputs | Authority and privacy |
|---|---|---|---|
| Search Index | authorized candidate/offer retrieval | normalized text, property alias, offer terms, freshness/eligibility projection | derived; audience filter mandatory |
| Duplicate Index | similarity candidate generation | source fingerprint, normalized property/unit/offer/contact signals | advisory; no automatic merge |
| Property Index | canonical hierarchy/alias lookup | Property/Building/Tower/Floor/Unit IDs and aliases | Property Master is authority |
| Geo Index | location/radius/area candidate retrieval | Location hierarchy, approved coordinates, precision | derived; exact private location may be restricted |
| Contact Index | authorized contact resolution | masked/normalized channel tokens and organization relations | restricted, audited, never public |

## Search eligibility

- internal candidate discovery and client/public search are separate policy views.
- unverified Candidate may be available to authorized staff only.
- client proposal/search requires valid verification and client-sharing permission.
- public representation requires public-publication permission, approval and Publication status.
- expired, withdrawn, deleted, held/restricted and ambiguous states follow explicit filters, not UI convention.

## Duplicate strategy

Duplicate signals may include source fingerprint, canonical property/unit, normalized aliases, offer terms, contact relation, temporal proximity and text similarity. weights/thresholds are versioned and explainable. false merge risk requires human disposition; provenance remains after group resolution.

## Property and geo search

- canonical ID and alias match are distinguished in result explanation.
- address normalization respects local hierarchy/language and preserves raw input.
- coordinate precision/quality/source are explicit; missing coordinates do not fabricate a location.
- residential unit or client-specific geo detail may require masking or exclusion.

## Contact search

- normal search returns masked result and authorized relation context.
- normalized token/hash/encryption trade-off requires Security review because searchability may leak existence.
- bulk enumeration, reverse lookup, unmask and export are rate/role/purpose controlled and audited.
- recycled/shared channels prevent global uniqueness assumptions.

## Performance strategy

1. define priority journeys and baseline before physical optimization.
2. use narrow authoritative constraints for IDs/status/relations and derived projection for complex search only when justified.
3. record source entity version, indexed time and projection version.
4. monitor lag, stale ratio, query latency, zero-result, false duplicate and authorization-filter correctness.
5. rebuild from canonical data; reconcile missing/extra records and deleted/private data.
6. partition/shard/search-service extraction only with measured evidence and ADR.

## Consistency and failure

- search lag never grants authority; external-use gate rechecks canonical state.
- failed index update is observable/retryable and may mark result stale.
- deletion/permission revocation has prioritized index purge and validation.
- index outage preserves manual/canonical fallback where practical and cannot produce fabricated empty authority.

## Capability binding

- `DB-014`: derived index is rebuildable and version-linked.
- `DB-007`: duplicate search preserves entity separation/provenance.
- `DB-012`: contact search/access is restricted and audited.
- related: [Scalability Strategy](../book-2/09_SCALABILITY_STRATEGY.md).

> **OPEN DECISION:** search engine/extension, language/tokenization, geo representation, performance targets, freshness SLA and encrypted/contact lookup design.

