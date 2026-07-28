import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { FixedClock } from "./publication-clock.js";
import {
  PublicationPresentationAdapter,
  createPublicationPresentationAdapter,
} from "./publication-presentation-adapter.js";
import {
  createPublicationPresentationViewModel,
  type PublicationPresentationViewModel,
} from "./publication-presentation-contracts.js";
import { DeterministicPublicationPresentationErrorMapper } from "./publication-presentation-error-mapper.js";
import { DeterministicPublicationPresentationFormatter } from "./publication-presentation-formatter.js";
import { PublicationPresentationMetadataBuilder } from "./publication-presentation-metadata.js";
import {
  DefaultPublicationPresentationResultMapper,
  type PublicationPresentationResultMapper,
} from "./publication-presentation-result-mapper.js";
import { StructuralPublicationPresentationValidator } from "./publication-presentation-validation.js";
import { createPublicationTransportRequestEnvelope } from "./publication-transport-contracts.js";
import { createInProcessPublicationTransport } from "./publication-in-process-transport.js";
import { bootstrapPublicationRuntime } from "./publication-runtime.js";

const generatedAt = "2026-07-28T04:00:00.000Z";
const timeSource = Object.freeze({ now: () => generatedAt });
const successResponse = Object.freeze({
  requestId: "presentation-request-1",
  success: true as const,
  status: "SUCCESS" as const,
  data: { publicationId: "publication-presentation-1", version: 3, replayed: false },
  metadata: { source: "transport-test", internalHint: "must-not-copy" },
});

function mapper(): DefaultPublicationPresentationResultMapper {
  const formatter = new DeterministicPublicationPresentationFormatter();
  const metadata = new PublicationPresentationMetadataBuilder(timeSource);
  const errorMapper = new DeterministicPublicationPresentationErrorMapper(formatter, metadata);
  return new DefaultPublicationPresentationResultMapper(formatter, metadata, errorMapper);
}

test("PHASE13-9 creates an immutable serialisable Presentation View Model", () => {
  const model = createPublicationPresentationViewModel({
    presentationResult: "SUCCESS",
    category: "SUCCESS",
    message: "Publication operation completed.",
    fields: [
      { key: "publicationId", label: "Publication ID", value: "publication-1" },
      { key: "version", label: "Version", value: "1" },
    ],
    metadata: {
      generatedAt,
      version: "1",
      requestId: "request-1",
      resultType: "SUCCESS",
    },
  });

  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.fields), true);
  assert.equal(Object.isFrozen(model.fields[0]), true);
  assert.equal(Object.isFrozen(model.metadata), true);
  assert.deepEqual(JSON.parse(JSON.stringify(model)), model);
  assert.throws(() => {
    (model.fields as unknown as unknown[]).push({});
  }, TypeError);
});

test("PHASE13-9 maps a successful Transport response to a stable Presentation model", () => {
  const model = mapper().map(successResponse);

  assert.deepEqual(model, {
    presentationResult: "SUCCESS",
    category: "SUCCESS",
    message: "Publication operation completed.",
    fields: [
      { key: "publicationId", label: "Publication ID", value: "publication-presentation-1" },
      { key: "version", label: "Version", value: "3" },
      { key: "replayed", label: "Replayed", value: "No" },
    ],
    metadata: {
      generatedAt,
      version: "1",
      requestId: "presentation-request-1",
      resultType: "SUCCESS",
    },
  });
});

test("PHASE13-9 maps every approved Transport error category to presentation-safe meaning", () => {
  const errorMapper = new DeterministicPublicationPresentationErrorMapper(
    new DeterministicPublicationPresentationFormatter(),
    new PublicationPresentationMetadataBuilder(timeSource),
  );
  const cases = [
    ["VALIDATION_ERROR", "VALIDATION"],
    ["OPERATION_NOT_FOUND", "NOT_FOUND"],
    ["NOT_FOUND", "NOT_FOUND"],
    ["CONFLICT", "CONFLICT"],
    ["APPLICATION_REJECTED", "APPLICATION_REJECTION"],
    ["INTERNAL_ERROR", "INTERNAL_ERROR"],
  ] as const;

  for (const [status, category] of cases) {
    const model = errorMapper.map({
      requestId: `request-${status.toLowerCase()}`,
      success: false,
      status,
      error: { code: `SAFE_${status}`, message: "Safe transport message." },
      metadata: {},
    });
    assert.equal(model.presentationResult, "ERROR");
    assert.equal(model.category, category);
    assert.equal(model.message, "Safe transport message.");
    assert.deepEqual(model.fields, [{ key: "errorCode", label: "Error Code", value: `SAFE_${status}` }]);
  }
});

test("PHASE13-9 metadata builder produces deterministic generic metadata", () => {
  const builder = new PublicationPresentationMetadataBuilder(timeSource);
  const first = builder.build("request-1", "ERROR");
  const second = builder.build("request-1", "ERROR");

  assert.deepEqual(first, {
    generatedAt,
    version: "1",
    requestId: "request-1",
    resultType: "ERROR",
  });
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
});

