import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { request as nodeRequest } from "node:http";
import { join } from "node:path";
import test from "node:test";

import * as publicationPublic from "./index.js";
import { FixedClock } from "./publication-clock.js";
import { createTestPublicationAuthorizationConfiguration } from "./publication-authorization-test-support.test.js";
import { createPublicationInProcessExecutable } from "./publication-executable-bootstrap.js";
import { createPublicationApplicationHost } from "./publication-host-bootstrap.js";
import { createInProcessPublicationHttpAdapter } from "./publication-in-process-http-adapter.js";
import {
  createPublicationNodeHttpServer,
  type PublicationNodeHttpServer,
} from "./publication-node-http-server.js";

const timestamp = "2026-07-30T02:00:00.000Z";

test("PHASE13-15 verifies the complete loopback success path, correlation, diagnostics and cleanup", async () => {
  const stack = await startStack("phase13-15-success");
  const port = requiredPort(stack.server);

  try {
    const response = await sendJson(port, validCreateBody("phase13-15-success"), "phase13-15-success");

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["content-type"], "application/json");
    assert.equal(response.headers["x-request-id"], "phase13-15-success");
    assert.deepEqual(response.body, {
      presentationResult: "SUCCESS",
      category: "SUCCESS",
      message: "Publication operation completed.",
      fields: [
        { key: "publicationId", label: "Publication ID", value: "publication-phase13-15-success" },
        { key: "version", label: "Version", value: "1" },
        { key: "replayed", label: "Replayed", value: "No" },
      ],
      metadata: {
        generatedAt: timestamp,
        requestId: "phase13-15-success",
        resultType: "SUCCESS",
        version: "1",
      },
    });
    assert.deepEqual(stack.server.diagnostics, {
      serverState: "LISTENING",
      listening: true,
      boundHost: "127.0.0.1",
      boundPort: port,
      requestCount: 1,
      activeRequestCount: 0,
      successfulRequestCount: 1,
      failedRequestCount: 0,
      lastRequestStatus: 200,
    });
    assert.equal(Object.isFrozen(stack.server.diagnostics), true);
  } finally {
    await stack.server.stop();
    assert.equal(stack.executable.stop().state, "STOPPED");
  }

  assert.equal(stack.server.status.state, "STOPPED");
  assert.equal(stack.server.diagnostics.listening, false);
  assert.equal(stack.server.diagnostics.activeRequestCount, 0);
  await assert.rejects(() => sendJson(port, {}, "phase13-15-after-stop"));
});

test("PHASE13-15 preserves a deterministic safe Domain rejection through every outer boundary", async () => {
  const stack = await startStack("phase13-15-rejection");
  const port = requiredPort(stack.server);

  try {
    const invalid = validCreateBody("phase13-15-rejection");
    invalid.input.prerequisites.immutableSnapshot = false;
    const response = await sendJson(port, invalid, "phase13-15-rejection");

    assert.equal(response.statusCode, 422);
    assert.equal(response.headers["x-request-id"], "phase13-15-rejection");
    const presentation = response.body as {
      readonly presentationResult?: unknown;
      readonly category?: unknown;
      readonly message?: unknown;
      readonly metadata?: { readonly requestId?: unknown; readonly resultType?: unknown };
    };
    assert.equal(presentation.presentationResult, "ERROR", JSON.stringify(response.body));
    assert.equal(presentation.category, "APPLICATION_REJECTION");
    assert.equal(presentation.message, "Publication operation was rejected.");
    assert.equal(presentation.metadata?.requestId, "phase13-15-rejection");
    assert.equal(presentation.metadata?.resultType, "ERROR");
    assert.equal(JSON.stringify(response.body).includes("immutableSnapshot"), false);
    assert.equal(JSON.stringify(response.body).includes("stack"), false);
    assert.equal(stack.server.diagnostics.requestCount, 1);
    assert.equal(stack.server.diagnostics.successfulRequestCount, 0);
    assert.equal(stack.server.diagnostics.failedRequestCount, 1);
    assert.equal(stack.server.diagnostics.lastRequestStatus, 422);
  } finally {
    await stack.server.stop();
    stack.executable.stop();
  }
});

test("PHASE13-15 produces equal results and diagnostics from isolated deterministic stacks", async () => {
  const first = await executeIsolated("phase13-15-repeatable");
  const second = await executeIsolated("phase13-15-repeatable");

  assert.deepEqual(second.response, first.response);
  assert.deepEqual(second.diagnostics, first.diagnostics);
});

