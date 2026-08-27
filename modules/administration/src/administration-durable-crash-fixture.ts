import { DatabaseSync } from "node:sqlite";

const databasePath = process.argv[2];
if (databasePath === undefined || databasePath.trim().length === 0) process.exit(2);

const database = new DatabaseSync(databasePath);
database.exec("PRAGMA foreign_keys = ON");
database.exec("BEGIN IMMEDIATE");
database.prepare("UPDATE administration_resources SET version = version + 100 WHERE tenant_id = ? AND resource_type = ? AND resource_id = ?")
  .run("tenant-r1", "ROLE_ASSIGNMENT", "assignment-r1");
database.prepare("UPDATE administration_revisions SET revision = revision + 100 WHERE tenant_id = ? AND resource_type = ? AND resource_id = ?")
  .run("tenant-r1", "ROLE_ASSIGNMENT", "assignment-r1");
process.stdout.write("STAGED\n");
setInterval(() => undefined, 1_000);
