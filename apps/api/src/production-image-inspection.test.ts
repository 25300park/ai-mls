import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  ProductionImageInspectionError,
  inspectProductionImagePaths,
} from "./production-image-inspection.js";

test("accepts a runtime artifact tree without source, local state, or secret values", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "ai-mls-image-safe-"));
  context.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
  await mkdir(join(root, "dist"));
  await writeFile(join(root, "dist", "production-main.js"), "export const runtime = 'production';\n", "utf8");
  await writeFile(join(root, "package.json"), '{"name":"@mrhomes/ai-mls","private":true}\n', "utf8");

  const result = await inspectProductionImagePaths([join(root, "dist"), join(root, "package.json")]);
  assert.deepEqual(result, { inspectedFiles: 2, unsafeFiles: 0, embeddedSecretValues: 0 });
});

test("accepts one bounded whole-image regular-file batch larger than the legacy selected-path limit", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "ai-mls-image-batch-"));
  context.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
  const paths: string[] = [];
  for (let index = 0; index < 17; index += 1) {
    const path = join(root, `runtime-${index}.js`);
    await writeFile(path, `export const runtime${index} = true;\n`, "utf8");
    paths.push(path);
  }

  const result = await inspectProductionImagePaths(paths);
  assert.deepEqual(result, { inspectedFiles: 17, unsafeFiles: 0, embeddedSecretValues: 0 });
});

test("rejects local secret files, source/test artifacts, PostgreSQL credentials, PEM keys, and certificate values", async (context) => {
  const fixtures = [
    [".env", "TOKEN=unsafe"],
    ["runtime.test.js", "export {};"],
    ["source.ts", "export {};"],
    ["database.js", "postgresql://runtime:secret@db.example.invalid/app"],
    ["private.js", "-----BEGIN PRIVATE KEY-----"],
    ["certificate.js", "-----BEGIN CERTIFICATE-----\nVALUE\n-----END CERTIFICATE-----"],
  ] as const;
  for (const [name, content] of fixtures) {
    const root = await mkdtemp(join(tmpdir(), "ai-mls-image-unsafe-"));
    context.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
    const path = join(root, name);
    await writeFile(path, content, "utf8");
    await assert.rejects(() => inspectProductionImagePaths([path]), ProductionImageInspectionError);
  }
});
