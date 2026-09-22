import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { pathToFileURL } from "node:url";

export interface ProductionImageInspectionResult {
  readonly inspectedFiles: number;
  readonly unsafeFiles: 0;
  readonly embeddedSecretValues: 0;
}

export class ProductionImageInspectionError extends Error {
  public constructor() {
    super("Production image inspection failed.");
    this.name = "ProductionImageInspectionError";
  }
}

export async function inspectProductionImagePaths(paths: readonly string[]): Promise<ProductionImageInspectionResult> {
  try {
    if (paths.length < 1 || paths.length > 1_024) throw unavailable();
    const files: string[] = [];
    for (const path of paths) await collect(path, files);
    if (files.length < 1 || files.length > 20_000) throw unavailable();
    for (const path of files) {
      if (unsafeName(path)) throw unavailable();
      const content = await readFile(path);
      if (content.byteLength > 16_777_216) throw unavailable();
      if (embeddedSecret(content.toString("utf8"))) throw unavailable();
    }
    return Object.freeze({ inspectedFiles: files.length, unsafeFiles: 0, embeddedSecretValues: 0 });
  } catch {
    throw unavailable();
  }
}

async function collect(path: string, files: string[]): Promise<void> {
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink()) throw unavailable();
  if (metadata.isFile()) { files.push(path); return; }
  if (!metadata.isDirectory()) throw unavailable();
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) await collect(join(path, entry.name), files);
}

function unsafeName(path: string): boolean {
  const name = basename(path).toLowerCase();
  const extension = extname(name);
  return name === ".env" || name.startsWith(".env.") || name.includes(".test.")
    || name.endsWith(".d.ts") || extension === ".ts" || extension === ".map"
    || [".pem", ".key", ".db", ".sqlite", ".sqlite3", ".log"].includes(extension);
}

function embeddedSecret(content: string): boolean {
  return /postgres(?:ql)?:\/\/[^\s:/?#]+:[^\s@/?#]+@/iu.test(content)
    || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u.test(content)
    || /-----BEGIN CERTIFICATE-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END CERTIFICATE-----/u.test(content);
}

function unavailable(): ProductionImageInspectionError {
  return new ProductionImageInspectionError();
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && pathToFileURL(entry).href === import.meta.url;
}

if (isDirectExecution()) {
  inspectProductionImagePaths(process.argv.slice(2))
    .then((result) => { process.stdout.write(`${JSON.stringify(result)}\n`); })
    .catch(() => { process.exitCode = 1; });
}
