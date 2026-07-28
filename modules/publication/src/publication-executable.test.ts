import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { PublicationApplicationHost } from "./publication-application-host.js";
import {
  createPublicationInProcessExecutable,
  type PublicationExecutableHostFactory,
} from "./publication-executable-bootstrap.js";
import {
  PublicationExecutableError,
  publicationExecutableCapabilities,
  type PublicationExecutableRequest,
} from "./publication-executable-contracts.js";
import { PublicationExecutableLifecycleController } from "./publication-executable-lifecycle.js";
import { PublicationInProcessExecutable } from "./publication-in-process-executable.js";
import { FixedClock } from "./publication-clock.js";
import {
  composePublicationHostApplication,
} from "./publication-composition-root.js";
import type { PublicationHostClock } from "./publication-host-clock.js";

const timestamp = "2026-07-29T03:00:00.000Z";

test("PHASE13-12 creation has no startup side effect and exposes CREATED", () => {
  let hostCreations = 0;
  const executable = createPublicationInProcessExecutable(undefined, () => {
    hostCreations += 1;
    return createRealHost();
  });

  assert.equal(hostCreations, 0);
  assert.deepEqual(executable.status, { state: "CREATED", sequence: 0 });
  assert.deepEqual(executable.diagnostics, {
    executableState: "CREATED",
    hostState: null,
    started: false,
    stopped: false,
    executionCount: 0,
    lastExecutionStatus: "NOT_EXECUTED",
    capabilities: publicationExecutableCapabilities,
  });
});

test("PHASE13-12 configuration defaults and caller input are immutable isolated values", () => {
  const input = { executionMode: "IN_PROCESS" };
  const executable = createPublicationInProcessExecutable(input);

  assert.deepEqual(executable.configuration, { executionMode: "IN_PROCESS" });
  assert.equal(Object.isFrozen(executable.configuration), true);
  input.executionMode = "MUTATED";
  assert.deepEqual(executable.configuration, { executionMode: "IN_PROCESS" });
  assert.throws(() => {
    (executable.configuration as { executionMode: string }).executionMode = "MUTATED";
  }, TypeError);
});

test("PHASE13-12 direct construction cannot bypass configuration canonicalisation", () => {
  const input = { executionMode: "IN_PROCESS" as const };
  const executable = new PublicationInProcessExecutable(input, () => createRealHost());

  (input as { executionMode: string }).executionMode = "MUTATED";
  assert.notEqual(executable.configuration, input);
  assert.deepEqual(executable.configuration, { executionMode: "IN_PROCESS" });
  assert.equal(Object.isFrozen(executable.configuration), true);
});

test("PHASE13-12 valid startup creates and starts exactly one approved Host", () => {
  let hostCreations = 0;
  const executable = createPublicationInProcessExecutable(undefined, () => {
    hostCreations += 1;
    return createRealHost();
  });

  assert.deepEqual(executable.start(), { state: "READY", sequence: 2 });
  assert.equal(hostCreations, 1);
  assert.equal(executable.diagnostics.hostState, "READY");
});

test("PHASE13-12 invalid configuration is rejected before Host construction", () => {
  let hostCreations = 0;

  assert.throws(
    () => createPublicationInProcessExecutable(
      { executionMode: "PRODUCTION", secret: "must-not-leak" },
      () => {
        hostCreations += 1;
        return createRealHost();
      },
    ),
    (error: unknown) => error instanceof PublicationExecutableError
      && error.code === "INVALID_CONFIGURATION"
      && !error.message.includes("must-not-leak"),
  );
  assert.equal(hostCreations, 0);
});

