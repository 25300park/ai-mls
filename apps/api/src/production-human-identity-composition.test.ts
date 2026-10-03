import assert from "node:assert/strict";
import test from "node:test";
import { createAsyncAdministrationBackedAuthorizationService } from "../../../modules/administration/src/live-assignment-adapter.js";
import { AuditLog } from "../../../modules/audit/src/audit-log.js";
import type { TrustedSessionBindingResolver } from "../../../modules/identity/src/session-persistence.js";

import { composeProductionHumanRequestDependencies, currentProductionHumanBindingState } from "./production-human-identity-composition.js";
test("B1 trusted-binding and live authorization dependency contract composes without authenticating or authorizing a user", () => {
  let reads = 0;
  const empty = () => { reads++; return Promise.resolve([]); };
  const absent = () => { reads++; return Promise.resolve(undefined); };
  const authorization = createAsyncAdministrationBackedAuthorizationService({
    roleAssignments: { listBySubject: empty, find: absent, listByScope: empty },
    roles: { find: absent, listByScope: empty },
    proposals: { findById: absent, listPending: empty, listByScope: empty },
    decisions: { list: empty, findById: absent, listByScope: empty },
    auditSink: new AuditLog({ clock: () => new Date(), idFactory: () => "test-only" }), clock: () => new Date("2026-10-03T00:00:00.000Z"), policyVersion: "contract-test",
  });
  const resolver: TrustedSessionBindingResolver = { resolve: () => { throw new Error("no synthetic Session"); } };
  const result = composeProductionHumanRequestDependencies({ trustedBinding: { environment: "PRODUCTION", resolver }, authorization });
  assert.equal(result.bindingResolver, resolver);
  assert.equal(result.authorization, authorization);
  assert.equal(reads, 0);
});
test("B1 missing trusted-binding or authorization dependency and Staging composition fail closed", () => {
  assert.throws(() => composeProductionHumanRequestDependencies({}), /TRUSTED_BINDING_UNCONFIGURED/);
  const resolver = { resolve: () => null };
  assert.throws(() => composeProductionHumanRequestDependencies({ trustedBinding: { environment: "STAGING", resolver } }), /TRUSTED_BINDING_UNCONFIGURED/);
  assert.throws(() => composeProductionHumanRequestDependencies({ trustedBinding: { environment: "PRODUCTION", resolver } }), /LIVE_AUTHORIZATION_UNCONFIGURED/);
  assert.deepEqual(currentProductionHumanBindingState(), {
    authenticationBinding: "BLOCKED_PENDING_R3C3B2", trustedBindingComposition: "BLOCKED_PENDING_R3C3B3",
    humanIdentityAuthorityGate: "BLOCKED", fullProductionStartup: "BLOCKED",
  });
});
