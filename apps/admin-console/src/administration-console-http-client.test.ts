import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { AdministrationConsoleHttpClient } from "./administration-console-http-client.js";

test("F16-PHASE-10 executable Administration HTTP client forwards only the canonical read request", async () => {
  let observed: Readonly<{ method: string; url: string; sessionId: string; requestId: string; body: string }> =
    Object.freeze({ method: "", url: "", sessionId: "", requestId: "", body: "" });
  const server = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => { body += chunk; });
    request.on("end", () => {
      observed = Object.freeze({
        method: request.method ?? "", url: request.url ?? "",
        sessionId: typeof request.headers["x-session-id"] === "string" ? request.headers["x-session-id"] : "",
        requestId: typeof request.headers["x-request-id"] === "string" ? request.headers["x-request-id"] : "",
        body,
      });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ success: true, data: { items: [] } }));
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const client = new AdministrationConsoleHttpClient(`http://127.0.0.1:${address.port}`);

  const result = await client.handle({
    method: "GET", path: "/administration/queries",
    headers: { "x-session-id": "trusted-console-session" },
    query: { tenantId: "tenant-a", correlationId: "correlation-a", operation: "LIST_ROLE_ASSIGNMENTS", scopeType: "TENANT", scopeId: "tenant-a", limit: "100" },
    pathParameters: {}, body: null, requestId: "request-console-phase10",
  });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(observed, {
    method: "GET",
    url: "/administration/queries?correlationId=correlation-a&limit=100&operation=LIST_ROLE_ASSIGNMENTS&scopeId=tenant-a&scopeType=TENANT&tenantId=tenant-a",
    sessionId: "trusted-console-session",
    requestId: "request-console-phase10",
    body: "",
  });
  await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)));
});

test("F16-PHASE-10 Administration HTTP client rejects external origins and mutation-shaped requests", async () => {
  assert.throws(() => new AdministrationConsoleHttpClient("https://example.com"), /CONSOLE_CONFIGURATION_INVALID/u);
  const client = new AdministrationConsoleHttpClient("http://127.0.0.1:4172");
  await assert.rejects(() => client.handle({
    method: "POST", path: "/administration/commands", headers: {}, query: {}, pathParameters: {}, body: {}, requestId: "request-command",
  }), /CONSOLE_ADMINISTRATION_READ_ONLY/u);
});