test("PHASE13-15 verifies every public module export and canonical layer entry contract", () => {
  const sourceDirectory = publicationSourceDirectory();
  const indexSource = readFileSync(join(sourceDirectory, "index.ts"), "utf8");
  const exportSpecifiers = [...indexSource.matchAll(/export \* from "(\.\/[^\"]+\.js)";/g)]
    .map((match) => match[1])
    .filter((specifier): specifier is string => specifier !== undefined);

  assert.equal(exportSpecifiers.length > 0, true);
  assert.equal(new Set(exportSpecifiers).size, exportSpecifiers.length);
  for (const specifier of exportSpecifiers) {
    const sourceFile = `${specifier.slice(2, -3)}.ts`;
    assert.equal(readdirSync(sourceDirectory).includes(sourceFile), true, `${sourceFile} is missing`);
  }

  const requiredRuntimeContracts = [
    "PublicationAggregate",
    "PublicationApplicationService",
    "PublicationInterfaceService",
    "createPublicationInfrastructure",
    "PublicationRuntime",
    "InProcessPublicationTransportAdapter",
    "PublicationPresentationAdapter",
    "composePublicationApplication",
    "PublicationApplicationHost",
    "createPublicationInProcessExecutable",
    "createInProcessPublicationHttpAdapter",
    "createPublicationNodeHttpServer",
  ] as const;
  for (const contract of requiredRuntimeContracts) {
    assert.equal(typeof publicationPublic[contract], "function", `${contract} is not public`);
  }
});

test("PHASE13-15 verifies dependency direction, cycle freedom, forbidden scope and singleton isolation", () => {
  const sourceDirectory = publicationSourceDirectory();
  const productionFiles = readdirSync(sourceDirectory)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && file !== "index.ts")
    .sort();
  const productionSet = new Set(productionFiles);
  const graph = new Map<string, readonly string[]>();
  const forbiddenDependencies = /^(express|fastify|@nestjs\/|koa|hapi|graphql|ws|socket\.io|redis|typeorm|prisma|sequelize|mongoose)$/i;
  const forbiddenSource = [
    /\b(express|fastify|nestjs|koa|hapi|graphql|websocket|socket\.io)\b/i,
    /\b(database|orm|migration|redis|queue|event bus|kafka|rabbitmq|nats)\b/i,
    /process\.(env|on|once|exit|abort)|dotenv/i,
  ];

  for (const file of productionFiles) {
    const source = readFileSync(join(sourceDirectory, file), "utf8");
    const specifiers = extractModuleSpecifiers(source);
    const runtimeSpecifiers = extractRuntimeModuleSpecifiers(source);
    const relativeTargets = runtimeSpecifiers
      .filter((specifier) => specifier.startsWith("./"))
      .map((specifier) => `${specifier.slice(2, -3)}.ts`);
    graph.set(file, Object.freeze(relativeTargets));

    for (const target of relativeTargets) {
      assert.equal(productionSet.has(target), true, `${file} has a broken dependency on ${target}`);
      assert.equal(
        allowedLayerDependency(layerOf(file), layerOf(target)),
        true,
        `${file} bypasses its approved boundary through ${target}`,
      );
    }
    for (const specifier of specifiers.filter((value) => !value.startsWith("./") && !value.startsWith("node:"))) {
      assert.equal(forbiddenDependencies.test(specifier), false, `${file} imports forbidden ${specifier}`);
    }
    assert.equal(forbiddenSource.some((pattern) => pattern.test(source)), false, `${file} contains forbidden scope`);
    assert.equal(/^\s*export\s+(?:let|var)\s+/m.test(source), false, `${file} exports mutable state`);
    assert.equal(/^(?:let|var)\s+/m.test(source), false, `${file} owns a module-global mutable binding`);
    assert.equal(
      /^export\s+const\s+\w+\s*=\s*new\s+(?:Map|Set|WeakMap|WeakSet)/m.test(source),
      false,
      `${file} exports a mutable collection singleton`,
    );
    for (const collection of moduleScopeCollections(source)) {
      assert.equal(
        new RegExp(`\\b${collection}\\.(?:add|delete|clear|set)\\s*\\(`).test(source),
        false,
        `${file} mutates module-global collection ${collection}`,
      );
    }
  }

  assert.deepEqual(findCycles(graph), []);
});

