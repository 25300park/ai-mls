# REL-001 Phase 2B Principal Provenance Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-117 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security/Governance Owner / Audit Owner |
| 기준 commit | `e5a2cfc9a17cdb20c0c3db1e79e3184e7a09052f` |

## 1. Decision

Final Audit principal provenance is mutation-time truth. The closed representation is the v2 `TRUSTED_SNAPSHOT | IMMUTABLE_REFERENCE` union in DOC-DEV-115.

The resulting final principal uses the existing `AuditPrincipal` fields only:

- `id`;
- `type: HUMAN | SERVICE`;
- bounded existing role codes;
- optional `teamId` and `sessionId` where applicable.

Capability/assignment evidence is retained as a safe immutable evidence reference; it is not transformed into a new role or authority.

## 2. Trust rules

- A trusted application boundary captures the snapshot/reference before the owner-local transaction.
- Caller-authored actor, role, capability, tenant, scope, Session and MFA fields are ignored.
- Materialization validates that principal ID, tenant/scope binding and evidence agree.
- Current Session, current roles or current assignment cannot reconstruct historical provenance.
- Revocation after the event affects present read authorization, not the historical event principal.

## 3. Service/system rule

`SERVICE` is already canonical and may be captured only from a trusted mutation-time Session/identity record. No ID-format inference is allowed. `SYSTEM` is not an existing `PrincipalType`; Phase 2B does not add it. A future system-originated mutation without an existing SERVICE identity is `SYSTEM_PRINCIPAL_UNRESOLVED` and not materializable.

## 4. Compatibility

Current v1 `actorId` alone is insufficient. All v1 sources remain non-materializable. Principal provenance contract status is `RESOLVED` for v2.
