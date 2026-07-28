import {
  immutablePublicationExecutableStateSnapshot,
  PublicationExecutableError,
  type PublicationExecutableState,
  type PublicationExecutableStateSnapshot,
} from "./publication-executable-contracts.js";

const allowedTransitions: Readonly<Record<PublicationExecutableState, readonly PublicationExecutableState[]>> = Object.freeze({
  CREATED: immutableStates("STARTING"),
  STARTING: immutableStates("READY", "FAILED"),
  READY: immutableStates("EXECUTING", "STOPPING", "FAILED"),
  EXECUTING: immutableStates("READY", "FAILED"),
  STOPPING: immutableStates("STOPPED", "FAILED"),
  STOPPED: immutableStates(),
  FAILED: immutableStates(),
});

export class PublicationExecutableLifecycleController {
  private current = immutablePublicationExecutableStateSnapshot("CREATED", 0);

  public get snapshot(): PublicationExecutableStateSnapshot {
    return this.current;
  }

  public transition(next: PublicationExecutableState): PublicationExecutableStateSnapshot {
    if (!allowedTransitions[this.current.state].includes(next)) {
      throw new PublicationExecutableError(
        "INTERNAL_EXECUTABLE_ERROR",
        "Executable lifecycle transition is invalid.",
      );
    }
    this.current = immutablePublicationExecutableStateSnapshot(next, this.current.sequence + 1);
    return this.current;
  }
}

function immutableStates(...states: PublicationExecutableState[]): readonly PublicationExecutableState[] {
  return Object.freeze(states);
}