test("PHASE13-9 formatter produces deterministic labels, ordering and scalar values", () => {
  const formatter = new DeterministicPublicationPresentationFormatter();
  const first = formatter.formatSuccess({ publicationId: "publication-1", version: 9, replayed: true });
  const second = formatter.formatSuccess({ publicationId: "publication-1", version: 9, replayed: true });

  assert.deepEqual(first, [
    { key: "publicationId", label: "Publication ID", value: "publication-1" },
    { key: "version", label: "Version", value: "9" },
    { key: "replayed", label: "Replayed", value: "Yes" },
  ]);
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.deepEqual(formatter.formatError("SAFE_ERROR"), [
    { key: "errorCode", label: "Error Code", value: "SAFE_ERROR" },
  ]);
});

test("PHASE13-9 boundary validator accepts canonical models and rejects formatting inconsistencies", () => {
  const validator = new StructuralPublicationPresentationValidator();
  const valid = mapper().map(successResponse);
  const invalid = [
    { ...valid, metadata: { ...valid.metadata, resultType: "ERROR" } },
    { ...valid, fields: [...valid.fields, valid.fields[0]] },
    { ...valid, fields: [{ key: "publicationId", label: "", value: "publication-1" }] },
    { ...valid, message: " " },
  ];

  assert.deepEqual(validator.validate(valid), { valid: true });
  for (const candidate of invalid) {
    assert.deepEqual(validator.validate(candidate), {
      valid: false,
      failureCode: "PRESENTATION_MODEL_INVALID",
    });
  }
});

test("PHASE13-9 adapter invokes the mapper and returns a validated immutable model", () => {
  const adapter = createPublicationPresentationAdapter(timeSource);
  const model = adapter.present(successResponse);

  assert.equal(model.presentationResult, "SUCCESS");
  assert.equal(model.metadata.requestId, successResponse.requestId);
  assert.equal(Object.isFrozen(model), true);
});

test("PHASE13-9 adapter normalises a valid mutable mapper result to an isolated immutable model", () => {
  const mutableFields = [
    { key: "publicationId", label: "Publication ID", value: "publication-mutable" },
  ];
  const mutableMetadata: {
    generatedAt: string;
    version: "1";
    requestId: string;
    resultType: "SUCCESS";
  } = {
    generatedAt,
    version: "1",
    requestId: successResponse.requestId,
    resultType: "SUCCESS",
  };
  const mutableModel = {
    presentationResult: "SUCCESS" as const,
    category: "SUCCESS" as const,
    message: "Publication operation completed.",
    fields: mutableFields,
    metadata: mutableMetadata,
  } satisfies PublicationPresentationViewModel;
  const mutableMapper: PublicationPresentationResultMapper = {
    map: () => mutableModel,
  };
  const formatter = new DeterministicPublicationPresentationFormatter();
  const metadata = new PublicationPresentationMetadataBuilder(timeSource);
  const adapter = new PublicationPresentationAdapter(
    mutableMapper,
    new StructuralPublicationPresentationValidator(),
    new DeterministicPublicationPresentationErrorMapper(formatter, metadata),
  );

  const model = adapter.present(successResponse);

  assert.notEqual(model, mutableModel);
  assert.notEqual(model.fields, mutableFields);
  assert.notEqual(model.metadata, mutableMetadata);
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.fields), true);
  assert.equal(Object.isFrozen(model.fields[0]), true);
  assert.equal(Object.isFrozen(model.metadata), true);
  mutableFields[0]!.value = "changed-after-present";
  mutableMetadata.requestId = "changed-after-present";
  assert.equal(model.fields[0]?.value, "publication-mutable");
  assert.equal(model.metadata.requestId, successResponse.requestId);
});

test("PHASE13-9 adapter converts mapper failure or invalid output to a safe internal model", () => {
  const formatter = new DeterministicPublicationPresentationFormatter();
  const metadata = new PublicationPresentationMetadataBuilder(timeSource);
  const errorMapper = new DeterministicPublicationPresentationErrorMapper(formatter, metadata);
  const throwingMapper: PublicationPresentationResultMapper = {
    map(): never {
      throw new Error("internal presentation stack and secret");
    },
  };
  const invalidMapper: PublicationPresentationResultMapper = {
    map(): PublicationPresentationViewModel {
      return { presentationResult: "SUCCESS" } as unknown as PublicationPresentationViewModel;
    },
  };

  for (const resultMapper of [throwingMapper, invalidMapper]) {
    const model = new PublicationPresentationAdapter(
      resultMapper,
      new StructuralPublicationPresentationValidator(),
      errorMapper,
    ).present(successResponse);
    assert.deepEqual(model, {
      presentationResult: "ERROR",
      category: "INTERNAL_ERROR",
      message: "Presentation could not be generated.",
      fields: [{ key: "errorCode", label: "Error Code", value: "PRESENTATION_INTERNAL_ERROR" }],
      metadata: {
        generatedAt,
        version: "1",
        requestId: successResponse.requestId,
        resultType: "ERROR",
      },
    });
    assert.equal(JSON.stringify(model).includes("secret"), false);
  }
});

