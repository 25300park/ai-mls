import assert from "node:assert/strict";
import test from "node:test";

import {
  PgConnectionPoolAdapter,
  PostgreSqlPersistenceError,
  type PgPoolLike,
  type PostgreSqlClientPort,
  type PostgreSqlQueryResult,
} from "./postgresql-pool.js";

function client(events: string[]): PostgreSqlClientPort {
  return {
    query: <Row extends Record<string, unknown>>() => Promise.resolve({ rows: [], rowCount: 0 } as PostgreSqlQueryResult<Row>),
    release: (destroy = false) => { events.push(`release:${String(destroy)}`); },
  };
}

function options(): ConstructorParameters<typeof PgConnectionPoolAdapter>[0] {
  return {
    connectionString: "postgresql://runtime:secret@db.example.invalid:5432/app",
    connectionTimeoutMilliseconds: 5_000,
    idleTimeoutMilliseconds: 30_000,
    statementTimeoutMilliseconds: 10_000,
    idleTransactionTimeoutMilliseconds: 10_000,
    shutdownTimeoutMilliseconds: 5_000,
    maxConnections: 8,
    applicationName: "ai-mls-production-api",
    ssl: { rejectUnauthorized: true, ca: "test-ca" },
  };
}

test("owns one bounded pg pool and closes it gracefully", async () => {
  const events: string[] = [];
  const lease = client(events);
  let received: unknown;
  const pool: PgPoolLike = {
    connect: () => { events.push("connect"); return Promise.resolve(lease); },
    end: () => { events.push("end"); return Promise.resolve(); },
  };
  const adapter = new PgConnectionPoolAdapter(options(), (configuration) => {
    received = configuration;
    return pool;
  });

  const acquired = await adapter.connect();
  acquired.release();
  await adapter.close();
  await adapter.close();

  assert.deepEqual(events, ["connect", "release:false", "end"]);
  assert.deepEqual(received, {
    connectionString: options().connectionString,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 10_000,
    idle_in_transaction_session_timeout: 10_000,
    max: 8,
    application_name: "ai-mls-production-api",
    ssl: { rejectUnauthorized: true, ca: "test-ca" },
  });
});

test("rejects unbounded or unverifiable pool configuration", () => {
  for (const replacement of [
    { ...options(), connectionString: "" },
    { ...options(), connectionTimeoutMilliseconds: 0 },
    { ...options(), connectionTimeoutMilliseconds: 60_001 },
    { ...options(), idleTimeoutMilliseconds: 0 },
    { ...options(), statementTimeoutMilliseconds: 0 },
    { ...options(), idleTransactionTimeoutMilliseconds: 60_001 },
    { ...options(), shutdownTimeoutMilliseconds: 0 },
    { ...options(), maxConnections: 0 },
    { ...options(), maxConnections: 101 },
    { ...options(), ssl: { rejectUnauthorized: false as const } },
  ] as unknown as ConstructorParameters<typeof PgConnectionPoolAdapter>[0][]) {
    assert.throws(() => new PgConnectionPoolAdapter(replacement, () => {
      throw new Error("must not construct");
    }), (error: unknown) => error instanceof PostgreSqlPersistenceError
      && error.code === "POSTGRESQL_UNAVAILABLE"
      && error.message === "PostgreSQL persistence is unavailable.");
  }
});

test("sanitizes pool construction, connection, and shutdown failures", async () => {
  const secret = options().connectionString;
  assert.throws(() => new PgConnectionPoolAdapter(options(), () => {
    throw new Error(`failed ${secret} at C:\\private\\db`);
  }), (error: unknown) => error instanceof PostgreSqlPersistenceError
    && !error.message.includes("secret") && !error.message.includes("private"));

  const adapter = new PgConnectionPoolAdapter(options(), () => ({
    connect: () => Promise.reject(new Error(`failed ${secret}`)),
    end: () => Promise.reject(new Error("SELECT credential")),
  }));
  await assert.rejects(() => adapter.connect(), (error: unknown) =>
    error instanceof PostgreSqlPersistenceError && error.message === "PostgreSQL persistence is unavailable.");
  await assert.rejects(() => adapter.close(), (error: unknown) =>
    error instanceof PostgreSqlPersistenceError && error.message === "PostgreSQL persistence is unavailable.");
});

test("rejects use after shutdown", async () => {
  const adapter = new PgConnectionPoolAdapter(options(), () => ({
    connect: () => Promise.resolve(client([])),
    end: () => Promise.resolve(),
  }));
  await adapter.close();
  await assert.rejects(() => adapter.connect(), PostgreSqlPersistenceError);
});

test("bounds graceful pool shutdown", async () => {
  const adapter = new PgConnectionPoolAdapter({ ...options(), shutdownTimeoutMilliseconds: 1 }, () => ({
    connect: () => Promise.resolve(client([])),
    end: () => new Promise<void>(() => undefined),
  }));
  await assert.rejects(() => adapter.close(), PostgreSqlPersistenceError);
});
