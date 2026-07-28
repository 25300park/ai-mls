import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { FixedClock } from "./publication-clock.js";
import {
  PublicationCompositionError,
  publicationCompositionDependencyEdges,
  publicationCompositionServiceNames,
  type PublicationCompositionRegistration,
} from "./publication-composition-contracts.js";
import { createPublicationCompositionRegistrations } from "./publication-composition-registry.js";
import { composePublicationApplication } from "./publication-composition-root.js";
import { PublicationRuntimeCompositionAdapter } from "./publication-composition-runtime-adapter.js";
import { validatePublicationCompositionRegistrations } from "./publication-composition-validation.js";
import { createPublicationTransportRequestEnvelope } from "./publication-transport-contracts.js";

const timestamp = "2026-07-29T01:00:00.000Z";

test("PHASE13-10 composes every approved service into one immutable application graph", () => {
  const graph = composedGraph();

  assert.deepEqual(graph.serviceNames, publicationCompositionServiceNames);
  assert.equal(graph.runtime.context.status, "READY");
  assert.equal(typeof graph.transport.execute, "function");
  assert.equal(typeof graph.presentation.present, "function");
  assert.equal(typeof graph.application.execute, "function");
  assert.equal(Object.isFrozen(graph), true);
  assert.equal(Object.isFrozen(graph.serviceNames), true);
  assert.equal(Object.isFrozen(graph.diagnostics), true);
});

test("PHASE13-10 rejects duplicate dependency registration before graph construction", () => {
  const graph = composedGraph();
  const registrations = registrationsFrom(graph);

  assert.throws(
    () => validatePublicationCompositionRegistrations([...registrations, registrations[0]!]),
    (error: unknown) => error instanceof PublicationCompositionError
      && error.code === "COMPOSITION_DUPLICATE_REGISTRATION",
  );
});

test("PHASE13-10 rejects a missing dependency before graph construction", () => {
  const graph = composedGraph();
  const registrations = registrationsFrom(graph).filter(({ name }) => name !== "presentation");

  assert.throws(
    () => validatePublicationCompositionRegistrations(registrations),
    (error: unknown) => error instanceof PublicationCompositionError
      && error.code === "COMPOSITION_DEPENDENCY_MISSING",
  );
});

test("PHASE13-10 constructs deterministic ordered graphs with isolated services", () => {
  const first = composedGraph();
  const second = composedGraph();

  assert.deepEqual(first.serviceNames, second.serviceNames);
  assert.deepEqual(first.diagnostics, second.diagnostics);
  assert.notEqual(first.runtime, second.runtime);
  assert.notEqual(first.transport, second.transport);
  assert.notEqual(first.presentation, second.presentation);
  assert.notEqual(first.application, second.application);
});

test("PHASE13-10 runtime composition adapter executes through Transport and Presentation", () => {
  const graph = composedGraph();
  const result = graph.application.execute(createRequest("composition-adapter"));

  assert.equal(result.presentationResult, "SUCCESS");
  assert.equal(result.metadata.requestId, "composition-adapter");
  assert.deepEqual(result.fields, [
    { key: "publicationId", label: "Publication ID", value: "publication-composition-adapter" },
    { key: "version", label: "Version", value: "1" },
    { key: "replayed", label: "Replayed", value: "No" },
  ]);
  assert.equal(graph.runtime.services.repository.find({
    publicationId: "publication-composition-adapter",
    tenantScopeId: "team-a",
  })?.lifecycleState, "READY");
});

test("PHASE13-10 graph containers and diagnostics resist external mutation", () => {
  const graph = composedGraph();

  assert.throws(() => {
    (graph.serviceNames as unknown as string[]).push("unexpected");
  }, TypeError);
  assert.throws(() => {
    (graph.diagnostics.dependencyGraph as unknown as unknown[]).push({});
  }, TypeError);
  assert.throws(() => {
    (graph.diagnostics.dependencyGraph[0] as { dependency: string }).dependency = "changed";
  }, TypeError);
});

test("PHASE13-10 diagnostics expose deterministic scalar evidence without service objects", () => {
  const graph = composedGraph();

  assert.deepEqual(graph.diagnostics, {
    registeredServices: ["runtime", "transport", "presentation", "application"],
    dependencyGraph: publicationCompositionDependencyEdges,
    validationStatus: "VALID",
    runtimeStatus: "READY",
  });
  const encoded = JSON.stringify(graph.diagnostics);
  assert.equal(encoded.includes("publication-composition"), false);
  assert.equal(encoded.includes("services"), false);
  assert.equal(encoded.includes("repository"), false);
});

