import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from "pg";

export interface PostgreSqlQueryResult<Row extends Record<string, unknown> = Record<string, unknown>> {
  readonly rows: readonly Row[];
  readonly rowCount: number;
}

export interface PostgreSqlClientPort {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<PostgreSqlQueryResult<Row>>;
  release(destroy?: boolean): void;
}

export interface PostgreSqlPoolPort {
  connect(): Promise<PostgreSqlClientPort>;
  close(): Promise<void>;
}

export interface PgPoolLike {
  connect(): Promise<PostgreSqlClientPort>;
  end(): Promise<void>;
}

export interface PgConnectionPoolOptions {
  readonly connectionString: string;
  readonly connectionTimeoutMilliseconds: number;
  readonly statementTimeoutMilliseconds: number;
  readonly idleTransactionTimeoutMilliseconds: number;
  readonly shutdownTimeoutMilliseconds: number;
  readonly maxConnections: number;
  readonly applicationName: string;
  readonly ssl: Readonly<{ rejectUnauthorized: true; ca?: string }>;
}

export type PgPoolFactory = (configuration: Readonly<PoolConfig>) => PgPoolLike;

export type PostgreSqlPersistenceErrorCode = "POSTGRESQL_UNAVAILABLE";

export class PostgreSqlPersistenceError extends Error {
  public constructor(public readonly code: PostgreSqlPersistenceErrorCode = "POSTGRESQL_UNAVAILABLE") {
    super("PostgreSQL persistence is unavailable.");
    this.name = "PostgreSqlPersistenceError";
  }
}

export class PgConnectionPoolAdapter implements PostgreSqlPoolPort {
  readonly #pool: PgPoolLike;
  readonly #shutdownTimeoutMilliseconds: number;
  #closed = false;

  public constructor(
    options: PgConnectionPoolOptions,
    factory: PgPoolFactory = createPgPool,
  ) {
    if (!validOptions(options)) throw unavailable();
    this.#shutdownTimeoutMilliseconds = options.shutdownTimeoutMilliseconds;
    try {
      this.#pool = factory(Object.freeze({
        connectionString: options.connectionString,
        connectionTimeoutMillis: options.connectionTimeoutMilliseconds,
        statement_timeout: options.statementTimeoutMilliseconds,
        idle_in_transaction_session_timeout: options.idleTransactionTimeoutMilliseconds,
        max: options.maxConnections,
        application_name: options.applicationName,
        ssl: Object.freeze({ ...options.ssl }),
      }));
    } catch {
      throw unavailable();
    }
  }

  public async connect(): Promise<PostgreSqlClientPort> {
    if (this.#closed) throw unavailable();
    try {
      return await this.#pool.connect();
    } catch {
      throw unavailable();
    }
  }

  public async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    try {
      await withTimeout(this.#pool.end(), this.#shutdownTimeoutMilliseconds);
    } catch {
      throw unavailable();
    }
  }
}

function createPgPool(configuration: Readonly<PoolConfig>): PgPoolLike {
  const pool = new Pool(configuration);
  return {
    connect: async () => wrapClient(await pool.connect()),
    end: async (): Promise<void> => { await pool.end(); },
  };
}

function wrapClient(client: PoolClient): PostgreSqlClientPort {
  return {
    query: async <Row extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      values?: readonly unknown[],
    ): Promise<PostgreSqlQueryResult<Row>> => {
      const result = await client.query<QueryResultRow>(text, values === undefined ? undefined : [...values]);
      return Object.freeze({
        rows: Object.freeze(result.rows.map((row) => Object.freeze({ ...row }) as Row)),
        rowCount: result.rowCount ?? 0,
      });
    },
    release: (destroy = false): void => { client.release(destroy); },
  };
}

function validOptions(options: PgConnectionPoolOptions): boolean {
  return safeText(options.connectionString, 4096)
    && safeText(options.applicationName, 128)
    && Number.isInteger(options.connectionTimeoutMilliseconds)
    && options.connectionTimeoutMilliseconds >= 1
    && options.connectionTimeoutMilliseconds <= 60_000
    && boundedTimeout(options.statementTimeoutMilliseconds)
    && boundedTimeout(options.idleTransactionTimeoutMilliseconds)
    && boundedTimeout(options.shutdownTimeoutMilliseconds)
    && Number.isInteger(options.maxConnections)
    && options.maxConnections >= 1
    && options.maxConnections <= 100
    && options.ssl?.rejectUnauthorized === true
    && (options.ssl.ca === undefined || safeText(options.ssl.ca, 65_536));
}

function boundedTimeout(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 60_000;
}

async function withTimeout(operation: Promise<void>, milliseconds: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { reject(unavailable()); }, milliseconds);
        timer.unref();
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function safeText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum
    && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value);
}

function unavailable(): PostgreSqlPersistenceError {
  return new PostgreSqlPersistenceError();
}