async function startStack(requestId: string): Promise<{
  readonly executable: ReturnType<typeof createPublicationInProcessExecutable>;
  readonly server: PublicationNodeHttpServer;
}> {
  const executable = createPublicationInProcessExecutable(undefined, () => createPublicationApplicationHost({
    compositionOptions: {
      runtimeOptions: {
        infrastructureConfiguration: createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)),
      },
    },
  }));
  executable.start();
  const server = createPublicationNodeHttpServer({
    configuration: {
      host: "127.0.0.1",
      port: 0,
      maximumBodyBytes: 16_384,
      shutdownTimeout: 500,
    },
    requestIdFactory: () => requestId,
    httpAdapter: createInProcessPublicationHttpAdapter(executable),
  });
  await server.start();
  return { executable, server };
}

async function executeIsolated(requestId: string): Promise<{
  readonly response: Readonly<{
    readonly statusCode: number;
    readonly contentType: string | string[] | undefined;
    readonly requestId: string | string[] | undefined;
    readonly body: unknown;
  }>;
  readonly diagnostics: Readonly<Record<string, unknown>>;
}> {
  const stack = await startStack(requestId);
  const port = requiredPort(stack.server);
  try {
    const rawResponse = await sendJson(port, validCreateBody(requestId), requestId);
    const response = Object.freeze({
      statusCode: rawResponse.statusCode,
      contentType: rawResponse.headers["content-type"],
      requestId: rawResponse.headers["x-request-id"],
      body: rawResponse.body,
    });
    const diagnostics = { ...stack.server.diagnostics, boundPort: 0 };
    return { response, diagnostics };
  } finally {
    await stack.server.stop();
    stack.executable.stop();
  }
}

function validCreateBody(requestId: string) {
  return {
    context: {
      actorId: "actor-phase13-15",
      sessionId: "body-session-must-be-ignored",
      correlationId: `correlation-${requestId}`,
      idempotencyKey: `idempotency-${requestId}`,
      intentFingerprint: `sha256:${requestId}`,
    },
    input: {
      identity: { publicationId: `publication-${requestId}`, tenantScopeId: "team-a" },
      binding: {
        subjectId: "listing-1",
        subjectRevision: 3,
        representationId: "representation-1",
        representationVersion: 2,
        representationChecksum: "sha256:representation-1-v2",
        approvalId: "approval-1",
        approvalVersion: 4,
        targetId: "target-1",
        targetVersion: 5,
        channelId: "channel-1",
        channelPolicyVersion: "channel-policy-v3",
      },
      prerequisites: {
        immutableSnapshot: true,
        effectiveApproval: true,
        exactTargetChannel: true,
        provenancePresent: true,
      },
      classification: "CONFIDENTIAL_BUSINESS",
      command: {
        actorId: "actor-phase13-15",
        authorityContext: "PUBLICATION_EXECUTION",
        reason: "Approved Phase 13-15 end-to-end verification",
        correlationId: `correlation-${requestId}`,
        occurredAt: timestamp,
      },
    },
  };
}

function requiredPort(server: PublicationNodeHttpServer): number {
  assert.notEqual(server.diagnostics.boundPort, null);
  return server.diagnostics.boundPort!;
}

function sendJson(port: number, body: unknown, requestId: string): Promise<{
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: unknown;
}> {
  const serialised = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = nodeRequest({
      host: "127.0.0.1",
      port,
      method: "POST",
      path: "/publications/commands/create",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(serialised),
        "x-request-id": requestId,
        "x-session-id": "actor-phase13-15",
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        try {
          resolve({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown,
          });
        } catch (error) {
          reject(error instanceof Error ? error : new Error("Response parsing failed."));
        }
      });
    });
    request.on("error", reject);
    request.end(serialised);
  });
}

function publicationSourceDirectory(): string {
  return join(process.cwd(), "modules", "publication", "src");
}

type ArchitectureLayer =
  | "DOMAIN"
  | "PERSISTENCE"
  | "APPLICATION"
  | "INTERFACE"
  | "INFRASTRUCTURE"
  | "RUNTIME"
  | "TRANSPORT"
  | "PRESENTATION"
  | "COMPOSITION"
  | "HOST"
  | "EXECUTABLE"
  | "HTTP_ADAPTER"
  | "NODE_HTTP_SERVER";

