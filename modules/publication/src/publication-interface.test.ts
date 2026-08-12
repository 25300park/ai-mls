import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import type {
  PublicationApplicationResult,
  PublicationCommandHandler,
} from "./publication-application-contracts.js";
import { PublicationInterfaceService } from "./publication-interface-service.js";
import {
  createPublicationInterfaceRequest,
  type CreatePublicationInterfaceRequest,
  type ModifyPublicationInterfaceRequest,
  type PublicationInterfaceRequest,
} from "./publication-interface-models.js";
import { DeterministicPublicationPresenter } from "./publication-interface-presenter.js";
import { DefaultPublicationRequestMapper } from "./publication-request-mapper.js";
import { StructuralPublicationInterfaceValidator } from "./publication-interface-validation.js";

const binding = {
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
} as const;

const executionContext = {
  actorId: "actor-interface",
  correlationId: "correlation-interface",
  idempotencyKey: "idempotency-interface",
  intentFingerprint: "sha256:interface-intent",
} as const;

const domainContext = {
  actorId: executionContext.actorId,
  authorityContext: "PUBLICATION_EXECUTION",
  reason: "Approved interface request",
  correlationId: executionContext.correlationId,
  occurredAt: "2026-07-27T13:00:00.000Z",
} as const;

function createRequest(): CreatePublicationInterfaceRequest {
  return createPublicationInterfaceRequest({
    operation: "CREATE_PUBLICATION",
    context: executionContext,
    input: {
      identity: { publicationId: "publication-interface-1", tenantScopeId: "team-a" },
      binding,
      prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
      classification: "CONFIDENTIAL_BUSINESS",
      command: domainContext,
    },
  });
}

function modifyRequest(): ModifyPublicationInterfaceRequest {
  return createPublicationInterfaceRequest({
    operation: "MODIFY_PUBLICATION",
    context: { ...executionContext, idempotencyKey: "idempotency-modify", intentFingerprint: "sha256:modify" },
    identity: { publicationId: "publication-interface-1", tenantScopeId: "team-a" },
    input: {
      type: "SET_SUSPENSION",
      expectedAggregateVersion: 1,
      suspensionStatus: "SUSPENDED_OPERATIONAL",
      command: { ...domainContext, correlationId: executionContext.correlationId },
    },
  });
}

function service(result: PublicationApplicationResult, onExecute: () => void = () => undefined): PublicationInterfaceService {
  const application: PublicationCommandHandler = {
    execute() {
      onExecute();
      return result;
    },
  };
  return new PublicationInterfaceService(
    application,
    new DefaultPublicationRequestMapper(),
    new DeterministicPublicationPresenter(),
    new StructuralPublicationInterfaceValidator(),
  );
}

test("PHASE13-5 request mapper converts immutable create input to the application contract", () => {
  const request = createRequest();
  const mapped = new DefaultPublicationRequestMapper().map(request);

  assert.equal(Object.isFrozen(request), true);
  assert.equal(Object.isFrozen(request.input.binding), true);
  assert.deepEqual(mapped, {
    command: { kind: "CREATE_PUBLICATION", input: request.input },
    context: request.context,
  });
  assert.equal(Object.isFrozen(mapped), true);
});

test("PHASE13-5 request mapper preserves modify identity and approved command without domain execution", () => {
  const request = modifyRequest();
  const mapped = new DefaultPublicationRequestMapper().map(request);

  assert.deepEqual(mapped, {
    command: { kind: "MODIFY_PUBLICATION", identity: request.identity, input: request.input },
    context: request.context,
  });
});

test("PHASE13-5 presenter maps successful application result without exposing result references", () => {
  const presenter = new DeterministicPublicationPresenter();
  const response = presenter.present({
    ok: true,
    publicationId: "publication-interface-1",
    aggregateVersion: 7,
    resultReference: '["publication-interface-1",7]',
    replayed: true,
  });

  assert.deepEqual(response, {
    operationResult: "SUCCEEDED",
    publicationId: "publication-interface-1",
    version: 7,
    replayed: true,
  });
  assert.equal("resultReference" in response, false);
  assert.equal(Object.isFrozen(response), true);
});

