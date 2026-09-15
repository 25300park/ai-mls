# REL-001 Phase 4D.8 External Provider Dependency Hold

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-219 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner |
| 범위 | REL-001 Phase 4 / FEAT-022 external provider activation boundary |

## Hold classification

`EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY`

FEAT-022의 provider-independent implementation은 완료되었다. OpenAI Staging live activation은 repository 구현 부족이 아니라 아래 account/contract prerequisites 때문에 보류된다.

| External prerequisite | Current evidence | Closure owner/action |
|---|---|---|
| MAM or ZDR approval | neither enabled | OpenAI approval plus Security/Privacy Owner selection |
| required contractual amendment | not complete | execute required ZDR/data-residency amendment |
| Korea residency eligibility | not enabled; current project is Global | OpenAI/account eligibility approval |
| dedicated Staging project | not found | create only after Korea residency eligibility is available |
| credential-reference configuration | not possible without eligible Staging project | configure `FEAT022_STAGING_OPENAI_API_KEY` reference without recording value |
| scoped live-network authorization | not granted | separate Architecture Owner authorization after all prerequisites pass |

## Repository boundary

- Provider-independent implementation blockers: `0`.
- Provider-independent capabilities: `3/3 READY`.
- Prompt assets: `3/3 EXISTING_AND_VERSIONED`.
- Outbound projections: `3/3 CLOSED`, anything else `DENIED`.
- Retry / provider fallback / model fallback: `0 / 0 / 0`.
- Network, credential use, inference and billable calls: `0`.

This hold does not reopen FEAT-022 contracts, API-017 semantics or advisory/human-review authority.

## Release rule

The hold can be released only when every external prerequisite has authoritative account/contract evidence and a separate scoped network approval exists. Repository completion alone cannot release it.
