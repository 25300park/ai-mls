import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  ProductionDockerBuildContractError,
  validateProductionDockerBuildContract,
} from "./production-docker-build-contract.js";

test("the Production Docker build has zero secret ARG and secret ENV declarations", async () => {
  const [dockerfile, dockerignore] = await Promise.all([
    readFile(resolve(process.cwd(), "Dockerfile"), "utf8"),
    readFile(resolve(process.cwd(), ".dockerignore"), "utf8"),
  ]);

  const result = validateProductionDockerBuildContract({ dockerfile, dockerignore });
  assert.deepEqual(result, {
    buildPath: "DOCKERFILE",
    secretArgumentCount: 0,
    secretEnvironmentCount: 0,
    sourceOrSecretFileCopyCount: 0,
  });
});

test("the Production Docker build copies the repository's actual ESLint configuration", async () => {
  const dockerfile = await readFile(resolve(process.cwd(), "Dockerfile"), "utf8");

  assert.match(dockerfile, /\beslint\.config\.mjs\b/);
  assert.doesNotMatch(dockerfile, /\beslint\.config\.js\b/);
});

test("the final Production image prunes dependency-only artifacts and inspects every regular file", async () => {
  const dockerfile = await readFile(resolve(process.cwd(), "Dockerfile"), "utf8");

  assert.match(dockerfile, /find node_modules -type f/);
  assert.match(dockerfile, /-iname 'README\*'/);
  assert.match(dockerfile, /find \/app -type f -exec node dist\/apps\/api\/src\/production-image-inspection\.js \{\} \+/);
  assert.doesNotMatch(dockerfile, /production-image-inspection\.js \/app\/dist \/app\/package\.json/);
});

test("secret build arguments, build environments, broad final copies, and unsafe context fail closed", () => {
  const safeIgnore = ".git\n.worktrees\nnode_modules\ndist\n.env\n.env.*\n*.pem\n*.key\n**/*.test.ts\ndocs\n";
  const invalid = [
    "FROM node:24 AS build\nARG AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1\nFROM node:24\nCOPY --from=build /app/dist /app/dist\n",
    "FROM node:24 AS build\nENV DATABASE_URL=unsafe\nFROM node:24\nCOPY --from=build /app/dist /app/dist\n",
    "FROM node:24 AS build\nRUN true\nFROM node:24\nCOPY . /app\n",
  ];
  for (const dockerfile of invalid) {
    assert.throws(() => validateProductionDockerBuildContract({ dockerfile, dockerignore: safeIgnore }), ProductionDockerBuildContractError);
  }
  assert.throws(() => validateProductionDockerBuildContract({
    dockerfile: "FROM node:24 AS build\nRUN true\nFROM node:24\nCOPY --from=build /app/dist /app/dist\n",
    dockerignore: ".git\nnode_modules\n",
  }), ProductionDockerBuildContractError);
});