test("PHASE13-10 rejects an inconsistent graph whose application has different bindings", () => {
  const first = composedGraph();
  const second = composedGraph();
  const inconsistent = registrationsFrom(first).map((registration) => registration.name === "application"
    ? { name: "application" as const, service: second.application }
    : registration);

  assert.throws(
    () => validatePublicationCompositionRegistrations(inconsistent),
    (error: unknown) => error instanceof PublicationCompositionError
      && error.code === "COMPOSITION_GRAPH_INVALID",
  );
});

test("PHASE13-10 rejects an unapproved application that self-certifies real bindings", () => {
  const graph = composedGraph();
  const fakeApplication = {
    execute: (request: unknown) => graph.application.execute(request),
    isBoundTo: () => true,
  };
  const registrations = registrationsFrom(graph).map((registration) => registration.name === "application"
    ? { name: "application", service: fakeApplication }
    : registration) as unknown as PublicationCompositionRegistration[];

  assert.throws(
    () => validatePublicationCompositionRegistrations(registrations),
    (error: unknown) => error instanceof PublicationCompositionError
      && error.code === "COMPOSITION_GRAPH_INVALID",
  );
});

test("PHASE13-10 rejects an unapproved outer service despite always-true self-certification", () => {
  const graph = composedGraph();
  const fakePresentation = {
    present: graph.presentation.present.bind(graph.presentation),
  };
  const fakeApplication = {
    execute: (request: unknown) => graph.application.execute(request),
    isBoundTo: () => true,
  };
  const registrations = registrationsFrom(graph).map((registration) => {
    if (registration.name === "presentation") return { name: "presentation", service: fakePresentation };
    if (registration.name === "application") return { name: "application", service: fakeApplication };
    return registration;
  }) as unknown as PublicationCompositionRegistration[];

  assert.throws(
    () => validatePublicationCompositionRegistrations(registrations),
    (error: unknown) => error instanceof PublicationCompositionError
      && error.code === "COMPOSITION_GRAPH_INVALID",
  );
});

test("PHASE13-10 rejects an unapproved application subtype that overrides binding validation", () => {
  const first = composedGraph();
  const second = composedGraph();
  const RuntimeAdapterConstructor = PublicationRuntimeCompositionAdapter as unknown as new (
    runtime: typeof first.runtime,
    transport: typeof first.transport,
    presentation: typeof first.presentation,
  ) => PublicationRuntimeCompositionAdapter;
  class SelfCertifyingApplication extends RuntimeAdapterConstructor {
    public override isBoundTo(): boolean {
      return true;
    }
  }
  const application = new SelfCertifyingApplication(
    second.runtime,
    second.transport,
    second.presentation,
  );
  const inconsistent = registrationsFrom(first).map((registration) => registration.name === "application"
    ? { name: "application" as const, service: application }
    : registration);

  assert.throws(
    () => validatePublicationCompositionRegistrations(inconsistent),
    (error: unknown) => error instanceof PublicationCompositionError
      && error.code === "COMPOSITION_GRAPH_INVALID",
  );
});

test("PHASE13-10 rejects proxied Runtime, Transport, and Presentation identities", () => {
  const graph = composedGraph();
  const serviceNames = ["runtime", "transport", "presentation"] as const;

  for (const name of serviceNames) {
    const service = new Proxy(graph[name], {});
    const registrations = registrationsFrom(graph).map((registration) => registration.name === name
      ? { name, service }
      : registration) as unknown as PublicationCompositionRegistration[];

    assert.throws(
      () => validatePublicationCompositionRegistrations(registrations),
      (error: unknown) => error instanceof PublicationCompositionError
        && error.code === "COMPOSITION_GRAPH_INVALID",
      `${name} proxy must not retain root-issued approval`,
    );
  }
});

test("PHASE13-10 rejects derived Runtime, Transport, and Presentation identities", () => {
  const graph = composedGraph();
  const serviceNames = ["runtime", "transport", "presentation"] as const;

  for (const name of serviceNames) {
    const service = Object.create(graph[name]) as object;
    const registrations = registrationsFrom(graph).map((registration) => registration.name === name
      ? { name, service }
      : registration) as unknown as PublicationCompositionRegistration[];

    assert.throws(
      () => validatePublicationCompositionRegistrations(registrations),
      (error: unknown) => error instanceof PublicationCompositionError
        && error.code === "COMPOSITION_GRAPH_INVALID",
      `${name} derived identity must not retain root-issued approval`,
    );
  }
});

