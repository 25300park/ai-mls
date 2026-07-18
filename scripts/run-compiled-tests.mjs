import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

async function findTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const tests = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      tests.push(...(await findTests(path)));
    } else if (entry.name.endsWith(".test.js")) {
      tests.push(path);
    }
  }

  return tests;
}

const tests = (await findTests("dist")).sort();
if (tests.length === 0) {
  throw new Error("No compiled tests found.");
}

const result = spawnSync(process.execPath, ["--test", ...tests], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
