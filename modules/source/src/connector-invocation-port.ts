import type { ConnectorExecutionScope } from "./connector-durable-persistence.js";

export type ConnectorInvocationRequest = ConnectorExecutionScope & Readonly<{
  readonly invocationId: string;
  readonly inputReference: string;
  readonly inputVersion: number;
  readonly sourcePolicyVersion: number;
  readonly connectorVersion: number;
}>;

export type ConnectorInvocationResponse = Readonly<{
  readonly outcome: "SUCCEEDED" | "FAILED" | "UNKNOWN";
  readonly reasonCode: string;
  readonly safeEvidenceReference: string;
  readonly checkpointReference?: string;
}>;

export interface ConnectorInvocationPort {
  invoke(request: ConnectorInvocationRequest): ConnectorInvocationResponse;
}
