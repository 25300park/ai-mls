import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { FixedClock, SystemPublicationClock } from "./publication-clock.js";
import { createTestPublicationAuthorizationConfiguration } from "./publication-authorization-test-support.test.js";
import {
  createPublicationInfrastructureConfiguration,
} from "./publication-infrastructure-configuration.js";
import { createPublicationInfrastructure } from "./publication-infrastructure.js";
import { createPublicationInterfaceRequest } from "./publication-interface-models.js";

const timestamp = "2026-07-27T15:00:00.000Z";
const identity = { publicationId: "publication-infrastructure-1", tenantScopeId: "team-a" } as const;

function createRequest() {
  return createPublicationInterfaceRequest({
    operation: "CREATE_PUBLICATION",
    context: {
      actorId: "actor-infrastructure",
      sessionId: "actor-infrastructure",
      correlationId: "correlation-infrastructure",
      idempotencyKey: "idempotency-infrastructure",
      intentFingerprint: "sha256:infrastructure-intent",
    },
    input: {
      identity,
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
        actorId: "actor-infrastructure",
        authorityContext: "PUBLICATION_EXECUTION",
        reason: "Approved in-process infrastructure request",
        correlationId: "correlation-infrastructure",
        occurredAt: timestamp,
      },
    },
  });
}

test("PHASE13-6 composition root registers one explicit in-memory dependency graph", () => {
  const clock = new FixedClock(timestamp);
  const configuration = createPublicationInfrastructureConfiguration({ clock });
  const infrastructure = createPublicationInfrastructure(configuration);

  assert.equal(Object.isFrozen(configuration), true);
  assert.equal(Object.isFrozen(infrastructure), true);
  assert.notEqual(infrastructure.configuration, configuration);
  assert.equal(infrastructure.configuration.clock, configuration.clock);
  assert.equal(infrastructure.clock, clock);
  assert.equal(infrastructure.repository, infrastructure.unitOfWork.repository);
  assert.equal(infrastructure.idempotency, infrastructure.unitOfWork.idempotency);
  assert.equal(infrastructure.audit, infrastructure.unitOfWork.audit);
});

test("PHASE13-6 composition root canonicalizes caller-owned mutable configuration", () => {
  const wiredClock = new FixedClock(timestamp);
  const replacementClock = new FixedClock("2026-07-27T16:00:00.000Z");
  const mutableInput = { clock: wiredClock };
  const infrastructure = createPublicationInfrastructure(mutableInput);

  mutableInput.clock = replacementClock;

  assert.equal(infrastructure.clock, wiredClock);
  assert.equal(infrastructure.configuration.clock, wiredClock);
  assert.equal(Object.isFrozen(infrastructure.configuration), true);
});

test("PHASE13-6 composed input port executes through repository, unit of work, audit and idempotency adapters", () => {
  const infrastructure = createPublicationInfrastructure(
    createPublicationInfrastructureConfiguration(createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp))),
  );
  const request = createRequest();

  const first = infrastructure.inputPort.execute(request);
  const replay = infrastructure.inputPort.execute(request);

  assert.deepEqual(first, {
    operationResult: "SUCCEEDED",
    publicationId: identity.publicationId,
    version: 1,
    replayed: false,
  });
  assert.deepEqual(replay, { ...first, replayed: true });
  assert.equal(infrastructure.repository.find(identity)?.lifecycleState, "READY");
  assert.equal(infrastructure.repository.readHistory(identity).length, 1);
  assert.deepEqual(infrastructure.audit.list(identity).map((entry) => entry.timestamp), [timestamp]);
  assert.equal(infrastructure.idempotency.find({
    tenantScopeId: identity.tenantScopeId,
    aggregateId: identity.publicationId,
    commandKey: request.context.idempotencyKey,
  })?.fingerprint, request.context.intentFingerprint);
});

test("PHASE13-6 registered unit of work remains available as the approved logical transaction boundary", () => {
  const infrastructure = createPublicationInfrastructure(
    createPublicationInfrastructureConfiguration({ clock: new FixedClock(timestamp) }),
  );
  const transaction = infrastructure.unitOfWork.begin(identity);
  transaction.audit.append({
    id: "audit-rollback-infrastructure",
    tenantScopeId: identity.tenantScopeId,
    aggregateId: identity.publicationId,
    command: "TEST_ROLLBACK",
    actorId: "actor-infrastructure",
    timestamp,
    version: 0,
    result: "COMPLETED",
  });

  transaction.rollback();

  assert.deepEqual(infrastructure.audit.list(identity), []);
});

test("PHASE13-6 system clock adapter wraps runtime time and deterministic replacement remains supported", () => {
  const before = Date.now();
  const runtimeTimestamp = new SystemPublicationClock().now();
  const after = Date.now();
  const parsed = Date.parse(runtimeTimestamp);

  assert.equal(Number.isNaN(parsed), false);
  assert.equal(parsed >= before && parsed <= after, true);
  assert.equal(new FixedClock(timestamp).now(), timestamp);
  assert.equal(createPublicationInfrastructureConfiguration().clock instanceof SystemPublicationClock, true);
});

test("PHASE13-6 deterministic startup creates isolated in-process state", () => {
  const configuration = createPublicationInfrastructureConfiguration(createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)));
  const first = createPublicationInfrastructure(configuration);
  const second = createPublicationInfrastructure(configuration);

  assert.notEqual(first, second);
  assert.notEqual(first.repository, second.repository);
  assert.deepEqual(Object.keys(first), Object.keys(second));
  assert.equal(first.inputPort.execute(createRequest()).operationResult, "SUCCEEDED");
  assert.equal(second.repository.find(identity), undefined);
});

test("PHASE13-6 infrastructure source depends only on approved in-process contracts and adapters", () => {
  const allowedImports = new Set([
    "./publication-application-service.js",
    "./publication-audit-store.js",
    "./publication-authorization.js",
    "./publication-clock.js",
    "./publication-command-handlers.js",
    "./publication-idempotency-store.js",
    "./publication-infrastructure-configuration.js",
    "./publication-interface-presenter.js",
    "./publication-interface-service.js",
    "./publication-interface-validation.js",
    "./publication-request-mapper.js",
    "./publication-repository.js",
    "./publication-service.js",
    "./publication-unit-of-work.js",
  ]);
  const files = ["publication-infrastructure-configuration.ts", "publication-infrastructure.ts"];

  for (const file of files) {
    const source = readFileSync(join(process.cwd(), "modules", "publication", "src", file), "utf8");
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)]
      .map((match) => match[1])
      .filter((specifier): specifier is string => specifier !== undefined);
    assert.equal(imports.every((specifier) => allowedImports.has(specifier)), true, `${file} has a forbidden dependency`);
    assert.equal(source.includes("process.env"), false, `${file} reads environment configuration`);
  }
});
