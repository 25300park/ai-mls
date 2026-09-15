# REL-001 Phase 4A Provider Config / Credential Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-175 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Security Owner / AI Operations Owner |
| 기준일 | 2026-09-15 |

## 1. Current state

| Concern | Current source truth | Status | Handler access |
|---|---|---|---|
| provider identity | no approved named provider | OWNER_DECISION_REQUIRED | `0` |
| model identity/version | no approved Production model | OWNER_DECISION_REQUIRED | `0` |
| routing mode | frozen docs describe policy-aware router; no chosen topology | OWNER_DECISION_REQUIRED | `0` |
| provider configuration schema | absent | MISSING | `0` |
| credential source | absent | MISSING | `0` |
| secret reader | absent | MISSING | `0` |
| adapter credential access | no real adapter | MISSING | not applicable |
| Staging provider binding | absent | MISSING | `0` |
| data residency/retention | provider-specific approval absent | OWNER_DECISION_REQUIRED | `0` |
| disable/rotation/rollback | documented governance only | DOCUMENTED_ONLY | `0` |
| database path | explicit `ProductionAdvisoryRuntimeOptions.databasePath` | EXISTS; persistence only | `0` provider secrets |
| snapshot resolver | explicit Production option | EXISTS_AND_CANONICAL | safe application context only |

## 2. Required ownership boundary

- Provider/config owner: FEAT-022 AI Operations/Security boundary, subject to Architecture Owner approval.
- Credential source: must be explicitly selected; no environment variable, file, vault or platform secret source is assumed here.
- Environment/config reader: must be injected at Production composition and expose only provider-scoped configuration to the approved adapter.
- Adapter: may receive only the minimum approved credential/config; it must not expose them in result, error, telemetry or evidence.
- API-017 handler: credential/config/environment reader access remains `0`.
- Provider-derived tenant identity is prohibited; trusted Job/snapshot tenant and scope remain authoritative.

`API-017 handler credentials access = 0`.

## 3. Gaps and authorization

Credential/config gap categories: `5`.

1. provider/model not approved;
2. routing/config schema not approved;
3. credential source/access/rotation not approved;
4. Staging values/destination not approved;
5. data residency/retention/security evaluation not approved.

Phase 4A adds no credential, secret, config value or network destination. Later provider implementation and verification require explicit scoped network authorization after these gaps close.
