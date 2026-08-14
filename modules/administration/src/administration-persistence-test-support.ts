import {
  AdministrationPersistenceError,
  type AdministrationPersistenceFailurePoint,
  type AdministrationPersistenceFailurePort,
} from "./administration-persistence.js";

export interface AdministrationPersistenceFailureInjector {
  readonly port: AdministrationPersistenceFailurePort;
  failNext(point: AdministrationPersistenceFailurePoint): void;
}

export function createAdministrationPersistenceFailureInjector(): AdministrationPersistenceFailureInjector {
  const pending = new Set<AdministrationPersistenceFailurePoint>();
  return {
    port: {
      check(point): void {
        if (!pending.delete(point)) return;
        throw new AdministrationPersistenceError("PERSISTENCE_WRITE_FAILED");
      },
    },
    failNext(point): void { pending.add(point); },
  };
}
