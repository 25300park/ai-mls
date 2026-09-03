import assert from "node:assert/strict";
import test from "node:test";
import { PublicationRecoveryExecutionPlanner } from "./publication-recovery-execution-planner.js";

const input = Object.freeze({
  identity: Object.freeze({ publicationId: "publication-recovery-1", tenantScopeId: "tenant-recovery-1" }),
  recoveryCaseId: "recovery-case-1",
  reconciliationCaseId: "publication-case-1",
  originalAttemptId: "attempt-original-1",
  originalCommandId: "command-original-1",
});

test("F19-C Publication planner creates stable new resource-bound recovery attempt and command identities", () => {
  const planner = new PublicationRecoveryExecutionPlanner();
  const first = planner.plan(input);
  const replay = planner.plan(input);

  assert.deepEqual(replay, first);
  assert.notEqual(first.attemptId, input.originalAttemptId);
  assert.notEqual(first.commandId, input.originalCommandId);
  assert.match(first.attemptId, /^publication-recovery-attempt:[a-f0-9]{64}$/u);
  assert.match(first.commandId, /^publication-recovery-command:[a-f0-9]{64}$/u);
  assert.notDeepEqual(planner.plan({ ...input, identity: { ...input.identity, publicationId: "publication-recovery-2" } }), first);
  assert.notDeepEqual(planner.plan({ ...input, recoveryCaseId: "recovery-case-2" }), first);
});

test("F19-C Publication planner rejects incomplete or self-reusing trusted planning input", () => {
  const planner = new PublicationRecoveryExecutionPlanner();
  assert.throws(() => planner.plan({ ...input, recoveryCaseId: "" }), /recovery planning input/i);
  assert.throws(() => planner.validateNewIdentity({ ...input, planned: { attemptId: input.originalAttemptId, commandId: "command-new" } }), /recovery execution identity/i);
  assert.throws(() => planner.validateNewIdentity({ ...input, planned: { attemptId: "attempt-new", commandId: input.originalCommandId } }), /recovery execution identity/i);
  assert.doesNotThrow(() => planner.validateNewIdentity({ ...input, planned: planner.plan(input) }));
});