test("PHASE13-5 presenter maps application failures to a failure code only", () => {
  const response = new DeterministicPublicationPresenter().present({
    ok: false,
    error: { code: "PUBLICATION_VERSION_CONFLICT", category: "CONFLICT", message: "Publication version conflict." },
  });

  assert.deepEqual(response, { operationResult: "FAILED", failureCode: "PUBLICATION_VERSION_CONFLICT" });
  assert.equal("message" in response, false);
  assert.equal("category" in response, false);
});

test("PHASE13-5 presenter replaces unknown internal error codes with an interface-owned failure", () => {
  const presenter = new DeterministicPublicationPresenter();
  const response = presenter.present({
    ok: false,
    error: {
      code: "POSTGRES_UNIQUE_VIOLATION_publication_internal",
      category: "INFRASTRUCTURE",
      message: "internal persistence detail",
    },
  });

  assert.deepEqual(response, { operationResult: "FAILED", failureCode: "INTERFACE_EXECUTION_FAILED" });
  assert.deepEqual(presenter.presentInterfaceFailure("POSTGRES_INTERNAL"), { operationResult: "FAILED", failureCode: "INTERFACE_EXECUTION_FAILED" });
});

test("F15-TASK-005 presenter preserves only the approved safe authorization error vocabulary", () => {
  const presenter = new DeterministicPublicationPresenter();
  for (const failureCode of [
    "AUTHENTICATION_REQUIRED",
    "AUTHORIZATION_DENIED",
    "PURPOSE_SCOPE_DENIED",
    "MFA_REQUIRED",
    "REASON_REQUIRED",
    "SEPARATION_OF_DUTIES_DENIED",
    "APPROVAL_NOT_EFFECTIVE",
    "VERIFICATION_NOT_EFFECTIVE",
    "PERMISSION_NOT_EFFECTIVE",
    "BINDING_MISMATCH",
    "POLICY_VERSION_STALE",
  ]) {
    assert.deepEqual(presenter.presentInterfaceFailure(failureCode), {
      operationResult: "FAILED",
      failureCode,
    });
  }
  assert.deepEqual(presenter.presentInterfaceFailure("INTERNAL_POLICY_DETAIL"), {
    operationResult: "FAILED",
    failureCode: "INTERFACE_EXECUTION_FAILED",
  });
});

test("PHASE13-5 input port invokes the application boundary and returns the presented response", () => {
  let executions = 0;
  const inputPort = service({
    ok: true,
    publicationId: "publication-interface-1",
    aggregateVersion: 1,
    resultReference: '["publication-interface-1",1]',
    replayed: false,
  }, () => { executions += 1; });

  const response = inputPort.execute(createRequest());

  assert.deepEqual(response, { operationResult: "SUCCEEDED", publicationId: "publication-interface-1", version: 1, replayed: false });
  assert.equal(executions, 1);
});

test("PHASE13-5 structural validation fails before the application boundary", () => {
  const invalid = {
    operation: "MODIFY_PUBLICATION",
    context: { ...executionContext, idempotencyKey: " " },
    identity: { publicationId: "invalid id", tenantScopeId: "team-a" },
    input: { type: "SET_SUSPENSION", command: domainContext },
  } as unknown as PublicationInterfaceRequest;
  const inputPort = service({ ok: false, error: { code: "UNREACHABLE", category: "INFRASTRUCTURE", message: "unreachable" } }, () => {
    throw new Error("Application boundary must not execute.");
  });

  const response = inputPort.execute(invalid);

  assert.deepEqual(response, { operationResult: "FAILED", failureCode: "INTERFACE_REQUEST_INVALID" });
});

