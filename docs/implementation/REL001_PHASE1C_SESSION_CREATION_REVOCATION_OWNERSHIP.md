# REL-001 Phase 1C Session Creation / Revocation Ownership

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-059 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Security Owner / Architecture Owner |
| Baseline | `eccabb4cb55295815a5ad2e9e78929ec9ecd93e6` |
| Related decisions | `DEC-124`, `DEC-128` (`APPROVED`) |

## 1. Canonical ownership

- API-001 owns logical `Create Session`, `Refresh Session`, `Revoke Session` and current-principal reads.
- Security Owner owns identity/session policy.
- `IdentityApi` and `SessionService` are the current in-process application boundary.
- Admin Console, Core business APIs and Staging Platform Host are consumers, not Session lifecycle owners.

```text
Session creation path: EXISTING_CANONICAL_SESSION_CREATION_PATH
Path: API-001 -> IdentityApi -> SessionService -> AuthenticationAdapter
Execution readiness: NOT_TRANSPORT_READY
```

The path is canonical in ownership and semantics, but the exact provider/protocol and production adapter remain open. Phase 1C does not expose login or create a transport.

## 2. Creation consistency

A future approved durable transaction must create the complete Session identity, family, expiry, assurance binding and immutable audit evidence together. Authentication failure writes only safe denial evidence. Partial Session authority is prohibited.

## 3. Revocation semantics

Existing canonical behavior establishes:

- explicit individual Session revocation;
- refresh predecessor revocation;
- refresh-reference replay causing family revocation;
- suspended/revoked identity invalidating active Sessions;
- next live resolution rejecting revoked Sessions;
- no role/capability resurrection from a Session snapshot.

Security Owner owns revocation policy and API-001 owns the logical operation. A future durable write must atomically preserve the Session/family state change and audit evidence. Existing records may not be silently deleted or rewritten to hide history.

## 4. Approved persistence ownership

One bounded durable Session repository/UoW owned by the existing Identity/Authorization boundary is approved. It owns trusted Session records, lookup, revocation, `sessionVersion`, restart durability and bounded audit references only. Administration and Operations stores are not Session owners; technology/pattern reuse does not authorize schema/database sharing or a generic identity platform.

Creation atomically commits the complete trusted record, binding provenance and audit reference. Revocation atomically commits irreversible revocation metadata, N→N+1 version and evidence reference. Optimistic version mismatch fails closed with no last-write-wins.

The required time-bound freshness decisions are approved for REL-001/Staging. Session-boundary implementation may proceed under the resolved repository/UoW, version, atomicity and restart contract. This design does not select an external database/service or implement a schema.

## 5. Explicit exclusions

- no login/password/SSO/OAuth/JWT design;
- no service principal creation;
- no new role/capability;
- no generic authentication database;
- no Session creation from `x-session-id`;
- no development Session adapter in Staging.
