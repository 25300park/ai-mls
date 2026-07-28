import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { FixedClock } from "./publication-clock.js";
import { PublicationCompositionError } from "./publication-composition-contracts.js";
import {
  composePublicationHostApplication,
  type PublicationHostCompositionFactory,
} from "./publication-composition-root.js";
import { PublicationApplicationHost } from "./publication-application-host.js";
import {
  bootstrapPublicationApplicationHost,
  createPublicationApplicationHost,
} from "./publication-host-bootstrap.js";
import type { PublicationHostClock } from "./publication-host-clock.js";
import {
  PublicationHostError,
  publicationHostCapabilities,
} from "./publication-host-contracts.js";
import { PublicationHostLifecycleController } from "./publication-host-lifecycle.js";
import { createPublicationTransportRequestEnvelope } from "./publication-transport-contracts.js";

const timestamp = "2026-07-29T02:00:00.000Z";

test("PHASE13-11 creates an immutable host in CREATED without composing early", () => {
  let compositions = 0;
  const host = new PublicationApplicationHost(
    () => {
      compositions += 1;
      return composedHostApplication();
    },
    new SequenceHostClock([100]),
    {},
  );

  assert.equal(compositions, 0);
  assert.deepEqual(host.status, { state: "CREATED", sequence: 0 });
  assert.equal(Object.isFrozen(host.status), true);
  assert.deepEqual(host.diagnostics, {
    lifecycleState: "CREATED",
    startupDurationMs: null,
    shutdownStatus: "NOT_STARTED",
    registeredCapabilities: publicationHostCapabilities,
  });
});

test("PHASE13-11 bootstrap composes once and reaches READY deterministically", () => {
  let compositions = 0;
  const host = new PublicationApplicationHost(
    () => {
      compositions += 1;
      return composedHostApplication();
    },
    new SequenceHostClock([100, 112]),
    {},
  );

  const ready = host.start();

  assert.equal(compositions, 1);
  assert.deepEqual(ready, { state: "READY", sequence: 2 });
  assert.deepEqual(host.diagnostics, {
    lifecycleState: "READY",
    startupDurationMs: 12,
    shutdownStatus: "NOT_REQUESTED",
    registeredCapabilities: publicationHostCapabilities,
  });
});

test("PHASE13-11 duplicate start is rejected without another composition or state change", () => {
  let compositions = 0;
  const host = new PublicationApplicationHost(
    () => {
      compositions += 1;
      return composedHostApplication();
    },
    new SequenceHostClock([100, 101]),
    {},
  );
  const ready = host.start();

  assert.throws(
    () => host.start(),
    (error: unknown) => error instanceof PublicationHostError
      && error.code === "HOST_ALREADY_STARTED",
  );
  assert.equal(compositions, 1);
  assert.deepEqual(host.status, ready);
});

test("PHASE13-11 graceful shutdown stops and disposes Runtime before STOPPED", () => {
  const composition = composedHostApplication();
  const host = hostFromComposition(composition, new SequenceHostClock([100, 101]));
  host.start();

  const stopped = host.stop();

  assert.deepEqual(stopped, { state: "STOPPED", sequence: 4 });
  assert.equal(composition.runtimeStatus, "DISPOSED");
  assert.equal(host.diagnostics.shutdownStatus, "COMPLETE");
});

test("PHASE13-11 repeated shutdown is idempotent and returns the same final snapshot", () => {
  const host = hostFromComposition(composedHostApplication(), new SequenceHostClock([100, 101]));
  host.start();
  const first = host.stop();
  const second = host.stop();

  assert.equal(second, first);
  assert.deepEqual(second, { state: "STOPPED", sequence: 4 });
});

test("PHASE13-11 lifecycle controller accepts only the complete canonical transition table", () => {
  const states = ["CREATED", "INITIALISING", "READY", "STOPPING", "STOPPED", "FAILED"] as const;
  const paths = {
    CREATED: [],
    INITIALISING: ["INITIALISING"],
    READY: ["INITIALISING", "READY"],
    STOPPING: ["INITIALISING", "READY", "STOPPING"],
    STOPPED: ["INITIALISING", "READY", "STOPPING", "STOPPED"],
    FAILED: ["INITIALISING", "FAILED"],
  } as const;
  const allowed = new Set([
    "CREATED:INITIALISING",
    "INITIALISING:READY",
    "INITIALISING:FAILED",
    "READY:STOPPING",
    "READY:FAILED",
    "STOPPING:STOPPED",
    "STOPPING:FAILED",
  ]);

  for (const source of states) {
    for (const target of states) {
      const controller = new PublicationHostLifecycleController();
      for (const state of paths[source]) controller.transition(state);
      if (allowed.has(`${source}:${target}`)) {
        assert.equal(controller.transition(target).state, target);
      } else {
        assert.throws(
          () => controller.transition(target),
          (error: unknown) => error instanceof PublicationHostError
            && error.code === "HOST_TRANSITION_INVALID",
          `${source} must not transition to ${target}`,
        );
      }
    }
  }
});

