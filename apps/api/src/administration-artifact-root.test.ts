import assert from "node:assert/strict";
import test from "node:test";
import {
  composeAdministrationApi015NodeHttpServer as legacyCompose,
  composeProductionAdministrationApi015NodeHttpServer as legacyProductionCompose,
} from "./composition.js";
import {
  composeAdministrationApi015NodeHttpServer as dedicatedCompose,
  composeProductionAdministrationApi015NodeHttpServer as dedicatedProductionCompose,
} from "./administration-production-composition.js";

test("FEAT-024-A preserves existing API-015 exports while exposing a dedicated artifact root", () => {
  assert.equal(legacyCompose, dedicatedCompose);
  assert.equal(legacyProductionCompose, dedicatedProductionCompose);
});
