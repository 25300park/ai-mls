# REL-001 Phase 1G-A Core Store Contract Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-070 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Data Owner / Domain Owners |
| 기준 commit | `e2ef82655b3dc8f1ebadbdc2512f9e8492ea0059` |

## 1. Canonical rule

이 문서는 기존 frozen data model, Phase 1A/1F ownership evidence와 현재 exported domain contract가 공통으로 지지하는 persistence surface만 기록한다. 현재 구현의 process-local `Map`은 authority가 아니며, 코드가 frozen lifecycle과 충돌하면 frozen 문서가 우선한다.

## 2. Store contracts

| Store | Aggregate identity | Existing authoritative field set | Immutable boundary | Mutable boundary already supported | Owner | Contract result |
|---|---|---|---|---|---|---|
| Source Registry | `SourcePolicy.id` / canonical `source_registry_id` | `name`, `sourceType`, `status`, `policyVersion`, `allowedMethods`, `allowedPurposes`, `classification`, `proposedBy`, `reviewedAt` | identity, capture-time policy/version references | only existing proposal/read/capture-policy evaluation; no new review transition | Source Policy Owner | `PARTIAL_CONTRACT` |
| Intake | `Intake.id` / `intake_id` | `version`, `status`, raw-source identity/version/fingerprint, `purpose`, `classification`, creator/time, attachment refs, optional job/AI/candidate refs and fallback reason | identity, raw-source provenance, created provenance | existing attach, validate, job-outcome routing and review transitions under expected version | Source / Listing Data Owner | `PARTIAL_CONTRACT` |
| Property | `PropertyNode.id`, `PropertyAlias.id` | node type/name/parent/status/version/authority/classification/proposer/time; alias target/value/language/source/confidence/status/version | node/alias identity and lineage references | existing node decision and alias proposal only | Property Data Owner | `PARTIAL_CONTRACT`; correction-proposal shape is absent |
| Listing | `CandidateListing.id`, `ListingOffer.id`, `DuplicateGroup.id` | exact exported Candidate, Offer and Duplicate Group fields, source/intake/AI refs, versions, classifications and decision history | aggregate identity, provenance refs, created-by identity | existing candidate/offer revision and duplicate disposition under expected version | Listing Data Owner / Duplicate Review Owner | `PARTIAL_CONTRACT` |
| Contact | `Contact.id`, `ContactChannel.id`, `ContactCase.id`, `Communication.id` | contact/channel/case/communication identity, version, team/purpose/use scope, status, consent/evidence refs and classification | identities, contact/channel/case relationships, communication evidence/time | existing correction, channel revocation, attempt and DNC transitions only | Privacy / Contact Owner | `PARTIAL_CONTRACT`; Contact Case creation remains non-canonical |
| Client / Requirement | `Client.id`, `Requirement.id` | client version/status/team/agent/contact/consent; requirement version/client/team/status/intent/constraints/budget/locations/source/gaps/readiness/history provenance | identities, client/contact/source relationships, historical revisions | existing requirement activation/revision/transition under expected version | Business Owner | `PARTIAL_CONTRACT`; frozen/current Client lifecycle vocabulary requires later alignment |
| Matching | `MatchRun.id`, `MatchResult.id` | input version refs, team, status, score/rank/components/explanation, matcher/policy versions, stale/review history | run/result identity, input snapshots and algorithm/policy provenance | existing result review/stale transitions under expected version | Matching Owner | `PARTIAL_CONTRACT`; API-017 execution remains separate |

## 3. Exclusions

- No generic Core repository or eighth store.
- No implicit Contact Case creation.
- No Property correction operation inferred from `PropertyService.propose()`.
- No API-017 job semantics or API-016 audit ownership copied into a domain store.
- No lifecycle value is added, removed or translated by this document.

Related: [Phase 1F Ownership Matrix](REL001_PHASE1F_CORE_DOMAIN_PERSISTENCE_OWNERSHIP_MATRIX.md), [Tenant/Scope Matrix](REL001_PHASE1GA_TENANT_SCOPE_BINDING_MATRIX.md).
