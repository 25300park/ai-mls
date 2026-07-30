import {
  immutablePublicationNodeHttpServerStateSnapshot,
  PublicationNodeHttpServerError,
  type PublicationNodeHttpServerState,
  type PublicationNodeHttpServerStateSnapshot,
} from "./publication-node-http-contracts.js";

const transitions = Object.freeze({
  CREATED: Object.freeze(["STARTING"]),
  STARTING: Object.freeze(["LISTENING", "FAILED"]),
  LISTENING: Object.freeze(["STOPPING", "FAILED"]),
  STOPPING: Object.freeze(["STOPPED", "FAILED"]),
  STOPPED: Object.freeze([]),
  FAILED: Object.freeze([]),
} satisfies Readonly<Record<PublicationNodeHttpServerState, readonly PublicationNodeHttpServerState[]>>);

export class PublicationNodeHttpLifecycleController {
  private current: PublicationNodeHttpServerStateSnapshot =
    immutablePublicationNodeHttpServerStateSnapshot("CREATED", 0);

  public get snapshot(): PublicationNodeHttpServerStateSnapshot {
    return this.current;
  }

  public transition(next: PublicationNodeHttpServerState): PublicationNodeHttpServerStateSnapshot {
    const allowed: readonly PublicationNodeHttpServerState[] = transitions[this.current.state];
    if (!allowed.includes(next)) {
      throw new PublicationNodeHttpServerError(
        "SERVER_NOT_LISTENING",
        "Node HTTP server lifecycle transition is not allowed.",
      );
    }
    this.current = immutablePublicationNodeHttpServerStateSnapshot(next, this.current.sequence + 1);
    return this.current;
  }
}
