# REL-001 Phase 2B Versioned Enriched Audit Intent Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-115 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Audit Owner / Security/Governance Owner / Domain Owners |
| 기준 commit | `e5a2cfc9a17cdb20c0c3db1e79e3184e7a09052f` |

## 1. Compatibility decision

Existing Phase 1G intents are contract `v1`. They remain immutable and readable but are `NOT_MATERIALIZATION_READY`. They must not be rewritten, guessed, backfilled or silently interpreted as `v2`.

Future materializable intents use exact discriminator `auditIntentContractVersion: "v2"`. A future version requires a separate canonical amendment.

## 2. Closed v2 shape

The immutable v2 intent binds:

- `auditIntentContractVersion: "v2"`;
- stable `intentId`, `sourceDomain`, `mutationIdentity`;
- exact existing `eventType`, `eventCategory`, `action`;
- target `{ type, id, version? }` and safe source/resource references;
- `principalProvenance` defined by DOC-DEV-117;
- Phase 2A tenant/system ownership and `scopeRef` visibility binding;
- trusted mutation-time `purpose`;
- exact `policyVersion` when the closed mapping requires it;
- existing `DataClassification` value;
- existing Audit decision and outcome value captured from source truth;
- authoritative `committedAt`, which becomes final `occurredAt`;
- required `correlationId`, optional `requestId`, safe reason and bounded `evidenceRefs`.

`eventCategory` is classification metadata using only the Phase 2B brief categories: `COMMAND_ACCEPTED`, `STATE_CHANGED`, `EVIDENCE_APPENDED`, or `SECURITY_DECISION`. It does not replace `eventType` or create a domain lifecycle.

## 3. Principal alternatives

`principalProvenance` is a closed union:

1. `TRUSTED_SNAPSHOT`: exact mutation-time `AuditPrincipal` snapshot captured from trusted Session/application context; or
2. `IMMUTABLE_REFERENCE`: principal ID plus immutable evidence reference from which the exact mutation-time `AuditPrincipal` can be reproduced.

The final event is not materialized if the reference cannot reproduce the exact principal. No current Session/role/capability lookup may substitute historical truth.

## 4. Atomic source boundary

Later implementation must validate and append v2 within the existing owner-local transaction:

`domain mutation + domain history/idempotency + v2 intent`

Any v2 validation/append failure rolls back that transaction. This does not move final Audit Event ownership from API-016 or add a distributed transaction.

## 5. Validation

Unknown fields, unknown contract versions, mapping-registry mismatch, missing required context, unsafe evidence, conflicting identity, or a v1 payload on a v2 path fail closed. Raw domain/session/provider payloads are not retained.
