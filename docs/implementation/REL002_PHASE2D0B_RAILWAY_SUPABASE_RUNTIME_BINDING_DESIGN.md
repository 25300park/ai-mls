# REL-002 Phase 2D-0B Railway / Supabase Runtime Binding Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-325 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준 Main | `cc588e4c9fd26133cc53d3268562badd2a513640` |

## 1. Canonical topology

```text
Browser
  → Vercel frontend/Admin delivery
  → Railway backend API (`startProductionRuntime()`)
       → Railway persistent workers (separately bounded process/service)
       → Supabase PostgreSQL (`app_identity`)
```

Vercel owns static/browser-facing delivery only. Vercel API/serverless backend, database credential, service-role credential and direct database access are `0`. Railway owns canonical backend/runtime and process lifecycle. Supabase owns managed PostgreSQL only; Supabase Auth is `NOT_ADOPTED`.

## 2. Audit-safe physical binding contract

| Field | Current value |
|---|---|
| Provider | `Supabase` |
| Engine | `PostgreSQL` |
| Environment | `PRODUCTION` |
| Project reference | `UNBOUND` |
| Logical database | `UNBOUND` |
| Region | `UNBOUND` |
| Runtime connection mode | `UNBOUND` (`DIRECT` preferred, `SESSION_POOLER` conditional) |
| Migration connection mode | `DIRECT` required |
| Railway API service reference | `UNBOUND` |
| Railway worker service reference | `UNBOUND` |
| Binding evidence reference | `UNBOUND` |

No password, database URI or secret value is recorded.

## 3. Railway runtime variables

### Non-secret

- exact environment `PRODUCTION`;
- Supabase project/region audit-safe identifiers;
- selected connection mode;
- application/service identity reference;
- explicit pool and timeout values;
- application name and bounded readiness configuration.

### Secret references

- `IDENTITY_DATABASE_CONNECTION_REF`;
- `IDENTITY_DATABASE_CREDENTIAL_REF`;
- `IDENTITY_DATABASE_CA_CERT_REF` where needed.

Existing `SecretReferenceResolver` remains provider-neutral. Railway variable storage is not automatically designated as the canonical secret backend by this design. The exact backend/reference/rotation evidence remains a Gap 005 prerequisite.

## 4. Service boundaries

| Service | Responsibility | Prohibited |
|---|---|---|
| Railway API | sole `startProductionRuntime()` listener path and bounded child roots | migration, schema repair, worker authority unless explicitly composed |
| Railway worker | persistent API-017 bounded worker runtime under existing authority | public listener, scheduler expansion, migration |
| migration operator | separately authorized one-shot controlled migration | serving API/jobs, business authority |
| Vercel | browser/Admin artifacts and safe public config | DB/provider/identity secrets, backend authority |

API and worker processes have distinct runtime identities and pools. A shared database does not merge their authorization scopes.

## 5. Readiness and health

Application readiness is truthful and fail-closed:

- config/reference validation PASS;
- DB connectivity/TLS PASS;
- PostgreSQL compatibility validator `READY`;
- registered workload identity/evidence PASS;
- startup gate PASS;
- required child roots initialized;
- live provider remains separately governed.

Railway healthchecks are deployment gates, not continuous monitoring, and therefore do not replace FEAT-023 health/readiness/freshness evidence. The Railway service must listen on injected `PORT`; the exact existing safe readiness endpoint is reused rather than adding a new route. Reference: [Railway Healthchecks](https://docs.railway.com/deployments/healthchecks).

## 6. Connection mode decision rule

Supabase recommends direct connection for persistent servers. If Railway reachability and the approved Supabase project support the required network family, use direct connection. If the runtime is IPv4-only and direct connectivity is unavailable, use Supabase session pooler. Transaction pooler is not approved for the persistent canonical runtime. Migrations, `pg_dump`, backup/restore and administrative evidence operations use direct connection. Reference: [Supabase Connect](https://supabase.com/docs/guides/database/connecting-to-postgres).

Connection mode cannot be set before exact physical binding evidence; status remains `UNBOUND`.

## 7. Supabase exposure boundary

- `app_identity` is not exposed through browser/Data API contracts.
- Data API may be disabled or governed by future platform configuration; this task performs no setting change.
- no grants to browser roles are authorized.
- RLS does not replace application tenant/scope enforcement.
- any later Data API exposure requires a separate security/AO decision and RLS review.

Supabase documents Data API disablement and grants as exposure controls: [Securing your API](https://supabase.com/docs/guides/api/securing-your-api).

## 8. Backup/restore and operator hold

Platform availability is not backup evidence. The exact bound project requires:

- current exact-target backup identifier/timestamp/status/integrity evidence;
- restore verification on an exact or policy-approved compatible target;
- named migration operator and authorization reference;
- region/retention/RPO/RTO evidence.

Until those exist, migration gate is `BLOCKED`, Production schema is not ready, and deployment/migration/write counts are `0`.

## 9. External actions

Supabase project creation, Railway deployment/configuration, Vercel configuration, credentials, network calls and Production migration are outside this document and were not performed.
