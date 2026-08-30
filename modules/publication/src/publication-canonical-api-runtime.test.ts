import assert from "node:assert/strict";
import test from "node:test";

import { PublicationApplicationHost } from "./publication-application-host.js";
import type { PublicationCanonicalApiExecutionPort } from "./publication-runtime-canonical-api-port.js";
import { createTestPublicationAuthorizationConfiguration } from "./publication-authorization-test-support.test.js";
import { FixedClock } from "./publication-clock.js";
import { composePublicationHostApplication } from "./publication-composition-root.js";
import { bootstrapPublicationRuntime } from "./publication-runtime.js";

const timestamp = "2026-08-31T00:00:00.000Z";
const operations = Object.freeze([
  "CREATE_PUBLICATION", "PUBLISH_PUBLICATION", "CORRECT_PUBLICATION", "SUSPEND_PUBLICATION",
  "RESUME_PUBLICATION", "REQUEST_WITHDRAWAL", "RESOLVE_WITHDRAWAL", "REPUBLISH_PUBLICATION",
  "RESOLVE_RECONCILIATION", "RECOVER_PUBLICATION", "SUPERSEDE_PUBLICATION", "TERMINATE_PUBLICATION",
  "GET_PUBLICATION", "GET_PUBLICATION_OPERATIONS_VIEW", "GET_PUBLICATION_REVALIDATION_VIEW",
  "GET_PUBLICATION_RECOVERY_VIEW", "GET_PUBLICATION_AUDIT_VIEW", "GET_LISTING_PROJECTION",
]);

test("F17-D Runtime registers one closed 18-operation API-014 execution port and fails closed without it", () => {
  const request = Object.freeze({ kind: "QUERY", request: Object.freeze({ operation: "GET_PUBLICATION" }) });
  const unavailable = bootstrapPublicationRuntime({
    infrastructureConfiguration: createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)),
  });
  assert.equal(unavailable.ok, true);
  if (!unavailable.ok) throw new Error("Runtime bootstrap unexpectedly failed.");
  assert.throws(() => unavailable.runtime.executeCanonicalApi(request), /Canonical API execution is unavailable/u);

  const port: PublicationCanonicalApiExecutionPort = Object.freeze({
    operations,
    execute: (input: unknown): unknown => Object.freeze({ input, boundary: "API-014" }),
  });
  const ready = bootstrapPublicationRuntime({
    infrastructureConfiguration: createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)),
    canonicalApiPort: port,
  });
  assert.equal(ready.ok, true);
  if (!ready.ok) throw new Error("Runtime bootstrap unexpectedly failed.");
  assert.deepEqual(ready.runtime.canonicalApiOperations, operations);
  assert.deepEqual(ready.runtime.executeCanonicalApi(request), { input: request, boundary: "API-014" });
});

test("F17-D canonical API execution traverses the existing Publication Application Host", () => {
  let executions = 0;
  const port: PublicationCanonicalApiExecutionPort = Object.freeze({
    operations,
    execute: (input: unknown): unknown => {
      executions += 1;
      return Object.freeze({ input, boundary: "HOST_RUNTIME_API_014" });
    },
  });
  const host = new PublicationApplicationHost(
    composePublicationHostApplication,
    { now: (): number => 1 },
    {
      runtimeOptions: {
        infrastructureConfiguration: createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)),
        canonicalApiPort: port,
      },
    },
  );
  const request = Object.freeze({ kind: "COMMAND", request: Object.freeze({ operation: "CREATE_PUBLICATION" }) });

  assert.throws(() => host.executeCanonicalApi(request), /Host is not ready/u);
  host.start();
  assert.deepEqual(host.executeCanonicalApi(request), { input: request, boundary: "HOST_RUNTIME_API_014" });
  assert.equal(executions, 1);
  host.stop();
});
