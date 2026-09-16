# REL-002 Phase 1 Secret Boundary and Reference Model

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-280 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security/Integration Owner |
| 기준일 | 2026-09-17 |
| Decision | DEC-164 |

## 1. Canonical classifications

| Classification | Meaning | Persistence/logging |
|---|---|---|
| `NON_SECRET_CONFIG` | approved typed operational value safe for bounded evidence | may persist only when allowlisted |
| `SECRET_REFERENCE` | opaque environment-bound identifier resolving to protected material | reference fingerprint/status only; raw reference concealed from public DTOs |
| `SECRET_VALUE` | resolved credential/key/password/token material | transient exact-consumer memory only; never persisted, logged, audited or returned |

## 2. Provider-neutral port

`SecretReferenceResolver` is an internal technical port owned by the Production composition boundary:

```ts
interface SecretReferenceResolver {
  isResolvable(reference: string, consumerId: string): boolean;
  resolve(reference: string, consumerId: string): string | undefined;
}
```

The implementation plan must narrow `consumerId` to a closed internal allowlist. The resolver grants no business authority. A reference valid for one environment/consumer is invalid for every other environment/consumer unless separately approved.

## 3. Resolution flow

1. Configuration accepts an opaque `SECRET_REFERENCE`, never a secret-looking value.
2. Startup validation confirms environment and consumer binding and calls `isResolvable`.
3. The exact adapter/driver calls `resolve` only immediately before its own initialization or authorized request.
4. The value is not copied into DTOs, global configuration, readiness, telemetry, errors or audit evidence.
5. Resolution failure yields safe `NOT_READY`/startup failure without revealing reference/value details.

## 4. Secret class ownership

| Class | Authorized consumer | Forbidden consumers | Activation state |
|---|---|---|---|
| Database credential | exact database adapter/driver | Console, domain service, API DTO, audit/telemetry | Phase 2 decision required |
| Authentication authority credential | approved authentication adapter if canonical contract later requires it | Session DTO, Console, domain services | no current requirement; no new auth protocol |
| AI/provider credential | configured provider adapter | API-017, Job handler, application service, Console | external hold; unavailable |
| Connector credential | exact connector/provider adapter | domain/API/Console | separately approved connector only |
| Deployment credential | deployment executor outside application runtime | application runtime and Console | Phase 6 |
| Monitoring credential | approved monitoring adapter | domain/API/Console | Phase 4 |
| Backup key/credential | approved backup adapter | application runtime except bounded backup port | Phase 5 |

## 5. Prohibitions

- No plaintext credential in source, docs, tests, fixtures, `.env`, manifest or committed configuration.
- No secret in error, stack, log, audit, readiness, health, telemetry or Console/API response.
- No Production reuse of Development/Test/Staging credential references.
- No wildcard consumer, fallback reference, default credential or automatic rotation.
- No OpenAI key creation/use, provider call or readiness upgrade in Phase 1.

## 6. Evidence

Allowed evidence is limited to configuration version, consumer identifier, environment, reference fingerprint, availability boolean, validation time, safe outcome and correlation ID. Reference fingerprint must be one-way and must not permit recovery of the raw reference or value.

## 7. Infrastructure boundary

The physical secret manager, workload identity integration, rotation mechanism and credential issuance remain `DEFERRED`. Selecting one requires a later Architecture Owner/infrastructure/security decision.
