# REL-001 Phase 1C Canonical Session Record Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-058 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Security Owner |
| Baseline | `eccabb4cb55295815a5ad2e9e78929ec9ecd93e6` |
| Related decisions | `DEC-129` (`APPROVED`), `DEC-130` (`APPROVED`) |

## 1. Boundary

The durable representation preserves the existing Session model and the amendment-approved durability metadata. It must not turn a request carrier into authority or copy live authorization grants into immutable Session authority.

## 2. Existing field disposition

| Existing field | Durable necessity | Rule |
|---|---|---|
| `id` | required | opaque Session identity; never log raw value |
| `principalId` | required | trusted result of approved authentication evidence verification |
| `principalType` | required | existing canonical enum only |
| `roles` | compatibility snapshot only | never sufficient for allow; live assignments remain authoritative |
| `teamId` | optional existing field | active-team context only; must not be treated as tenant identity |
| `state` | required | `ACTIVE | REVOKED | EXPIRED`; no new state |
| `assurance` | required | `SINGLE_FACTOR | MFA | WORKLOAD`; no new assurance value |
| `isMfaVerified` | required | must remain consistent with `assurance`; caller cannot set it |
| `authenticatedAt` | required application projection | same trusted instant as durable `issuedAt` |
| `expiresAt` | required application projection | `issuedAt + 12 hours`; never rolls forward |
| `absoluteExpiresAt` | required compatibility projection | same canonical absolute boundary as `expiresAt` |
| `familyId` | required | refresh/revocation family identity |
| `refreshReference` | protected existing field | must not be exposed through business APIs, logs or Console |

## 3. Amendment-approved durability fields

| Field | Mutability | Rule |
|---|---|---|
| `sessionVersion` | monotonic | starts at `1`; every authoritative mutable Session transition expects N and commits N+1 |
| `tenantBindingOrigin` | immutable | safe reference to trusted identity/assignment origin; never a caller claim or grant cache |
| `issuedAt` | immutable | canonical creation time; persisted source for existing `authenticatedAt`, `expiresAt` and `absoluteExpiresAt` projections |
| `revokedAt` | append-preserving transition metadata | required when state becomes `REVOKED`; cannot be cleared |
| `revocationEvidenceRef` | append-preserving transition metadata | opaque safe evidence reference; no raw payload |
| `auditEvidenceRef` | bounded provenance | opaque reference only; Session repository does not own audit semantics |
| `lastAccessedAt` | versioned mutable | initialized to `issuedAt`; advances durably only after successful trusted resolution and live authorization |
| `lastMfaVerifiedAt` | trusted conditional linkage | required for an operation relying on existing MFA authority; caller cannot set it |

## 4. Fields evaluated but not authorized

| Candidate field | Result | Reason |
|---|---|---|
| `tenantId` as caller/session grant | not added | tenant is derived from actor plus current trusted assignments; optional binding reference checks consistency only |
| generalized `scopeRef` | not added | scope remains multidimensional and is derived live; it cannot be flattened |
| separate `lastValidatedAt` | not added | canonical idle authority is `lastAccessedAt`; duplicate mutable time is prohibited |

## 5. Integrity and concurrency rules

1. Partial identity, expiry, family or assurance records are invalid.
2. `isMfaVerified=true` requires `assurance=MFA`.
3. Caller headers/body may supply none of these fields except the opaque `x-session-id` locator.
4. Session role/team snapshots cannot authorize an operation without live `AuthorizationService` evaluation.
5. Refresh references, credentials and MFA secrets are protected material and never safe DTO fields.
6. Unknown fields must fail closed at a future persistence decoder.
7. `sessionVersion` starts at `1`; state mutation at version N succeeds only by committing N+1.
8. Revocation state, version increment and bounded evidence reference commit atomically.
9. A revoked Session cannot transition back to `ACTIVE`.
10. Successful trusted resolution plus live authorization mutates `lastAccessedAt` at expected version N and commits N+1. Missing/expired/revoked/denied requests do not update it, and stale access cannot overwrite concurrent revocation.

## 6. REL-001 / Staging freshness bounds

| Bound | Valid | Invalid |
|---|---|---|
| Idle | elapsed `< 30m` | elapsed `>= 30m` |
| Absolute | elapsed `< 12h` | elapsed `>= 12h` |
| MFA for existing privileged actions | elapsed `<= 15m` | elapsed `> 15m` |

Access freshness is derived from idle + absolute lifetime + live revocation/authorization. No third timer or implicit renewal is introduced.

## 7. Status

The durable identity/version/revocation/audit/freshness shape is resolved for REL-001/Staging. These bounds do not activate future Production policy. No schema or implementation is created by this design-only amendment.
