import type { PublicationApplicationHost } from "./publication-application-host.js";
import {
  immutablePublicationExecutableValue,
  type PublicationExecutableValue,
} from "./publication-executable-contracts.js";

export interface PublicationHostInvocationResult {
  readonly success: boolean;
  readonly result: PublicationExecutableValue;
}

export class PublicationHostInvocationAdapter {
  public constructor(private readonly host: PublicationApplicationHost) {}

  public async invoke(request: unknown): Promise<PublicationHostInvocationResult> {
    const result = immutablePublicationExecutableValue(await this.host.execute(request));
    return Object.freeze({
      success: isSuccessfulPresentation(result),
      result,
    });
  }
}

function isSuccessfulPresentation(value: PublicationExecutableValue): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return (value as Readonly<Record<string, PublicationExecutableValue>>)["presentationResult"]
    === "SUCCESS";
}
