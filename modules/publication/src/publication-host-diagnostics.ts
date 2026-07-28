import {
  immutablePublicationHostDiagnostics,
  type PublicationHostDiagnostics,
  type PublicationHostShutdownStatus,
  type PublicationHostStateSnapshot,
} from "./publication-host-contracts.js";

export function createPublicationHostDiagnostics(
  state: PublicationHostStateSnapshot,
  startupDurationMs: number | null,
  shutdownStatus: PublicationHostShutdownStatus,
): PublicationHostDiagnostics {
  return immutablePublicationHostDiagnostics({
    lifecycleState: state.state,
    startupDurationMs,
    shutdownStatus,
  });
}