test("FCR-001 external Interface rejects caller-authored execution confirmation before Application", () => {
  let executions = 0;
  const inputPort = service({
    ok: true,
    publicationId: "publication-interface-1",
    aggregateVersion: 3,
    resultReference: "unreachable",
    replayed: false,
  }, () => { executions += 1; });
  const response = inputPort.execute(createPublicationInterfaceRequest({
    operation: "MODIFY_PUBLICATION",
    context: { ...executionContext, idempotencyKey: "idempotency-external-confirmation", intentFingerprint: "sha256:external-confirmation" },
    identity: { publicationId: "publication-interface-1", tenantScopeId: "team-a" },
    input: {
      type: "RESOLVE_EXECUTION",
      expectedAggregateVersion: 2,
      outcome: "EFFECT_CONFIRMED",
      evidenceRefs: ["caller-authored-evidence"],
      externalObjectReference: "caller-authored-object",
      command: domainContext,
    },
  }));

  assert.deepEqual(response, { operationResult: "FAILED", failureCode: "INTERFACE_REQUEST_INVALID" });
  assert.equal(executions, 0);
});

test("FCR-001 external Interface rejects caller-authored reconciliation evidence before coordination", () => {
  const inputPort = new PublicationInterfaceService(
    { execute: () => { throw new Error("Application boundary must not execute."); } },
    new DefaultPublicationRequestMapper(),
    new DeterministicPublicationPresenter(),
    new StructuralPublicationInterfaceValidator(),
  );

  const response = inputPort.execute({
    operation: "COORDINATE_PUBLICATION_RECONCILIATION",
    context: { ...executionContext, idempotencyKey: "idempotency-external-reconciliation" },
    identity: { publicationId: "publication-interface-1", tenantScopeId: "team-a" },
    input: {
      expectedAggregateVersion: 2,
      caseId: "case-caller-authored",
      category: "PARTIAL_COMPLETION",
      resolution: "EFFECT_CONFIRMED",
      evidenceRefs: ["caller-authored-evidence"],
      externalObjectReference: "caller-authored-object",
      command: domainContext,
    },
  });

  assert.deepEqual(response, { operationResult: "FAILED", failureCode: "INTERFACE_REQUEST_INVALID" });
});

test("PHASE13-5 structural validation rejects incomplete create and operation-specific commands", () => {
  const validator = new StructuralPublicationInterfaceValidator();
  const completeCreate = createRequest();
  const incompleteBinding = Object.fromEntries(Object.entries(completeCreate.input.binding).filter(([key]) => key !== "representationChecksum"));
  const completeModify = modifyRequest();
  assert.equal(completeModify.input.type, "SET_SUSPENSION");
  if (completeModify.input.type !== "SET_SUSPENSION") throw new Error("Unexpected test fixture command.");
  const incompleteModification = Object.fromEntries(Object.entries(completeModify.input).filter(([key]) => key !== "suspensionStatus"));

  const createValidation = validator.validate({
    ...completeCreate,
    input: { ...completeCreate.input, binding: incompleteBinding },
  });
  const modifyValidation = validator.validate({
    ...completeModify,
    input: incompleteModification,
  });

  assert.deepEqual(createValidation, { valid: false, failureCode: "INTERFACE_REQUEST_INVALID" });
  assert.deepEqual(modifyValidation, { valid: false, failureCode: "INTERFACE_REQUEST_INVALID" });
});

test("PHASE13-5 structural validation rejects unknown and non-JSON request values", () => {
  const validator = new StructuralPublicationInterfaceValidator();
  const request = createRequest();
  const unknownNestedField = {
    ...request,
    input: { ...request.input, binding: { ...request.input.binding, internalSequence: 1 } },
  };
  const nonJsonValue = {
    ...request,
    input: { ...request.input, internalSequence: 1n },
  };

  assert.deepEqual(validator.validate(unknownNestedField), { valid: false, failureCode: "INTERFACE_REQUEST_INVALID" });
  assert.deepEqual(validator.validate(nonJsonValue), { valid: false, failureCode: "INTERFACE_REQUEST_INVALID" });
  assert.throws(() => createPublicationInterfaceRequest(nonJsonValue as unknown as PublicationInterfaceRequest), TypeError);
});

