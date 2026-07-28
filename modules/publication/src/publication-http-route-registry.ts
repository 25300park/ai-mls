import {
  normalisePublicationHttpMethod,
  normalisePublicationHttpPath,
  PublicationHttpAdapterError,
} from "./publication-http-contracts.js";

export type PublicationHttpOperation = "CREATE_PUBLICATION" | "MODIFY_PUBLICATION";

export interface PublicationHttpRoute {
  readonly method: string;
  readonly path: string;
  readonly operation: PublicationHttpOperation;
}

export type PublicationHttpRouteResolution =
  | { readonly kind: "MATCH"; readonly route: PublicationHttpRoute }
  | { readonly kind: "METHOD_NOT_ALLOWED" }
  | { readonly kind: "ROUTE_NOT_FOUND" };

const defaultRoutes = Object.freeze([
  Object.freeze({
    method: "POST",
    path: "/publications/commands/create",
    operation: "CREATE_PUBLICATION",
  }),
  Object.freeze({
    method: "POST",
    path: "/publications/commands/modify",
    operation: "MODIFY_PUBLICATION",
  }),
] as const);

export class PublicationHttpRouteRegistry {
  public readonly routes: readonly PublicationHttpRoute[];

  public constructor(input: unknown) {
    try {
      if (!Array.isArray(input) || Object.keys(input).length !== input.length) throw invalidRegistry();
      const routes: readonly unknown[] = input;
      const keys = new Set<string>();
      const canonical = routes.map((route) => {
        if (!isPlainRecord(route)) throw invalidRegistry();
        const method = normalisePublicationHttpMethod(route["method"]);
        const path = normalisePublicationHttpPath(route["path"]);
        const operation = route["operation"];
        if (operation !== "CREATE_PUBLICATION" && operation !== "MODIFY_PUBLICATION") {
          throw invalidRegistry();
        }
        const key = `${method} ${path}`;
        if (keys.has(key)) throw invalidRegistry();
        keys.add(key);
        return Object.freeze({ method, path, operation });
      });
      this.routes = Object.freeze(canonical);
      Object.freeze(this);
    } catch {
      throw invalidRegistry();
    }
  }

  public resolve(methodValue: unknown, pathValue: unknown): PublicationHttpRouteResolution {
    const method = normalisePublicationHttpMethod(methodValue);
    const path = normalisePublicationHttpPath(pathValue);
    const route = this.routes.find((candidate) => candidate.method === method && candidate.path === path);
    if (route !== undefined) return Object.freeze({ kind: "MATCH", route });
    if (this.routes.some((candidate) => candidate.path === path)) {
      return Object.freeze({ kind: "METHOD_NOT_ALLOWED" });
    }
    return Object.freeze({ kind: "ROUTE_NOT_FOUND" });
  }
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

export function createDefaultPublicationHttpRouteRegistry(): PublicationHttpRouteRegistry {
  return new PublicationHttpRouteRegistry(defaultRoutes);
}

function invalidRegistry(): PublicationHttpAdapterError {
  return new PublicationHttpAdapterError("INVALID_HTTP_REQUEST", "HTTP route registry is invalid.");
}