test("PHASE13-12 hostile configuration accessors and proxies are sanitised", () => {
  const accessorConfiguration = Object.defineProperty({}, "executionMode", {
    enumerable: true,
    get: () => {
      throw new Error("CONFIG_ACCESSOR_SECRET");
    },
  });
  const proxyConfiguration = new Proxy({}, {
    getPrototypeOf: () => {
      throw new Error("CONFIG_PROXY_SECRET");
    },
  });

  for (const configuration of [accessorConfiguration, proxyConfiguration]) {
    assert.throws(
      () => createPublicationInProcessExecutable(configuration),
      (error: unknown) => error instanceof PublicationExecutableError
        && error.code === "INVALID_CONFIGURATION"
        && !error.message.includes("SECRET"),
    );
  }
});

test("PHASE13-12 execution before startup returns a safe rejection without Host invocation", () => {
  const executable = createPublicationInProcessExecutable();

  const result = executable.execute({
    executionId: "execution-before-start",
    request: createRequest("before-start"),
  });

  assert.equal(result.success, false);
  assert.equal(result.state, "CREATED");
  assert.deepEqual(result.error, {
    code: "EXECUTABLE_NOT_READY",
    message: "Executable is not ready.",
  });
  assert.equal(result.result, null);
  assert.equal(result.diagnostics.executionCount, 0);
});

test("PHASE13-12 hostile executable request accessors and proxies are sanitised", () => {
  const executable = createTestExecutable();
  executable.start();
  const accessorRequest = Object.defineProperty({ request: {} }, "executionId", {
    enumerable: true,
    get: () => {
      throw new Error("REQUEST_ACCESSOR_SECRET");
    },
  });
  const proxyRequest = new Proxy({ request: {} }, {
    get: () => {
      throw new Error("REQUEST_PROXY_SECRET");
    },
  });

  for (const request of [accessorRequest, proxyRequest]) {
    const result = executable.execute(request as PublicationExecutableRequest);
    assert.equal(result.error?.code, "INTERNAL_EXECUTABLE_ERROR");
    assert.equal(result.error?.message, "Executable request is invalid.");
    assert.equal(JSON.stringify(result).includes("SECRET"), false);
    assert.equal(result.state, "READY");
    assert.equal(result.diagnostics.executionCount, 0);
  }
});

test("PHASE13-12 successful READY execution preserves Presentation meaning", () => {
  const executable = createTestExecutable();
  executable.start();

  const result = executable.execute({
    executionId: "execution-success",
    request: createRequest("executable-success"),
  });

  assert.equal(result.executionId, "execution-success");
  assert.equal(result.success, true);
  assert.equal(result.state, "READY");
  assert.equal(result.error, null);
  assert.deepEqual(result.result, {
    presentationResult: "SUCCESS",
    category: "SUCCESS",
    message: "Publication operation completed.",
    fields: [
      { key: "publicationId", label: "Publication ID", value: "publication-executable-success" },
      { key: "version", label: "Version", value: "1" },
      { key: "replayed", label: "Replayed", value: "No" },
    ],
    metadata: {
      generatedAt: timestamp,
      version: "1",
      requestId: "executable-success",
      resultType: "SUCCESS",
    },
  });
  assert.equal(result.diagnostics.executionCount, 1);
  assert.equal(result.diagnostics.lastExecutionStatus, "SUCCESS");
});

test("PHASE13-12 unknown operation is contained as Presentation failure and Host stays READY", () => {
  const executable = createTestExecutable();
  executable.start();

  const result = executable.execute({
    executionId: "execution-unknown",
    request: {
      requestId: "unknown-operation",
      operation: "UNKNOWN_OPERATION",
      payload: {},
      metadata: {},
    },
  });

  assert.equal(result.success, false);
  assert.equal(result.error, null);
  assert.equal(result.state, "READY");
  assert.equal((result.result as { presentationResult: string }).presentationResult, "ERROR");
  assert.equal(executable.status.state, "READY");
});