function layerOf(file: string): ArchitectureLayer {
  if (file.startsWith("publication-node-http-")) return "NODE_HTTP_SERVER";
  if (file.startsWith("publication-http-") || file === "publication-in-process-http-adapter.ts") return "HTTP_ADAPTER";
  if (file.startsWith("publication-executable-")
    || file === "publication-in-process-executable.ts"
    || file === "publication-host-invocation-adapter.ts") return "EXECUTABLE";
  if (file.startsWith("publication-host-") || file === "publication-application-host.ts") return "HOST";
  if (file.startsWith("publication-composition-")) return "COMPOSITION";
  if (file.startsWith("publication-presentation-")) return "PRESENTATION";
  if (file.startsWith("publication-transport-") || file === "publication-in-process-transport.ts") return "TRANSPORT";
  if (file.startsWith("publication-runtime")) return "RUNTIME";
  if (file.startsWith("publication-infrastructure")) return "INFRASTRUCTURE";
  if (file.startsWith("publication-interface-") || file === "publication-request-mapper.ts") return "INTERFACE";
  if (file.startsWith("publication-application-")
    || file === "publication-command-handlers.ts"
    || file === "publication-service.ts"
    || file === "publication-clock.ts") return "APPLICATION";
  if (file.startsWith("in-memory-")
    || file.startsWith("publication-persistence-")
    || file === "publication-audit-store.ts"
    || file === "publication-idempotency-store.ts"
    || file === "publication-repository.ts"
    || file === "publication-unit-of-work.ts") return "PERSISTENCE";
  return "DOMAIN";
}

const allowedDependencies = {
  DOMAIN: ["DOMAIN"],
  PERSISTENCE: ["PERSISTENCE", "DOMAIN"],
  APPLICATION: ["APPLICATION", "PERSISTENCE", "DOMAIN"],
  INTERFACE: ["INTERFACE", "APPLICATION"],
  INFRASTRUCTURE: ["INFRASTRUCTURE", "INTERFACE", "APPLICATION", "PERSISTENCE", "DOMAIN"],
  RUNTIME: ["RUNTIME", "INFRASTRUCTURE"],
  TRANSPORT: ["TRANSPORT", "RUNTIME", "INTERFACE"],
  PRESENTATION: ["PRESENTATION", "TRANSPORT"],
  COMPOSITION: ["COMPOSITION", "PRESENTATION", "TRANSPORT", "RUNTIME"],
  HOST: ["HOST", "COMPOSITION"],
  EXECUTABLE: ["EXECUTABLE", "HOST"],
  HTTP_ADAPTER: ["HTTP_ADAPTER", "EXECUTABLE"],
  NODE_HTTP_SERVER: ["NODE_HTTP_SERVER", "HTTP_ADAPTER"],
} as const satisfies Readonly<Record<ArchitectureLayer, readonly ArchitectureLayer[]>>;

function allowedLayerDependency(source: ArchitectureLayer, target: ArchitectureLayer): boolean {
  return (allowedDependencies[source] as readonly ArchitectureLayer[]).includes(target);
}

function extractModuleSpecifiers(source: string): string[] {
  const patterns = [
    /from\s+"([^"]+)"/g,
    /import\s+"([^"]+)"/g,
    /import\(\s*"([^"]+)"\s*\)/g,
  ];
  return patterns
    .flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1]))
    .filter((specifier): specifier is string => specifier !== undefined);
}

function extractRuntimeModuleSpecifiers(source: string): string[] {
  const withoutTypeOnlyImports = source.replace(/import\s+type[\s\S]*?from\s+"[^"]+";\s*/g, "");
  return extractModuleSpecifiers(withoutTypeOnlyImports);
}

function moduleScopeCollections(source: string): readonly string[] {
  return Object.freeze(
    [...source.matchAll(/^const\s+(\w+)\s*=\s*(?:Object\.freeze\s*\(\s*)?new\s+(?:Map|Set|WeakMap|WeakSet)/gm)]
      .map((match) => match[1])
      .filter((name): name is string => name !== undefined),
  );
}

function findCycles(graph: ReadonlyMap<string, readonly string[]>): readonly string[] {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles: string[] = [];

  const visit = (node: string, path: readonly string[]): void => {
    if (visiting.has(node)) {
      cycles.push([...path, node].join(" -> "));
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const target of graph.get(node) ?? []) visit(target, [...path, node]);
    visiting.delete(node);
    visited.add(node);
  };

  for (const node of graph.keys()) visit(node, []);
  return Object.freeze(cycles.sort());
}
