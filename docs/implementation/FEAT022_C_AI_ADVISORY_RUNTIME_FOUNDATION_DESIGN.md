# FEAT-022-C AI Advisory Runtime / Prompt / Durable Evidence Foundation Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-034 |
| Version | v0.1 |
| Status | APPROVED |
| Owner | Architecture Owner / AI Reviewer |
| Baseline | `e975f0f1ef19ab71c680eec232d01f34d4a7cf97` |
| Scope | FEAT-022-C |

## Objective

동결된 `AI-001`~`AI-007` output contract를 재사용하여 provider-neutral advisory runtime, immutable prompt identity, durable advisory/evidence/idempotency와 safe internal read projection을 구현한다. AI output은 항상 `ADVISORY`이며 business state, approval, execution 또는 lifecycle authority를 갖지 않는다.

## Runtime boundary

승인 흐름은 다음과 같다.

```text
trusted internal request
→ trusted snapshot resolver
→ ACTIVE prompt identity resolution
→ canonical execution fingerprint
→ durable replay/conflict check
→ deterministic no-network adapter (test composition only)
→ FEAT-022-B canonical validator
→ atomic advisory + provenance + idempotency commit
→ tenant/scope-concealed internal read projection
```

Runtime request는 tenant/scope, capability/schema, input reference, prompt identity와 idempotency identity만 받는다. Canonical subject/provenance/classification/input/evidence fingerprints는 injected read-only resolver에서 얻으며 caller-authored evidence를 authority로 사용하지 않는다.

## Prompt registry

`DurableAdvisoryStore`는 prompt body 없이 다음 immutable metadata만 저장한다.

- `promptId`, `promptVersion`
- `capabilityId`, `schemaId`
- `contentFingerprint`
- `status: ACTIVE | RETIRED`
- `createdAt`

같은 prompt identity를 다른 metadata로 재등록하면 conflict다. Runtime free-text prompt authoring과 raw prompt read는 제공하지 않는다.

## Advisory identity and idempotency

Canonical execution fingerprint는 capability, schema, trusted input/evidence fingerprint, prompt identity와 adapter/runtime version의 sorted canonical JSON SHA-256이다. Exact fingerprint replay는 prior durable advisory를 반환하고 adapter call 및 duplicate record를 만들지 않는다. 같은 tenant/scope/idempotency identity의 다른 fingerprint는 `IDEMPOTENCY_CONFLICT`다.

`advisoryId`는 tenant/scope/idempotency/fingerprint에서 결정적으로 파생하며 domain resource identity를 대체하지 않는다.

## Durable record and atomicity

SQLite에는 prompt metadata, accepted advisory envelope/provenance/review projection, idempotency binding을 저장한다. Accepted advisory insert와 idempotency insert는 `BEGIN IMMEDIATE` transaction에서 함께 commit한다. 실패하면 둘 다 rollback한다. Append-only trigger는 prompt, advisory와 idempotency row의 update/delete를 금지한다.

재시작 시 integrity check와 FEAT-022-B validator로 모든 stored advisory를 재검증한다. malformed/unvalidated accepted row가 있으면 store startup은 fail closed한다.

Persist하지 않는 항목:

- prompt body 또는 arbitrary prompt payload
- raw provider/model response
- chain-of-thought/hidden reasoning
- credential, token, Authorization header
- unrestricted business payload

## Confidence and review projection

FEAT-022-B validation route에서 `reviewRequired`를 결정한다. `LOW` 또는 review-routed valid advisory는 advisory evidence로 저장할 수 있으나 business mutation은 항상 `0`이다. FEAT-022-C는 public review outcome enum이나 mutation API를 추가하지 않고 `reviewRequired`, nullable `reviewEvidenceRef`, `reviewedAt`, `reviewerRef`만 보존한다. Sampling policy는 `DEFERRED`다.

## Provider disposition

- `DeterministicNoNetworkAdvisoryAdapter`: test/runtime validation composition 전용, credential/network/randomness 없음, fixture output/error/timeout/malformed mode 지원.
- Production composition: adapter injection을 받지 않고 unavailable adapter만 사용한다. 실행은 `ADVISORY_UNAVAILABLE`로 fail closed하며 business workflow에는 영향이 없다.
- Real provider/model, provider name, credential, external destination과 SDK는 추가하지 않는다.

## Security and authority

- Snapshot tenant/scope mismatch 또는 unresolved evidence는 adapter 호출 전 거부한다.
- Cross-tenant/scope read는 concealment semantics로 `ADVISORY_NOT_FOUND`를 반환한다.
- Runtime과 adapter는 domain/application command port를 보유하지 않는다.
- Validator가 malformed, fabricated evidence, schema/prompt mismatch 또는 authority-shaped output을 거부하면 durable accepted record는 `0`이다.

## Exclusions

New API ID, UI, provider/model activation, prompt content authoring, new AI capability/confidence/review vocabulary, platform role/capability, domain mutation, external dependency, FEAT-022-D 이후 작업은 포함하지 않는다.
