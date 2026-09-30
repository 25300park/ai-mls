import type {
  PublicationExecutableRequest,
  PublicationExecutableResult,
} from "./publication-executable-contracts.js";

export interface PublicationExecutableInvoker {
  execute(request: PublicationExecutableRequest): Promise<PublicationExecutableResult>;
}

export class PublicationExecutableInvocationAdapter {
  public constructor(private readonly executable: PublicationExecutableInvoker) {}

  public invoke(request: PublicationExecutableRequest): Promise<PublicationExecutableResult> {
    return this.executable.execute(request);
  }
}
