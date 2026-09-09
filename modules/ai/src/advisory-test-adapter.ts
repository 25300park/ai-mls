import type { AdvisoryAdapter } from "./advisory-runtime-contracts.js";

export type DeterministicAdvisoryBehavior = "ERROR" | "TIMEOUT" | "MALFORMED";

export class DeterministicNoNetworkAdvisoryAdapter implements AdvisoryAdapter {
  public readonly adapterVersion = "deterministic-advisory-v1";
  public invocationCount = 0;
  readonly #result: unknown;
  readonly #behavior: DeterministicAdvisoryBehavior | undefined;

  public constructor(options: { readonly result?: unknown; readonly behavior?: DeterministicAdvisoryBehavior }) {
    this.#result = options.result;
    this.#behavior = options.behavior;
  }

  public generate(): unknown {
    this.invocationCount += 1;
    if (this.#behavior === "ERROR") throw new Error("deterministic adapter error");
    if (this.#behavior === "TIMEOUT") throw new Error("deterministic adapter timeout");
    if (this.#behavior === "MALFORMED") return Object.freeze({ malformed: true });
    return immutable(this.#result);
  }
}

function immutable<T>(value: T): T { const copy = structuredClone(value); deepFreeze(copy); return copy; }
function deepFreeze(value: unknown): void { if (value !== null && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); } }