test("PHASE13-11 diagnostics are deterministic scalar evidence without internal references", () => {
  const host = hostFromComposition(composedHostApplication(), new SequenceHostClock([200, 207]));
  host.start();

  const diagnostics = host.diagnostics;
  assert.equal(Object.isFrozen(diagnostics), true);
  assert.equal(Object.isFrozen(diagnostics.registeredCapabilities), true);
  assert.equal(JSON.stringify(diagnostics).includes("repository"), false);
  assert.equal(JSON.stringify(diagnostics).includes("services"), false);
  assert.throws(() => {
    (diagnostics.registeredCapabilities as unknown as string[]).push("UNAPPROVED");
  }, TypeError);
});

test("PHASE13-11 lifecycle snapshots cannot be mutated by callers", () => {
  const host = hostFromComposition(composedHostApplication(), new SequenceHostClock([100, 101]));
  const created = host.status;

  assert.throws(() => {
    (created as { state: string }).state = "READY";
  }, TypeError);
  assert.deepEqual(host.status, { state: "CREATED", sequence: 0 });
});

test("PHASE13-11 execution enters only through the composed application", () => {
  const host = hostFromComposition(composedHostApplication(), new SequenceHostClock([100, 101]));
  host.start();

  const result = host.execute(createRequest("host-execution"));

  assert.equal(result.presentationResult, "SUCCESS");
  assert.equal(result.metadata.requestId, "host-execution");
  assert.deepEqual(result.fields, [
    { key: "publicationId", label: "Publication ID", value: "publication-host-execution" },
    { key: "version", label: "Version", value: "1" },
    { key: "replayed", label: "Replayed", value: "No" },
  ]);
});

test("PHASE13-11 invalid bootstrap enters FAILED with a safe host error", () => {
  const host = new PublicationApplicationHost(
    () => {
      throw new Error("unexpected bootstrap secret");
    },
    new SequenceHostClock([100]),
    {},
  );

  assert.throws(
    () => host.start(),
    (error: unknown) => error instanceof PublicationHostError
      && error.code === "HOST_BOOTSTRAP_FAILED"
      && !error.message.includes("unexpected bootstrap secret"),
  );
  assert.deepEqual(host.status, { state: "FAILED", sequence: 2 });
});

test("PHASE13-11 forged Composition facade is rejected before READY", () => {
  const forged = {
    runtimeStatus: "READY",
    validationStatus: "VALID",
    execute: () => {
      throw new Error("forged execution");
    },
    shutdown: () => undefined,
  };
  const factory = (() => forged) as unknown as PublicationHostCompositionFactory;
  const host = new PublicationApplicationHost(factory, new SequenceHostClock([100]), {});

  assert.throws(
    () => host.start(),
    (error: unknown) => error instanceof PublicationHostError
      && error.code === "HOST_BOOTSTRAP_FAILED",
  );
  assert.deepEqual(host.status, { state: "FAILED", sequence: 2 });
});

test("PHASE13-11 Runtime bootstrap failure propagates as safe FAILED host state", () => {
  const factory = (() => {
    throw new PublicationCompositionError(
      "COMPOSITION_RUNTIME_UNAVAILABLE",
      "unexpected runtime secret",
    );
  }) as PublicationHostCompositionFactory;
  const host = new PublicationApplicationHost(factory, new SequenceHostClock([100]), {});

  assert.throws(
    () => host.start(),
    (error: unknown) => error instanceof PublicationHostError
      && error.code === "HOST_RUNTIME_FAILURE"
      && !error.message.includes("unexpected runtime secret"),
  );
  assert.deepEqual(host.status, { state: "FAILED", sequence: 2 });
});

test("PHASE13-11 post-composition startup failure disposes Runtime before FAILED", () => {
  const composition = composedHostApplication();
  const host = hostFromComposition(composition, new FailingSecondReadHostClock());

  assert.throws(
    () => host.start(),
    (error: unknown) => error instanceof PublicationHostError
      && error.code === "HOST_BOOTSTRAP_FAILED"
      && !error.message.includes("clock failure secret"),
  );
  assert.deepEqual(host.status, { state: "FAILED", sequence: 2 });
  assert.equal(composition.runtimeStatus, "DISPOSED");
  assert.equal(host.diagnostics.shutdownStatus, "COMPLETE");
});

test("PHASE13-11 Runtime execution failure is cleaned up and propagated safely", () => {
  const composition = composedHostApplication();
  const host = hostFromComposition(composition, new SequenceHostClock([100, 101]));
  host.start();
  composition.shutdown();

  assert.throws(
    () => host.execute(createRequest("host-runtime-failure")),
    (error: unknown) => error instanceof PublicationHostError
      && error.code === "HOST_RUNTIME_FAILURE",
  );
  assert.deepEqual(host.status, { state: "FAILED", sequence: 3 });
  assert.equal(composition.runtimeStatus, "DISPOSED");
  assert.equal(host.diagnostics.shutdownStatus, "COMPLETE");
});