test("PHASE13-12 Host startup failure maps safely and preserves FAILED", () => {
  const host = new PublicationApplicationHost(
    () => {
      throw new Error("startup secret");
    },
    new SequenceHostClock([100]),
    {},
  );
  const executable = createPublicationInProcessExecutable(undefined, () => host);

  assert.throws(
    () => executable.start(),
    (error: unknown) => error instanceof PublicationExecutableError
      && error.code === "HOST_START_FAILURE"
      && !error.message.includes("startup secret"),
  );
  assert.deepEqual(executable.status, { state: "FAILED", sequence: 2 });
  assert.equal(executable.diagnostics.hostState, "FAILED");
});

test("PHASE13-12 Host execution failure returns a sanitised terminal result", () => {
  const composition = composePublicationHostApplication(compositionOptions());
  const host = new PublicationApplicationHost(
    () => composition,
    new SequenceHostClock([100, 101]),
    {},
  );
  const executable = createPublicationInProcessExecutable(undefined, () => host);
  executable.start();
  composition.shutdown();

  const result = executable.execute({
    executionId: "execution-host-failure",
    request: createRequest("host-failure"),
  });

  assert.equal(result.success, false);
  assert.deepEqual(result.error, {
    code: "HOST_EXECUTION_FAILURE",
    message: "Application Host execution failed.",
  });
  assert.equal(result.result, null);
  assert.equal(result.state, "FAILED");
  assert.equal(JSON.stringify(result).includes("Runtime"), false);
});

test("PHASE13-12 Host stop failure maps safely and preserves FAILED", () => {
  const host = createRealHost();
  Object.defineProperty(host, "stop", {
    value: () => {
      throw new Error("stop secret");
    },
  });
  const executable = createPublicationInProcessExecutable(undefined, () => host);
  executable.start();

  assert.throws(
    () => executable.stop(),
    (error: unknown) => error instanceof PublicationExecutableError
      && error.code === "HOST_STOP_FAILURE"
      && !error.message.includes("stop secret"),
  );
  assert.deepEqual(executable.status, { state: "FAILED", sequence: 4 });
});

test("PHASE13-12 graceful shutdown stops the Host and executable", () => {
  const executable = createTestExecutable();
  executable.start();

  assert.deepEqual(executable.stop(), { state: "STOPPED", sequence: 4 });
  assert.deepEqual(executable.diagnostics, {
    executableState: "STOPPED",
    hostState: "STOPPED",
    started: true,
    stopped: true,
    executionCount: 0,
    lastExecutionStatus: "NOT_EXECUTED",
    capabilities: publicationExecutableCapabilities,
  });
});

test("PHASE13-12 repeated stop is idempotent and returns the same snapshot", () => {
  const executable = createTestExecutable();
  executable.start();
  const first = executable.stop();

  assert.equal(executable.stop(), first);
});

test("PHASE13-12 execution and restart after STOPPED are rejected safely", () => {
  const executable = createTestExecutable();
  executable.start();
  executable.stop();

  const result = executable.execute({
    executionId: "execution-after-stop",
    request: createRequest("after-stop"),
  });
  assert.equal(result.error?.code, "EXECUTABLE_STOPPED");
  assert.equal(result.state, "STOPPED");
  assert.throws(
    () => executable.start(),
    (error: unknown) => error instanceof PublicationExecutableError
      && error.code === "EXECUTABLE_STOPPED",
  );
});

