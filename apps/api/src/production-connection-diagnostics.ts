import { lookup } from "node:dns/promises";
import { getSystemErrorName } from "node:util";

export type SafeTransportCode = "DNS_NOT_FOUND" | "DNS_TEMPORARY_FAILURE" | "NETWORK_UNREACHABLE" | "CONNECTION_REFUSED" | "CONNECTION_TIMEOUT" | "CONNECTION_RESET" | "TLS_CERTIFICATE_FAILURE" | "TLS_HANDSHAKE_FAILURE" | "POSTGRES_SERVER_ERROR" | "UNKNOWN_CONNECTION_FAILURE";
interface ConnectionClassification { readonly transportCode: SafeTransportCode; readonly sqlstate: string | null }
const unknown: ConnectionClassification = Object.freeze({ transportCode: "UNKNOWN_CONNECTION_FAILURE", sqlstate: null });
const codes = new Map<string, SafeTransportCode>([
  ["ENOTFOUND", "DNS_NOT_FOUND"], ["EAI_AGAIN", "DNS_TEMPORARY_FAILURE"],
  ["ENETUNREACH", "NETWORK_UNREACHABLE"], ["EHOSTUNREACH", "NETWORK_UNREACHABLE"],
  ["ECONNREFUSED", "CONNECTION_REFUSED"], ["ETIMEDOUT", "CONNECTION_TIMEOUT"],
  ["ESOCKETTIMEDOUT", "CONNECTION_TIMEOUT"], ["ERR_SOCKET_CONNECTION_TIMEOUT", "CONNECTION_TIMEOUT"],
  ["ECONNRESET", "CONNECTION_RESET"],
  ["CERT_HAS_EXPIRED", "TLS_CERTIFICATE_FAILURE"], ["CERT_NOT_YET_VALID", "TLS_CERTIFICATE_FAILURE"],
  ["ERR_TLS_CERT_ALTNAME_INVALID", "TLS_CERTIFICATE_FAILURE"], ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "TLS_CERTIFICATE_FAILURE"],
  ["SELF_SIGNED_CERT_IN_CHAIN", "TLS_CERTIFICATE_FAILURE"], ["DEPTH_ZERO_SELF_SIGNED_CERT", "TLS_CERTIFICATE_FAILURE"],
  ["UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "TLS_CERTIFICATE_FAILURE"], ["CERT_SIGNATURE_FAILURE", "TLS_CERTIFICATE_FAILURE"],
  ["CERT_REVOKED", "TLS_CERTIFICATE_FAILURE"], ["INVALID_CA", "TLS_CERTIFICATE_FAILURE"],
  ["EPROTO", "TLS_HANDSHAKE_FAILURE"], ["ERR_SSL_WRONG_VERSION_NUMBER", "TLS_HANDSHAKE_FAILURE"],
  ["ERR_SSL_UNSUPPORTED_PROTOCOL", "TLS_HANDSHAKE_FAILURE"], ["ERR_TLS_HANDSHAKE_TIMEOUT", "TLS_HANDSHAKE_FAILURE"],
  ["ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE", "TLS_HANDSHAKE_FAILURE"], ["ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION", "TLS_HANDSHAKE_FAILURE"],
]);
function ownValue(value: object, key: string): unknown {
  try { const descriptor = Object.getOwnPropertyDescriptor(value, key); return descriptor !== undefined && "value" in descriptor ? descriptor.value as unknown : undefined; }
  catch { return undefined; }
}
function classifyCode(value: unknown): ConnectionClassification | undefined {
  let code = value;
  if (typeof code === "number" && Number.isInteger(code) && code < 0) {
    try { code = getSystemErrorName(code); } catch { return undefined; }
  }
  if (typeof code !== "string") return undefined;
  if (/^(?:08|0A|22|23|25|28|3D|3F|40|42|53|54|55|57|58|F0|P0|XX)[0-9A-Z]{3}$/u.test(code)) return Object.freeze({ transportCode: "POSTGRES_SERVER_ERROR", sqlstate: code });
  const transportCode = codes.get(code);
  return transportCode === undefined ? undefined : Object.freeze({ transportCode, sqlstate: null });
}
/** Bounded code-only inspection; never reads message, stack, address or hostname. */
export function classifyPhysicalConnectionFailure(error: unknown): ConnectionClassification {
  const queue: {value: unknown; depth: number}[] = [{ value: error, depth: 0 }], seen = new WeakSet<object>();
  const found: ConnectionClassification[] = [];
  let truncated = false;
  for (let visited = 0; queue.length > 0 && visited < 8; visited++) {
    const node = queue.shift();
    if (node === undefined || node.value === null || typeof node.value !== "object" || seen.has(node.value)) continue;
    seen.add(node.value);
    const classification = classifyCode(ownValue(node.value, "code")) ?? classifyCode(ownValue(node.value, "errno"));
    if (classification !== undefined) {
      if (node.depth === 0) return classification;
      found.push(classification);
    }
    if (node.depth >= 3) continue;
    queue.push({ value: ownValue(node.value, "cause"), depth: node.depth + 1 });
    const errors = ownValue(node.value, "errors");
    if (Array.isArray(errors)) {
      if (errors.length > 8) truncated = true;
      for (const child of errors.slice(0, 8)) queue.push({ value: child as unknown, depth: node.depth + 1 });
    }
  }
  if (truncated || queue.length > 0 || found.length === 0 || new Set(found.map(item => item.transportCode)).size !== 1) return unknown;
  return Object.freeze({ transportCode: found[0]!.transportCode, sqlstate: new Set(found.map(item => item.sqlstate)).size === 1 ? found[0]!.sqlstate : null });
}

export interface DnsFamilyDiagnostic { readonly dnsIPv4Available: boolean | null; readonly dnsIPv6Available: boolean | null }
export type FamilyLookup = () => Promise<readonly {readonly family: number}[]>;
/** Bounded observation only; never influences connection configuration or authority. */
export async function diagnoseProductionDatabaseDnsFamilies(resolveFamilies: FamilyLookup = () => lookup("db.mfonujjeokvpsfucfxuq.supabase.co", { all: true })): Promise<DnsFamilyDiagnostic> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const records = await Promise.race([Promise.resolve().then(resolveFamilies), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("DNS_DIAGNOSTIC_TIMEOUT")), 1000); })]);
    return Object.freeze({ dnsIPv4Available: records.some(record => record.family === 4), dnsIPv6Available: records.some(record => record.family === 6) });
  } catch { return Object.freeze({ dnsIPv4Available: null, dnsIPv6Available: null }); }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