test("PHASE13-5 request validation rejects sparse arrays that change JSON meaning", () => {
  const evidenceRefs = new Array<string>(1);
  const sparseRequest = {
    operation: "MODIFY_PUBLICATION",
    context: executionContext,
    identity: { publicationId: "publication-interface-1", tenantScopeId: "team-a" },
    input: {
      type: "BEGIN_INITIAL_EXECUTION",
      expectedAggregateVersion: 1,
      attempt: {
        id: "attempt-sparse",
        commandId: "command-sparse",
        operation: "INITIAL_PUBLISH",
        occurredAt: "2026-07-27T13:00:00.000Z",
        evidenceRefs,
      },
      command: domainContext,
    },
  } as const;

  assert.deepEqual(new StructuralPublicationInterfaceValidator().validate(sparseRequest), { valid: false, failureCode: "INTERFACE_REQUEST_INVALID" });
  assert.throws(() => createPublicationInterfaceRequest(sparseRequest), TypeError);
});

test("PHASE13-5 input port converts unexpected application exceptions without leaking details", () => {
  const application: PublicationCommandHandler = {
    execute(): never { throw new Error("internal stack and persistence detail"); },
  };
  const inputPort = new PublicationInterfaceService(
    application,
    new DefaultPublicationRequestMapper(),
    new DeterministicPublicationPresenter(),
    new StructuralPublicationInterfaceValidator(),
  );

  const response = inputPort.execute(createRequest());

  assert.deepEqual(response, { operationResult: "FAILED", failureCode: "INTERFACE_EXECUTION_FAILED" });
});

test("PHASE13-5 presenter is deterministic and stateless", () => {
  const presenter = new DeterministicPublicationPresenter();
  const result = { ok: true, publicationId: "publication-interface-1", aggregateVersion: 3, resultReference: "opaque", replayed: false } as const;
  const first = presenter.present(result);
  const second = presenter.present(result);

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
});

test("PHASE13-5 request and response models remain serialisable framework-independent data", () => {
  const request = createRequest();
  const response = service({
    ok: true,
    publicationId: "publication-interface-1",
    aggregateVersion: 1,
    resultReference: "internal-result",
    replayed: false,
  }).execute(request);
  const roundTripRequest = JSON.parse(JSON.stringify(request)) as unknown;
  const roundTripResponse = JSON.parse(JSON.stringify(response)) as unknown;

  assert.deepEqual(roundTripRequest, request);
  assert.deepEqual(roundTripResponse, response);
  assert.equal("status" in response, false);
  assert.equal("headers" in response, false);
  assert.equal("aggregate" in response, false);
});

test("PHASE13-5 production interface modules depend only on application and interface contracts", () => {
  const interfaceFiles = [
    "publication-interface-models.ts",
    "publication-interface-presenter.ts",
    "publication-interface-service.ts",
    "publication-interface-validation.ts",
    "publication-request-mapper.ts",
  ];
  const allowedImports = new Set([
    "./publication-application-contracts.js",
    "./publication-interface-models.js",
    "./publication-interface-presenter.js",
    "./publication-interface-validation.js",
    "./publication-request-mapper.js",
  ]);

  for (const file of interfaceFiles) {
    const source = readFileSync(join(process.cwd(), "modules", "publication", "src", file), "utf8");
    const imports = extractModuleSpecifiers(source);
    assert.equal(imports.every((specifier) => specifier !== undefined && allowedImports.has(specifier)), true, `${file} has a forbidden dependency`);
  }

  assert.deepEqual(extractModuleSpecifiers([
    'import type { A } from "./a.js";',
    'import "./b.js";',
    'const module = import("./c.js");',
  ].join("\n")), ["./a.js", "./b.js", "./c.js"]);
});

function extractModuleSpecifiers(source: string): string[] {
  const patterns = [
    /from\s+"([^"]+)"/g,
    /import\s+"([^"]+)"/g,
    /import\(\s*"([^"]+)"\s*\)/g,
  ];
  return patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1])).filter((specifier): specifier is string => specifier !== undefined);
}
