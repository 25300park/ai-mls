# F18-E — API-019 External Evidence / Identity / Mapping Implementation Report

| 항목 | 값 |
|---|---|
| Version | v0.1 |
| Status | APPROVED |
| Baseline | `65ed3657fdbe91e66a6746a74214dd5e6c4bbd3f` |
| Branch | `codex/f18-source-connector-runtime` |
| Final Recommendation | `APPROVE_F18_E_API_019_EXTERNAL_EVIDENCE_MAPPING` |

## 1. Objective

API-019를 외부 identity, stable mapping, normalized observation 및 technical evidence 경계로 구현했다. API-019는 business truth, Source/Publication lifecycle, approval, recovery 또는 business reconciliation authority를 생성하지 않는다.

## 2. Documents read

- `F18-E — API-019 EXTERNAL EVIDENCE / IDENTITY / MAPPING BOUNDARY`
- `F18-E — API-019 CANONICAL CONTRACT AMENDMENT`
- `F18-E — API-019 CANONICAL CONTRACT AMENDMENT V2`
- 기존 F18-A inventory와 F18-B/C/D 구현 및 completion evidence

## 3. Canonical API-019 inventory

Canonical API-019 Inventory: **PASS**

| Operation | Classification | Exposure | Authority |
|---|---|---|---|
| `RegisterExternalMapping` | COMMAND | Internal/runtime only | Technical mapping evidence only |
| `SubmitProviderObservation` | COMMAND | Internal/runtime only through API-018 ingress | Non-authoritative normalized evidence only |
| `ReconcileIntegrationEvidence` | COMMAND | Internal/runtime only | Deterministic technical proof only |
| `SuspendIntegrationContract` | COMMAND | Internal/runtime only | Technical processing suspension only |
| `ReadExternalMapping` | QUERY | HTTP | Safe scoped read |
| `ReadIntegrationContract` | QUERY | HTTP | Safe scoped read |

Canonical Operations: **6 — 4 internal commands / 2 HTTP queries**
New API-019 Operations: **0**

## 4. Implementation summary

- Closed immutable request/response contracts, bounded identifiers, scalar-only `normalizedFields`, exact proof vocabulary 및 unknown-field rejection을 구현했다.
- `DurableExternalIntegrationStore`가 Integration Contract, mapping, observation, idempotency 및 append-only technical evidence를 SQLite에 저장한다.
- governed binding resolver만 최초 `ACTIVE` technical contract를 materialize할 수 있다. API-019 자체는 governance authority를 만들지 않는다.
- `tenant + scope + providerNamespace + connectorId + sourceId` trusted binding을 `integrationContractId`와 대조한다.
- 동일 external identity의 conflicting remap은 established mapping을 변경하지 않고 immutable conflict evidence만 append한 뒤 `CONFLICT`를 반환한다.
- suspension은 `ACTIVE → SUSPENDED`, version `+1`로 제한한다. 동일 idempotent replay는 prior result를 반환하고 다른 suspension 요청은 `CONFLICT`로 차단한다.
- API-018 `SubmitExternalObservation`은 API-019 sink로 위임하며 mapping logic을 복제하지 않는다.
- HTTP는 `/api/external-integrations/queries`에서 두 query만 노출하고 네 command는 노출하지 않는다.

## 5. Boundary and safety results

| Gate | Result |
|---|---|
| External Identity | PASS |
| Stable Mapping | PASS |
| Mapping Conflict | PASS — established mapping/state overwrite 0 |
| Observation Evidence | PASS — bounded normalized evidence and durable identity |
| Observation Non-authoritative | PASS — business mutation 0 |
| Durability | PASS |
| Restart | PASS — contract, suspension, mapping, observation, idempotency, evidence preserved |
| Idempotency | PASS — replay deterministic; conflicting key/payload rejected |
| Version Conflict | PASS |
| Tenant / Scope Isolation | PASS |
| API-018 SubmitExternalObservation Integration | PASS |
| Raw Provider Leakage | 0 |
| Credential Leakage | 0 |
| Business State Mutation | 0 |
| Publication Lifecycle Mutation | 0 |
| Business Reconciliation | 0 |
| Real Provider Activation | 0 |
| Network / Credentials | 0 |
| F19 Implementation | 0 |

