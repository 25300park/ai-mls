# REL-002 Phase 2D-0E Pool / Timeout / TLS Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-336 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Database / Operations / Security Owner |
| 기준 Main | `bbc6fd92f700f3ec3b12db9f8972c2aa78175536` |

## 1. Connection mode

Railway persistent backend는 Supabase direct PostgreSQL connection을 canonical path로 사용한다. 이 path는 Railway service outbound IPv6가 실제 활성화되었거나 Supabase IPv4 add-on이 검증된 경우에만 READY다. 둘 다 증명되지 않으면 connection은 fail closed한다. Network constraint가 검증될 때만 session-mode pooler를 별도 AO 승인으로 사용할 수 있으며 transaction-mode pooler는 persistent runtime path가 아니다. Pool ownership은 Railway service process별 `ProductionBootstrap` 하나다.

## 2. Initial bounded values

| Setting | Exact proposed value | Adapter state |
|---|---:|---|
| max connections | 5 | supported; first-live single-service ceiling that limits Supabase connection consumption |
| connection timeout | 10,000 ms | supported; bounded startup failure without masking a sustained network fault |
| pool idle timeout | 30,000 ms | implementation required; releases unused connections while avoiding per-request churn |
| statement/query timeout | 30,000 ms | supported; bounds Identity/Session statements without hidden infinite execution |
| idle-in-transaction timeout | 30,000 ms | supported; bounds abandoned UoW lock/transaction retention |
| graceful pool shutdown timeout | 30,000 ms | supported; aligns Railway draining window and prevents indefinite termination |
| application name | `ai-mls-api-production` | supported |

한 Unit of Work는 한 checked-out PostgreSQL client/transaction을 소유한다. No unbounded wait, no automatic query retry, no provider fallback, no connection-string fallback을 적용한다.

## 3. TLS

TLS mode는 exact `VERIFY_FULL`이다. `PgConnectionPoolAdapter`는 `rejectUnauthorized = true`를 유지하고 Supabase project CA를 `IDENTITY_DATABASE_CA_CERT_REF`를 통해 resolve하여 `ssl.ca`에 전달한다. `sslmode=disable`, hostname verification bypass, `rejectUnauthorized=false`, blind system-trust assumption은 금지한다.

CA material은 sealed Railway variable에서만 읽고 로그/telemetry/error에 포함하지 않는다. Host assertion은 `db.mfonujjeokvpsfucfxuq.supabase.co`와 exact match해야 한다.

## 4. Failure and shutdown

- connection timeout은 startup을 fail closed한다.
- statement/idle-transaction timeout은 transaction을 실패시키며 retry하지 않는다.
- pool exhaustion은 bounded safe error로 처리한다.
- shutdown은 readiness를 먼저 내리고 신규 checkout을 중단한 뒤 30초 안에 checked-out work와 pool close를 완료한다.
- raw PostgreSQL error, URI, role/password, SQL, filesystem path와 stack은 외부에 노출하지 않는다.

## 5. Capacity status

값은 첫 Production validation의 단일 Railway API service, low-concurrency acceptance traffic, no background polling/retry를 가정한 conservative initial ceiling이며 load/capacity proof가 아니다. 확장에는 observed metrics, Supabase connection allowance와 별도 change approval이 필요하다.

## 6. Decision gate

`DEC-187 = APPROVED`. Exact value implementation, TLS material binding, connection, load test와 Production configuration은 본 단계에서 `0`이다.

## 7. Related documents

- [PostgreSQL Role Separation](REL002_PHASE2D0E_POSTGRESQL_ROLE_SEPARATION.md)
- [Railway Secret Variable Contract](REL002_PHASE2D0E_RAILWAY_SECRET_VARIABLE_CONTRACT.md)
- [Implementation Plan](REL002_PHASE2D0E_IMPLEMENTATION_PLAN.md)

Official platform/runtime basis: [Supabase Connect to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase SSL Enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement), [node-postgres Pool API](https://node-postgres.com/apis/pool).