test("PHASE13-9 mapping does not mutate Transport input or copy internal Transport metadata", () => {
  const transport = structuredClone(successResponse);
  const before = structuredClone(transport);
  const model = createPublicationPresentationAdapter(timeSource).present(transport);

  assert.deepEqual(transport, before);
  assert.equal(JSON.stringify(model).includes("must-not-copy"), false);
  assert.equal("status" in model, false);
  assert.equal("data" in model, false);
  assert.equal("error" in model, false);
});

test("PHASE13-9 completes Publication execution through Transport and Presentation boundaries", () => {
  const runtimeResult = bootstrapPublicationRuntime({
    infrastructureConfiguration: { clock: new FixedClock(generatedAt) },
  });
  assert.equal(runtimeResult.ok, true);
  if (!runtimeResult.ok) throw new Error("Runtime bootstrap unexpectedly failed.");
  const transport = createInProcessPublicationTransport(runtimeResult.runtime);
  const transportResponse = transport.execute(createPublicationTransportRequestEnvelope({
    requestId: "presentation-e2e-request",
    operation: "CREATE_PUBLICATION",
    payload: {
      context: {
        actorId: "actor-presentation",
        correlationId: "correlation-presentation",
        idempotencyKey: "idempotency-presentation",
        intentFingerprint: "sha256:presentation-intent",
      },
      input: {
        identity: { publicationId: "publication-presentation-e2e", tenantScopeId: "team-a" },
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
          actorId: "actor-presentation",
          authorityContext: "PUBLICATION_EXECUTION",
          reason: "Approved presentation boundary request",
          correlationId: "correlation-presentation",
          occurredAt: generatedAt,
        },
      },
    },
    metadata: {},
  }));

  const model = createPublicationPresentationAdapter(timeSource).present(transportResponse);

  assert.deepEqual(model.fields, [
    { key: "publicationId", label: "Publication ID", value: "publication-presentation-e2e" },
    { key: "version", label: "Version", value: "1" },
    { key: "replayed", label: "Replayed", value: "No" },
  ]);
  assert.equal(model.presentationResult, "SUCCESS");
  assert.equal(runtimeResult.runtime.services.repository.find({
    publicationId: "publication-presentation-e2e",
    tenantScopeId: "team-a",
  })?.lifecycleState, "READY");
});

test("PHASE13-9 Presentation production modules preserve isolation and framework neutrality", () => {
  const sourceDirectory = join(process.cwd(), "modules", "publication", "src");
  const productionFiles = readdirSync(sourceDirectory)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && file !== "index.ts");
  const presentationFiles = productionFiles.filter((file) => file.startsWith("publication-presentation-"));
  const allowedImports = new Set([
    ...presentationFiles.map((file) => `./${file.slice(0, -3)}.js`),
    "./publication-transport-contracts.js",
  ]);
  const forbidden = [
    /\b(react|vue|angular|html|jsx|css|dom|browser|window|document|template|ssr)\b/,
    /\b(http|graphql|authentication|authorization|database|orm|logging|monitoring|deployment)\b/,
    /\b(runtime|infrastructure|repository|aggregate|workflow|policy|permission)\b/,
    /process\.env/,
  ];

  assert.deepEqual(presentationFiles.sort(), [
    "publication-presentation-adapter.ts",
    "publication-presentation-contracts.ts",
    "publication-presentation-error-mapper.ts",
    "publication-presentation-formatter.ts",
    "publication-presentation-metadata.ts",
    "publication-presentation-result-mapper.ts",
    "publication-presentation-validation.ts",
  ]);
  for (const file of presentationFiles) {
    const source = readFileSync(join(sourceDirectory, file), "utf8");
    const imports = extractModuleSpecifiers(source);
    assert.equal(imports.every((specifier) => allowedImports.has(specifier)), true, `${file} imports an unapproved layer`);
    const lowerSource = source.toLowerCase();
    assert.equal(forbidden.some((pattern) => pattern.test(lowerSource)), false, `${file} contains forbidden presentation capability`);
  }

  const presentationSpecifiers = new Set(presentationFiles.map((file) => `./${file.slice(0, -3)}.js`));
  const innerFiles = productionFiles.filter((file) => !presentationFiles.includes(file));
  for (const file of innerFiles) {
    const imports = extractModuleSpecifiers(readFileSync(join(sourceDirectory, file), "utf8"));
    assert.equal(imports.some((specifier) => presentationSpecifiers.has(specifier)), false, `${file} imports Presentation`);
  }
});

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
