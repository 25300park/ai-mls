import assert from "node:assert/strict";
import test from "node:test";

import { createDevelopmentConsoleSessionAdapter } from "./development-session.js";

const base = Object.freeze({
  enabled: true,
  runtimeEnvironment: "DEVELOPMENT" as const,
  sessionId: "console-development-session",
  principalId: "console-development-operator",
  tenantId: "team-a",
  now: () => new Date("2026-08-13T00:00:00.000Z"),
});

test("POST-F15-CONSOLE development Session requires explicit non-production enablement", () => {
  assert.throws(
    () => createDevelopmentConsoleSessionAdapter({ ...base, runtimeEnvironment: "PRODUCTION" }),
    /DEVELOPMENT_SESSION_FORBIDDEN/u,
  );
  assert.throws(
    () => createDevelopmentConsoleSessionAdapter({ ...base, enabled: false }),
    /DEVELOPMENT_SESSION_DISABLED/u,
  );
});

test("POST-F15-CONSOLE development Session resolves one immutable scoped actor and fails closed otherwise", () => {
  const adapter = createDevelopmentConsoleSessionAdapter(base);
  const session = adapter.resolve(base.sessionId);

  assert.notEqual(session, undefined);
  assert.equal(adapter.resolve("caller-controlled-session"), undefined);
  assert.deepEqual(session, {
    id: "console-development-session",
    principalId: "console-development-operator",
    principalType: "HUMAN",
    roles: ["OPS", "SEC"],
    teamId: "team-a",
    state: "ACTIVE",
    assurance: "MFA",
    isMfaVerified: true,
    authenticatedAt: "2026-08-13T00:00:00.000Z",
    expiresAt: "2026-08-13T08:00:00.000Z",
    absoluteExpiresAt: "2026-08-13T08:00:00.000Z",
    familyId: "console-development-family",
    refreshReference: "console-development-no-refresh",
  });
  assert.equal(Object.isFrozen(session), true);
  assert.equal(Object.isFrozen(session?.roles), true);
});
