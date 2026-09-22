import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export interface ProductionDockerBuildContractInput {
  readonly dockerfile: string;
  readonly dockerignore: string;
}

export interface ProductionDockerBuildContractResult {
  readonly buildPath: "DOCKERFILE";
  readonly secretArgumentCount: 0;
  readonly secretEnvironmentCount: 0;
  readonly sourceOrSecretFileCopyCount: 0;
}

export class ProductionDockerBuildContractError extends Error {
  public constructor() {
    super("Production Docker build contract is unavailable.");
    this.name = "ProductionDockerBuildContractError";
  }
}

export function validateProductionDockerBuildContract(
  input: ProductionDockerBuildContractInput,
): ProductionDockerBuildContractResult {
  try {
    const dockerfile = normalized(input.dockerfile);
    const lines = dockerfile.split("\n").map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith("#"));
    const secretName = /(?:DATABASE_URL|AI_MLS_PRODUCTION_IDENTITY_DATABASE_|IDENTITY_DATABASE_(?:CONNECTION|CA_CERT)_REF)/u;
    const secretArgumentCount = lines.filter((line) => /^ARG\s+/iu.test(line) && secretName.test(line)).length;
    const secretEnvironmentCount = lines.filter((line) => /^ENV\s+/iu.test(line) && secretName.test(line)).length;
    const fromIndexes = lines.flatMap((line, index) => /^FROM\s+/iu.test(line) ? [index] : []);
    if (fromIndexes.length < 2) throw unavailable();
    const finalLines = lines.slice(fromIndexes.at(-1));
    const sourceOrSecretFileCopyCount = finalLines.filter((line) => /^(?:COPY|ADD)\s+(?:--[^\s]+\s+)*\.?\/?\s+(?:\/app|\.)/iu.test(line)).length;
    if (secretArgumentCount !== 0 || secretEnvironmentCount !== 0 || sourceOrSecretFileCopyCount !== 0
      || !lines.some((line) => /^RUN\s+pnpm\s+install\s+--frozen-lockfile$/iu.test(line))
      || !lines.some((line) => /^RUN\s+pnpm\s+run\s+build$/iu.test(line))
      || !lines.some((line) => line === "RUN find dist -type f \\( -name '*.d.ts' -o -name '*.d.ts.map' -o -name '*.js.map' -o -name '.tsbuildinfo' \\) -delete")
      || !lines.some((line) => /^CMD\s+\["node",\s*"dist\/apps\/api\/src\/production-main\.js"\]$/u.test(line))) throw unavailable();
    const ignored = new Set(normalized(input.dockerignore).split("\n").map((line) => line.trim()).filter(Boolean));
    for (const required of [".git", ".worktrees", "node_modules", "dist", ".env", ".env.*", "*.pem", "*.key", "**/*.test.ts", "docs"]) {
      if (!ignored.has(required)) throw unavailable();
    }
    return Object.freeze({ buildPath: "DOCKERFILE", secretArgumentCount: 0, secretEnvironmentCount: 0, sourceOrSecretFileCopyCount: 0 });
  } catch {
    throw unavailable();
  }
}

function normalized(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 128_000 || value.includes("\u0000")) throw unavailable();
  return value.replaceAll("\r\n", "\n");
}

function unavailable(): ProductionDockerBuildContractError {
  return new ProductionDockerBuildContractError();
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && pathToFileURL(entry).href === import.meta.url;
}

if (isDirectExecution()) {
  const [dockerfilePath, dockerignorePath] = process.argv.slice(2);
  if (dockerfilePath === undefined || dockerignorePath === undefined) process.exitCode = 1;
  else {
    Promise.all([readFile(dockerfilePath, "utf8"), readFile(dockerignorePath, "utf8")])
      .then(([dockerfile, dockerignore]) => {
        process.stdout.write(`${JSON.stringify(validateProductionDockerBuildContract({ dockerfile, dockerignore }))}\n`);
      })
      .catch(() => { process.exitCode = 1; });
  }
}