test("PHASE13-10 root fails fast when the approved runtime cannot be assembled", () => {
  assert.throws(
    () => composePublicationApplication({
      runtimeOptions: {
        infrastructureFactory: () => {
          throw new Error("unexpected internal startup detail");
        },
      },
    }),
    (error: unknown) => error instanceof PublicationCompositionError
      && error.code === "COMPOSITION_RUNTIME_UNAVAILABLE"
      && !error.message.includes("unexpected internal startup detail"),
  );
});

test("PHASE13-10 end-to-end assembly preserves idempotent execution through the outer boundary", () => {
  const graph = composedGraph();
  const request = createRequest("composition-idempotent");
  const first = graph.application.execute(request);
  const second = graph.application.execute(request);

  assert.equal(first.presentationResult, "SUCCESS");
  assert.equal(second.presentationResult, "SUCCESS");
  assert.deepEqual(second.fields, [
    { key: "publicationId", label: "Publication ID", value: "publication-composition-idempotent" },
    { key: "version", label: "Version", value: "1" },
    { key: "replayed", label: "Replayed", value: "Yes" },
  ]);
  assert.equal(graph.runtime.services.repository.readHistory({
    publicationId: "publication-composition-idempotent",
    tenantScopeId: "team-a",
  }).length, 1);
});

test("PHASE13-10 exposes no service locator and preserves architecture isolation", () => {
  const graph = composedGraph();
  assert.deepEqual(Object.keys(graph), [
    "serviceNames",
    "runtime",
    "transport",
    "presentation",
    "application",
    "diagnostics",
  ]);
  assert.equal("get" in graph, false);
  assert.equal("resolve" in graph, false);
  assert.equal("find" in graph, false);

  const sourceDirectory = join(process.cwd(), "modules", "publication", "src");
  const productionFiles = readdirSync(sourceDirectory)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && file !== "index.ts");
  const compositionFiles = productionFiles.filter((file) => file.startsWith("publication-composition-"));
  const compositionSpecifiers = new Set(compositionFiles.map((file) => `./${file.slice(0, -3)}.js`));
  const forbidden = [
    /\b(express|fastify|react|vue|angular|http|authentication|authorization)\b/,
    /\b(database|orm|migration|logging|monitoring|cloud|deployment|docker|kubernetes)\b/,
    /\b(reflection|decorator|scanning|discovery|plugin|service locator)\b/,
    /\b(weakset|weakmap)\b/,
    /process\.env/,
  ];

  assert.deepEqual(compositionFiles.sort(), [
    "publication-composition-contracts.ts",
    "publication-composition-diagnostics.ts",
    "publication-composition-registry.ts",
    "publication-composition-root.ts",
    "publication-composition-runtime-adapter.ts",
    "publication-composition-validation.ts",
  ]);
  for (const file of compositionFiles) {
    const source = readFileSync(join(sourceDirectory, file), "utf8").toLowerCase();
    assert.equal(forbidden.some((pattern) => pattern.test(source)), false, `${file} contains a forbidden capability`);
  }
  for (const file of productionFiles.filter((file) => !compositionFiles.includes(file)
    && !file.startsWith("publication-host-")
    && file !== "publication-application-host.ts")) {
    const imports = extractModuleSpecifiers(readFileSync(join(sourceDirectory, file), "utf8"));
    assert.equal(imports.some((specifier) => compositionSpecifiers.has(specifier)), false, `${file} imports Composition`);
  }
});

function composedGraph() {
  return composePublicationApplication({
    runtimeOptions: {
      infrastructureConfiguration: { clock: new FixedClock(timestamp) },
    },
  });
}

function registrationsFrom(graph: ReturnType<typeof composedGraph>): PublicationCompositionRegistration[] {
  return [...createPublicationCompositionRegistrations(graph)];
}

function createRequest(requestId: string) {
  return createPublicationTransportRequestEnvelope({
    requestId,
    operation: "CREATE_PUBLICATION",
    payload: {
      context: {
        actorId: "actor-composition",
        correlationId: `correlation-${requestId}`,
        idempotencyKey: `idempotency-${requestId}`,
        intentFingerprint: `sha256:${requestId}`,
      },
      input: {
        identity: {
          publicationId: `publication-${requestId}`,
          tenantScopeId: "team-a",
        },
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
          actorId: "actor-composition",
          authorityContext: "PUBLICATION_EXECUTION",
          reason: "Approved composition request",
          correlationId: `correlation-${requestId}`,
          occurredAt: timestamp,
        },
      },
    },
    metadata: {},
  });
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
