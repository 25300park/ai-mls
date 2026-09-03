import { createHash } from "node:crypto";
import type { PublicationIdentity } from "./publication-contracts.js";
import type { RecoveryActionType, RecoveryCaseRecord, RecoveryExecutionIdentity } from "../../recovery/src/recovery-orchestration-contracts.js";

export interface PublicationRecoveryPlanningInput {
  readonly identity: PublicationIdentity;
  readonly recoveryCaseId: string;
  readonly reconciliationCaseId: string;
  readonly originalAttemptId: string;
  readonly originalCommandId: string;
}

export interface PublicationRecoveryExecutionIdentity {
  readonly attemptId: string;
  readonly commandId: string;
}

export interface PublicationRecoveryOriginalExecutionReader {
  findOriginalExecution(input: Readonly<{
    identity: PublicationIdentity;
    reconciliationCaseId: string;
    attemptId: string;
  }>): Readonly<{ commandId: string }> | undefined;
}

export class PublicationRecoveryExecutionPlanner {
  public plan(input: PublicationRecoveryPlanningInput): PublicationRecoveryExecutionIdentity {
    validateInput(input);
    const material = JSON.stringify([
      input.identity.tenantScopeId,
      input.identity.publicationId,
      input.recoveryCaseId,
      input.reconciliationCaseId,
      input.originalAttemptId,
      input.originalCommandId,
    ]);
    const planned = Object.freeze({
      attemptId: `publication-recovery-attempt:${digest(`${material}:attempt`)}`,
      commandId: `publication-recovery-command:${digest(`${material}:command`)}`,
    });
    this.validateNewIdentity({ ...input, planned });
    return planned;
  }

  public validateNewIdentity(input: PublicationRecoveryPlanningInput & Readonly<{ planned: PublicationRecoveryExecutionIdentity }>): void {
    validateInput(input);
    if (!input.planned.attemptId.trim() || !input.planned.commandId.trim()
      || input.planned.attemptId === input.originalAttemptId
      || input.planned.commandId === input.originalCommandId) {
      throw new TypeError("Publication recovery execution identity is invalid.");
    }
  }
}

export class PublicationRecoveryExecutionIdentityValidator {
  public constructor(
    private readonly originalExecutionReader: PublicationRecoveryOriginalExecutionReader,
    private readonly planner = new PublicationRecoveryExecutionPlanner(),
  ) {}

  public validate(input: Readonly<{
    recoveryCase: RecoveryCaseRecord;
    recoveryActionType: RecoveryActionType;
    recoveryExecutionIdentity: RecoveryExecutionIdentity;
  }>): boolean {
    const recoveryCase = input.recoveryCase;
    if (input.recoveryActionType !== "PUBLICATION_RECOVERY" || recoveryCase.resourceType !== "Publication" || recoveryCase.originDomain !== "PUBLICATION"
      || !("reconciliationCaseId" in recoveryCase.originIdentity) || !("attemptId" in recoveryCase.originIdentity)
      || !("attemptId" in input.recoveryExecutionIdentity) || !("commandId" in input.recoveryExecutionIdentity)) return false;
    const identity = Object.freeze({ publicationId: recoveryCase.resourceId, tenantScopeId: recoveryCase.tenantId });
    const original = this.originalExecutionReader.findOriginalExecution({
      identity,
      reconciliationCaseId: recoveryCase.originIdentity.reconciliationCaseId,
      attemptId: recoveryCase.originIdentity.attemptId,
    });
    if (!original?.commandId.trim()) return false;
    try {
      const planned = this.planner.plan({
        identity,
        recoveryCaseId: recoveryCase.recoveryCaseId,
        reconciliationCaseId: recoveryCase.originIdentity.reconciliationCaseId,
        originalAttemptId: recoveryCase.originIdentity.attemptId,
        originalCommandId: original.commandId,
      });
      return input.recoveryExecutionIdentity.attemptId === planned.attemptId
        && input.recoveryExecutionIdentity.commandId === planned.commandId;
    } catch {
      return false;
    }
  }
}

function validateInput(input: PublicationRecoveryPlanningInput): void {
  const values = [input.identity.tenantScopeId, input.identity.publicationId, input.recoveryCaseId, input.reconciliationCaseId, input.originalAttemptId, input.originalCommandId];
  if (values.some((value) => typeof value !== "string" || value.trim().length === 0)) {
    throw new TypeError("Publication recovery planning input is invalid.");
  }
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
