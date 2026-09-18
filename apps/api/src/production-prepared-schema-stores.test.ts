import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { DurableAdministrationUnitOfWork } from "../../../modules/administration/src/administration-durable-persistence.js";
import { DurableAdvisoryStore } from "../../../modules/ai/src/advisory-durable-persistence.js";
import { DurablePublicationUnitOfWork } from "../../../modules/publication/src/publication-durable-persistence.js";
import { DurableConnectorExecutionUnitOfWork } from "../../../modules/source/src/connector-durable-persistence.js";
import { DurableExternalIntegrationStore } from "../../../modules/source/src/external-integration-durable-persistence.js";

test("all five Production child stores fail closed on missing schema and create no tables", () => {
  const cases = [
    ["api014.sqlite", (databasePath: string) => new DurablePublicationUnitOfWork({ databasePath, schemaMode: "REQUIRE_EXISTING" })],
    ["api015.sqlite", (databasePath: string) => new DurableAdministrationUnitOfWork({ databasePath, schemaMode: "REQUIRE_EXISTING" })],
    ["api018.sqlite", (databasePath: string) => new DurableConnectorExecutionUnitOfWork({ databasePath, schemaMode: "REQUIRE_EXISTING" })],
    ["api019.sqlite", (databasePath: string) => new DurableExternalIntegrationStore({ databasePath, schemaMode: "REQUIRE_EXISTING" })],
    ["feat022.sqlite", (databasePath: string) => new DurableAdvisoryStore({ databasePath, schemaMode: "REQUIRE_EXISTING" })],
  ] as const;
  for (const [fileName, open] of cases) {
    const directory = mkdtempSync(join(tmpdir(), "rel002-phase1e-child-"));
    const databasePath = join(directory, fileName);
    try {
      assert.throws(() => open(databasePath));
      if (existsSync(databasePath)) {
        const inspection = new DatabaseSync(databasePath);
        assert.equal(inspection.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().length, 0, fileName);
        inspection.close();
      }
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }
});
