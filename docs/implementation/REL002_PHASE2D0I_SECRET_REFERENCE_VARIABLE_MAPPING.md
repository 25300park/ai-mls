# REL-002 Phase 2D-0I Secret Reference / Railway Variable Mapping

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-349 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security / Integration Owner |
| 기준 Main | `e973c6e66fb53b3cfb0908b777a8af0704f64812` |

## 1. Exact mapping

| Application config key | Classification | Exact reference value | Physical sealed Railway variable | Value class | Consumer |
|---|---|---|---|---|---|
| `IDENTITY_DATABASE_CONNECTION_REF` | `SECRET_REFERENCE` | `railway-sealed-env:AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1` | `AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1` | complete PostgreSQL connection string | `PG_IDENTITY_POOL` only |
| `IDENTITY_DATABASE_CA_CERT_REF` | `SECRET_REFERENCE` | `railway-sealed-env:AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V1` | `AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V1` | PEM CA certificate | `PG_IDENTITY_POOL` only |

두 physical variables는 Railway Production environment의 `ai-mls-api` service에만 존재하며 `sealed`여야 한다. Shared variables, Staging, PR environments, Vercel 및 browser delivery는 금지한다.

## 2. Resolution flow

```text
ProductionRuntimeConfiguration
  -> exact SECRET_REFERENCE shape
  -> Production SecretReferenceResolver
  -> exact reference-to-key allowlist
  -> process environment lookup at runtime only
  -> safe value/size validation
  -> PgConnectionPoolAdapter construction
  -> transient value no longer retained by composition objects
```

Resolver가 허용하는 consumer는 `PG_IDENTITY_POOL` 하나다. Arbitrary environment variable name, caller-supplied consumer, prefix matching, fallback reference, previous version fallback 및 raw `DATABASE_URL`은 모두 거부한다.

## 3. Database password handling

Supabase PostgreSQL runtime password는 complete connection string 안에서만 존재한다. 별도 password variable 또는 병렬 `DATABASE_URL` authority를 만들지 않는다. Existing non-secret host/port/database/user assertions와 resolved URI가 일치해야 하며 password는 log, error, readiness, audit, telemetry, Console 또는 Vercel에 나타나지 않는다.

## 4. CA certificate handling

현재 `DEC-187`과 implemented pool contract는 explicit CA material을 요구하므로 V1에서는 CA reference와 sealed PEM value를 필수로 유지한다. 실제 Supabase endpoint가 system trust store만으로 충분하다는 별도 canonical amendment가 승인되기 전에는 reference를 제거하거나 empty/default CA로 대체하지 않는다.

## 5. Evidence contract

허용 evidence는 environment, consumer ID, reference scheme, one-way reference fingerprint, key presence boolean, validation time, deployment ID 및 safe outcome뿐이다. Raw reference 전체와 secret value는 evidence에 포함하지 않는다.