test("PHASE13-12 lifecycle controller accepts only the complete canonical transition table", () => {
  const states = ["CREATED", "STARTING", "READY", "EXECUTING", "STOPPING", "STOPPED", "FAILED"] as const;
  const paths = {
    CREATED: [],
    STARTING: ["STARTING"],
    READY: ["STARTING", "READY"],
    EXECUTING: ["STARTING", "READY", "EXECUTING"],
    STOPPING: ["STARTING", "READY", "STOPPING"],
    STOPPED: ["STARTING", "READY", "STOPPING", "STOPPED"],
    FAILED: ["STARTING", "FAILED"],
  } as const;
  const allowed = new Set([
    "CREATED:STARTING",
    "STARTING:READY",
    "STARTING:FAILED",
    "READY:EXECUTING",
    "READY:STOPPING",
    "READY:FAILED",
    "EXECUTING:READY",
    "EXECUTING:FAILED",
    "STOPPING:STOPPED",
    "STOPPING:FAILED",
  ]);

  for (const source of states) {
    for (const target of states) {
      const controller = new PublicationExecutableLifecycleController();
      for (const state of paths[source]) controller.transition(state);
      if (allowed.has(`${source}:${target}`)) {
        assert.equal(controller.transition(target).state, target);
      } else {
        assert.throws(
          () => controller.transition(target),
          (error: unknown) => error instanceof PublicationExecutableError
            && error.code === "INTERNAL_EXECUTABLE_ERROR",
          `${source} must not transition to ${target}`,
        );
      }
    }
  }
});

test("PHASE13-12 executable results are deeply immutable", () => {
  const executable = createTestExecutable();
  executable.start();
  const result = executable.execute({
    executionId: "execution-immutable",
    request: createRequest("immutable"),
  });

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.result), true);
  assert.equal(Object.isFrozen((result.result as { fields: unknown }).fields), true);
  assert.equal(Object.isFrozen(result.diagnostics), true);
  assert.throws(() => {
    (result as { success: boolean }).success = false;
  }, TypeError);
});

test("PHASE13-12 diagnostics are deeply immutable safe scalar evidence", () => {
  const executable = createTestExecutable();
  executable.start();
  const diagnostics = executable.diagnostics;

  assert.equal(Object.isFrozen(diagnostics), true);
  assert.equal(Object.isFrozen(diagnostics.capabilities), true);
  assert.throws(() => {
    (diagnostics.capabilities as unknown as string[]).push("UNAPPROVED");
  }, TypeError);
  assert.equal(JSON.stringify(diagnostics).includes("repository"), false);
  assert.equal(JSON.stringify(diagnostics).includes("configuration"), false);
});

test("PHASE13-12 public snapshots leak no Host or inner implementation instance", () => {
  const executable = createTestExecutable();
  executable.start();
  const result = executable.execute({
    executionId: "execution-no-leak",
    request: createRequest("no-leak"),
  });
  const publicValue = {
    configuration: executable.configuration,
    status: executable.status,
    diagnostics: executable.diagnostics,
    result,
  };

  assert.doesNotThrow(() => JSON.stringify(publicValue));
  assert.equal(containsNonPlainObject(publicValue), false);
  for (const forbidden of ["repository", "aggregate", "adapter", "registry", "runtime"]) {
    assert.equal(JSON.stringify(publicValue).toLowerCase().includes(forbidden), false);
  }
});

test("PHASE13-12 importing and constructing does not automatically start or execute", () => {
  let hostCreations = 0;
  const factory: PublicationExecutableHostFactory = () => {
    hostCreations += 1;
    return createRealHost();
  };
  const first = createPublicationInProcessExecutable(undefined, factory);
  const second = createPublicationInProcessExecutable(undefined, factory);

  assert.equal(hostCreations, 0);
  assert.equal(first.status.state, "CREATED");
  assert.equal(second.status.state, "CREATED");
});

test("PHASE13-12 repeated construction produces equal isolated snapshots", () => {
  const first = createPublicationInProcessExecutable();
  const second = createPublicationInProcessExecutable();

  assert.notEqual(first, second);
  assert.deepEqual(first.configuration, second.configuration);
  assert.deepEqual(first.status, second.status);
  assert.deepEqual(first.diagnostics, second.diagnostics);
});

test("PHASE13-12 completes the full in-process executable path", () => {
  const executable = createTestExecutable();
  assert.equal(executable.start().state, "READY");

  const result = executable.execute({
    executionId: "execution-e2e",
    request: createRequest("e2e"),
  });

  assert.equal(result.success, true);
  assert.equal((result.result as { presentationResult: string }).presentationResult, "SUCCESS");
  assert.deepEqual(result.diagnostics, executable.diagnostics);
  assert.equal(executable.stop().state, "STOPPED");
  assert.equal(executable.diagnostics.hostState, "STOPPED");
  assert.equal(containsNonPlainObject(result), false);
});

