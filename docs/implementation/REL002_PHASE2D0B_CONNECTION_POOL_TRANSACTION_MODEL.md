# REL-002 Phase 2D-0B Connection Pool and Transaction Model

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-322 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준 Main | `cc588e4c9fd26133cc53d3268562badd2a513640` |

## 1. Pool ownership

`ProductionBootstrap`이 Railway service process당 정확히 하나의 application pool을 생성하고 종료한다. API process와 worker process가 별도 Railway services이면 각 process는 자신의 bounded pool을 소유하며 process 간 pool을 공유하지 않는다.

| Connection purpose | Owner | Mode |
|---|---|---|
| runtime API/worker | each Railway `ProductionBootstrap` | direct connection preferred; Supabase session pooler only if direct reachability unavailable |
| controlled migration | separately authorized migration operator | direct connection only |
| Vercel/browser | none | prohibited |

Supabase guidance상 persistent backend는 direct connection을 우선 사용하며, IPv4-only 제약 시 session pooler를 사용할 수 있다. Transaction pooler는 serverless/short-lived client용이고 prepared statement/session-state limitations가 있으므로 canonical Railway runtime mode로 승인하지 않는다. Exact connection mode는 physical project/network evidence가 들어올 때까지 `UNBOUND`다. 근거: [Supabase Connect](https://supabase.com/docs/guides/database/connecting-to-postgres), [Pooling and Limits](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits).

## 2. Provider-neutral ports

```ts
interface PostgreSqlConnectionPoolPort {
  connect(): Promise<PostgreSqlClientLease>;
  close(): Promise<void>;
}

interface PostgreSqlClientLease {
  query<Row>(statement: BoundedSqlStatement): Promise<readonly Row[]>;
  release(disposition: "HEALTHY" | "DISCARD"): Promise<void>;
}
```

Driver/library types must not cross this port. SQL is statically owned by the adapter; caller-supplied arbitrary SQL is prohibited. The approved next-implementation runtime driver is `pg`; `@types/pg` is allowed only if TypeScript compilation requires it. ORM, Supabase client persistence authority and additional PostgreSQL drivers remain prohibited.

## 3. Configuration and secrets

Existing provider-neutral reference semantics are reused.

| Configuration | Classification | Rule |
|---|---|---|
| `IDENTITY_DATABASE_CONNECTION_REF` | `SECRET_REFERENCE` | Supabase connection credential/bundle reference |
| `IDENTITY_DATABASE_CREDENTIAL_REF` | `SECRET_REFERENCE` | runtime technical role credential reference |
| `IDENTITY_DATABASE_CA_CERT_REF` | `SECRET_REFERENCE` | required when CA material is separately managed |
| connection mode/application name | `NON_SECRET_CONFIG` | exact enum/value required |
| pool max, connect/acquire/statement/idle-tx/shutdown timeouts | `NON_SECRET_CONFIG` | explicit value required; hidden defaults prohibited |

Secret values exist only in Railway runtime memory and authorized adapter construction. They are not logged, persisted, returned in readiness, or exposed to Vercel. TLS requires peer verification (`verify-full` equivalent and trusted CA); encryption without hostname verification is insufficient.

## 4. Startup lifecycle

1. Validate non-secret configuration and reference shapes.
2. Resolve DB credential/TLS references.
3. Construct a bounded pool.
4. Open a read-only connection for schema and registered workload authority checks.
5. Complete all startup gate checks.
6. After PASS, construct async Session UoW and child roots.
7. Start listener then separately bounded workers.

Pre-gate connections must use read-only transactions and have DDL privileges `0`. A failed gate closes the client/pool and produces a sanitized bounded failure. No connection secret, host detail, raw SQL, stack or driver diagnostic may escape.

## 5. Transaction model

### 5.1 General contract

- one transaction uses one checked-out client from `BEGIN` through `COMMIT`/`ROLLBACK`;
- a client is never shared concurrently across UoWs;
- any exception triggers `ROLLBACK`; rollback failure discards the client;
- commit uncertainty fails closed and is never reported as success;
- automatic transaction retry is `0`;
- nested transactions/savepoints are not part of this boundary.

### 5.2 Session mutation

Default isolation is `READ COMMITTED`. Optimistic concurrency remains the canonical authority:

```sql
UPDATE app_identity.identity_sessions
SET session_version = $next, state = $state, payload_json = $payload, updated_at = $updated
WHERE session_id = $id AND session_version = $expected
RETURNING session_version;
```

Zero rows means existing stale-version conflict. Unique/check violations map to existing bounded error classes. Revocation evidence insert and session state/version update occur in the same transaction. `SERIALIZABLE` is not selected because PostgreSQL may abort serialization conflicts and require replay; hidden replay would violate the no-automatic-retry rule. See [PostgreSQL Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

### 5.3 Registered workload and schema checks

- single workload resolution uses a read-only bounded query with exact `registration_id`.
- schema compatibility uses one `REPEATABLE READ READ ONLY` transaction for a stable catalog snapshot.
- no workload or schema write is allowed through runtime ports.

## 6. Capacity and timeout authority

Exact values remain `OPEN DECISION / CONFIG_VALUE_REQUIRED`; design does not invent defaults. Startup fails closed if any required bound is missing or invalid. Pool sizing must reserve Supabase connection headroom for migrations and operator access rather than consume the project limit. No startup retry loop, unbounded wait or connection storm is allowed.

## 7. Shutdown ordering

1. mark application readiness `NOT_READY`;
2. stop listener acceptance;
3. stop workers from claiming new work;
4. wait for in-flight work within explicit shutdown timeout;
5. close child roots;
6. close Session UoW and other adapter facades;
7. close the pool last.

Timeout expiry forces resource closure and preserves `NOT_READY`; it must not fabricate a graceful completion. Railway deploy healthchecks only gate deployment and are not continuous monitoring, so application health/readiness evidence remains canonical: [Railway Healthchecks](https://docs.railway.com/deployments/healthchecks).

## 8. Decision status

DEC-180 is `APPROVED`: per-process Bootstrap-owned pool, checked-out-client transaction ownership, no adapter retry and pool-last shutdown. Exact pool/timeouts and physical connection mode remain configuration/binding gates.