## 6. TDD and verification

- 마지막 review에서 observation idempotency key의 cross-observation 재사용과 이미 `SUSPENDED`인 contract의 비동일 suspension 요청을 각각 RED로 재현했다.
- 최소 persistence-boundary correction 후 두 regression을 GREEN으로 전환했다.

| Verification | Result |
|---|---|
| F18-E focused | **18/18 PASS** |
| F18-B/C/D + F18-E affected | **60/60 PASS** |
| Full Regression | **892/892 PASS** |
| Lint | PASS |
| Typecheck | PASS |
| Build | PASS |
| Verify | PASS — lint, typecheck 및 full test constituent gates 직접 실행 |
| Architecture checksum | **153/153 PASS** — frozen primary scope 변경 0, baseline `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` 유지 |
| `git diff --check` | PASS |
| Gitleaks current worktree | PASS — 0 findings (`--no-git`, redacted) |
| Dependency / Lockfile Changes | 0 |
| Production audit | PASS — `pnpm.cmd audit --prod`, exit 0, known vulnerabilities 0 |
| Full audit | REVIEWED — `pnpm.cmd audit`, exit 1, 기존 승인된 development-only transitive `brace-expansion` High 4건만 존재 |
| New unapproved High / Critical | 0 / 0 |

전체 Git-history scan의 4건은 기존 commit `4e6d65c7fcfcd3634313d41b713617079e3715f3`의 과거 test fixture findings이며 F18-E 변경에서 새 finding은 0이다.

Full audit advisory는 다음 기존 승인 범위와 동일하다.

| Advisory | Dependency path | Classification | Status |
|---|---|---|---|
| `GHSA-mh99-v99m-4gvg` | `eslint → minimatch → brace-expansion` 1.x | development-only transitive, High | previously approved; unchanged |
| `GHSA-mh99-v99m-4gvg` | `typescript-eslint → typescript-estree → minimatch → brace-expansion` 5.x | development-only transitive, High | previously approved; unchanged |
| `GHSA-rgw5-rvv9-x895` | `eslint → minimatch → brace-expansion` 1.x | development-only transitive, High | previously approved; unchanged |
| `GHSA-rgw5-rvv9-x895` | `typescript-eslint → typescript-estree → minimatch → brace-expansion` 5.x | development-only transitive, High | previously approved; unchanged |

Audit 전후 SHA-256은 `package.json` = `666E5CBA934BE459D0BC0C43635B05A39D33162FE02D0550927F7F706871F9B9`, `pnpm-lock.yaml` = `245E7A25E2B2D4939BF2DA84115061E0BAF9997D1C5D175F6A32D58F94C22A11`로 동일하다.

## 7. Independent review

Fresh bounded diff review 결과:

- Critical: 0
- Important: 0
- Minor: 0
- Result: READY

확인 항목은 closed operation union, authority separation, durable binding, append-only evidence, restart/idempotency, suspension containment, HTTP exposure, API-018 delegation, raw/secret leakage 및 F19 exclusion이다.

## 8. Scope protection

- API-014/API-015 ownership change: 0
- Source/Publication lifecycle state 추가: 0
- provider contract/version 또는 credential model 추가: 0
- real network/provider activation: 0
- new generic persistence subsystem: 0
- public observation/reconciliation endpoint: 0
- F19 implementation: 0

## 9. Git state

| 항목 | 값 |
|---|---|
| Main | clean; unchanged at baseline |
| F18 Worktree | clean after the authorized accumulated F18-A/B/C/D/E commit |
| Commit | THIS_COMMIT |
| Push | NOT_PERFORMED |
| Unresolved Blockers | 0 |

## 10. Known limitations and next prerequisite

F18-E는 deterministic technical reconciliation만 수행한다. competing business claims, provider repair, governed-state correction 또는 judgment가 필요한 unresolved conflict는 safe reference evidence를 남기고 F19로 handoff해야 한다. F19는 본 작업에서 시작하지 않았다.

Report: `docs/reviews/F18_E_API_019_EXTERNAL_EVIDENCE_MAPPING_IMPLEMENTATION_REPORT.md`