test("PHASE13-12 executable production files preserve Host-only dependency and forbidden-scope isolation", () => {
  const sourceDirectory = join(process.cwd(), "modules", "publication", "src");
  const productionFiles = readdirSync(sourceDirectory)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && file !== "index.ts");
  const executableFiles = productionFiles.filter((file) => file.startsWith("publication-executable-")
    || file === "publication-in-process-executable.ts"
    || file === "publication-host-invocation-adapter.ts");
  const executableSpecifiers = new Set(executableFiles.map((file) => `./${file.slice(0, -3)}.js`));
  const allowedImports = new Set([
    "./publication-application-host.js",
    "./publication-host-bootstrap.js",
    ...executableSpecifiers,
  ]);
  const forbidden = [
    /publication-composition-/,
    /publication-runtime/,
    /publication-(repository|aggregate|transport|presentation|infrastructure|interface|application-service)/,
    /\b(express|fastify|nestjs|http|rest|graphql|websocket)\b/,
    /\b(authentication|authorization|database|orm|migration|redis|queue)\b/,
    /\b(process\.(env|exit|abort)|dotenv|stdin|stdout|docker|kubernetes|cloud)\b/,
  ];

  assert.deepEqual(executableFiles.sort(), [
    "publication-executable-bootstrap.ts",
    "publication-executable-configuration.ts",
    "publication-executable-contracts.ts",
    "publication-executable-lifecycle.ts",
    "publication-host-invocation-adapter.ts",
    "publication-in-process-executable.ts",
  ]);
  for (const file of executableFiles) {
    const source = readFileSync(join(sourceDirectory, file), "utf8").toLowerCase();
    assert.equal(
      extractModuleSpecifiers(source).every((specifier) => allowedImports.has(specifier)),
      true,
      `${file} imports an unapproved inner layer`,
    );
    assert.equal(forbidden.some((pattern) => pattern.test(source)), false, `${file} contains forbidden scope`);
  }
  for (const file of productionFiles.filter((file) => !executableFiles.includes(file)
    && !file.startsWith("publication-http-")
    && file !== "publication-in-process-http-adapter.ts")) {
    const imports = extractModuleSpecifiers(readFileSync(join(sourceDirectory, file), "utf8"));
    assert.equal(
      imports.some((specifier) => executableSpecifiers.has(specifier)),
      false,
      `${file} imports executable boundary`,
    );
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

function createRealHost(): PublicationApplicationHost {
  return new PublicationApplicationHost(
    () => composePublicationHostApplication(compositionOptions()),
    new SequenceHostClock([100, 101]),
    {},
  );
}

function createTestExecutable() {
  return createPublicationInProcessExecutable(undefined, () => createRealHost());
}

function compositionOptions() {
  return {
    runtimeOptions: {
      infrastructureConfiguration: { clock: new FixedClock(timestamp) },
    },
  };
}

function createRequest(requestId: string) {
  return {
    requestId,
    operation: "CREATE_PUBLICATION",
    payload: {
      context: {
        actorId: "actor-executable",
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
          actorId: "actor-executable",
          authorityContext: "PUBLICATION_EXECUTION",
          reason: "Approved executable request",
          correlationId: `correlation-${requestId}`,
          occurredAt: timestamp,
        },
      },
    },
    metadata: {},
  };
}

function containsNonPlainObject(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") return false;
  if (seen.has(value)) return true;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsNonPlainObject(item, seen));
  if (Object.getPrototypeOf(value) !== Object.prototype) return true;
  return Object.values(value).some((item) => containsNonPlainObject(item, seen));
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