test("PHASE13-11 public factories support CREATED and bootstrapped READY boundaries", () => {
  const created = createPublicationApplicationHost({
    clock: new SequenceHostClock([300, 304]),
    compositionOptions: compositionOptions(),
  });
  assert.equal(created.status.state, "CREATED");

  const ready = bootstrapPublicationApplicationHost({
    clock: new SequenceHostClock([300, 304]),
    compositionOptions: compositionOptions(),
  });
  assert.equal(ready.status.state, "READY");
  assert.equal(ready.diagnostics.startupDurationMs, 4);
});

test("PHASE13-11 completes create, start, execute, stop end to end", () => {
  const host = createPublicationApplicationHost({
    clock: new SequenceHostClock([500, 509]),
    compositionOptions: compositionOptions(),
  });

  assert.equal(host.start().state, "READY");
  assert.equal(host.execute(createRequest("host-e2e")).presentationResult, "SUCCESS");
  assert.equal(host.stop().state, "STOPPED");
  assert.throws(
    () => host.execute(createRequest("host-after-stop")),
    (error: unknown) => error instanceof PublicationHostError
      && error.code === "HOST_NOT_READY",
  );
});

test("PHASE13-11 Host production files preserve Composition-only dependency and forbidden-scope isolation", () => {
  const sourceDirectory = join(process.cwd(), "modules", "publication", "src");
  const productionFiles = readdirSync(sourceDirectory)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && file !== "index.ts");
  const hostFiles = productionFiles.filter((file) => file.startsWith("publication-host-")
    || file === "publication-application-host.ts");
  const hostSpecifiers = new Set(hostFiles.map((file) => `./${file.slice(0, -3)}.js`));
  const allowedImports = new Set([
    "./publication-composition-root.js",
    ...hostSpecifiers,
  ]);
  const forbidden = [
    /\b(express|fastify|nestjs|http|rest|graphql|websocket)\b/,
    /\b(authentication|authorization|database|orm|migration)\b/,
    /\b(cloud|deployment|docker|kubernetes|cli|process\.env)\b/,
    /\b(repository|transport implementation|presentation implementation)\b/,
  ];

  assert.deepEqual(hostFiles.sort(), [
    "publication-application-host.ts",
    "publication-host-bootstrap.ts",
    "publication-host-clock.ts",
    "publication-host-contracts.ts",
    "publication-host-diagnostics.ts",
    "publication-host-lifecycle.ts",
  ]);
  for (const file of hostFiles) {
    const source = readFileSync(join(sourceDirectory, file), "utf8").toLowerCase();
    const imports = extractModuleSpecifiers(source);
    assert.equal(imports.every((specifier) => allowedImports.has(specifier)), true, `${file} imports an unapproved layer`);
    assert.equal(forbidden.some((pattern) => pattern.test(source)), false, `${file} contains a forbidden capability`);
  }
  for (const file of productionFiles.filter((file) => !hostFiles.includes(file))) {
    const imports = extractModuleSpecifiers(readFileSync(join(sourceDirectory, file), "utf8"));
    assert.equal(imports.some((specifier) => hostSpecifiers.has(specifier)), false, `${file} imports Host`);
  }
});

class SequenceHostClock implements PublicationHostClock {
  private index = 0;

  public constructor(private readonly values: readonly number[]) {}

  public now(): number {
    const value = this.values[Math.min(this.index, this.values.length - 1)];
    this.index += 1;
    if (value === undefined) throw new Error("Host clock requires at least one value.");
    return value;
  }
}

class FailingSecondReadHostClock implements PublicationHostClock {
  private reads = 0;

  public now(): number {
    this.reads += 1;
    if (this.reads === 2) throw new Error("clock failure secret");
    return 100;
  }
}

function hostFromComposition(
  composition: ReturnType<typeof composedHostApplication>,
  clock: PublicationHostClock,
): PublicationApplicationHost {
  const factory: PublicationHostCompositionFactory = () => composition;
  return new PublicationApplicationHost(factory, clock, {});
}

function composedHostApplication() {
  return composePublicationHostApplication(compositionOptions());
}

function compositionOptions() {
  return {
    runtimeOptions: {
      infrastructureConfiguration: { clock: new FixedClock(timestamp) },
    },
  };
}

function createRequest(requestId: string) {
  return createPublicationTransportRequestEnvelope({
    requestId,
    operation: "CREATE_PUBLICATION",
    payload: {
      context: {
        actorId: "actor-host",
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
          actorId: "actor-host",
          authorityContext: "PUBLICATION_EXECUTION",
          reason: "Approved host request",
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
