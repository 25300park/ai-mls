import {
  immutablePublicationHostStateSnapshot,
  PublicationHostError,
  type PublicationHostState,
  type PublicationHostStateSnapshot,
} from "./publication-host-contracts.js";

const allowedTransitions: Readonly<Record<PublicationHostState, readonly PublicationHostState[]>> = Object.freeze({
  CREATED: immutableStates("INITIALISING"),
  INITIALISING: immutableStates("READY", "FAILED"),
  READY: immutableStates("STOPPING", "FAILED"),
  STOPPING: immutableStates("STOPPED", "FAILED"),
  STOPPED: immutableStates(),
  FAILED: immutableStates(),
});

export class PublicationHostLifecycleController {
  private current = immutablePublicationHostStateSnapshot("CREATED", 0);

  public get snapshot(): PublicationHostStateSnapshot {
    return this.current;
  }

  public transition(next: PublicationHostState): PublicationHostStateSnapshot {
    if (!allowedTransitions[this.current.state].includes(next)) {
      throw new PublicationHostError(
        "HOST_TRANSITION_INVALID",
        "Host lifecycle transition is invalid.",
      );
    }
    this.current = immutablePublicationHostStateSnapshot(next, this.current.sequence + 1);
    return this.current;
  }
}

function immutableStates(...states: PublicationHostState[]): readonly PublicationHostState[] {
  return Object.freeze(states);
}
