import assert from "node:assert/strict";
import test from "node:test";

import { AsyncDurableAdministrationUnitOfWork } from "./administration-async-persistence.js";
import { PostgreSqlAdministrationUnitOfWork } from "./administration-postgresql-persistence.js";

test("Administration exposes one async SQLite parity adapter and one shared-pool PostgreSQL adapter", () => {
  assert.equal(typeof AsyncDurableAdministrationUnitOfWork, "function");
  assert.equal(typeof PostgreSqlAdministrationUnitOfWork, "function");
});
