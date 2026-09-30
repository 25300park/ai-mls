import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryPublicationUnitOfWork } from "./publication-unit-of-work.js";

test("REL002 R3-B2 exposes one Promise-based Publication transaction contract for Local/Test", async () => {
  const unitOfWork = new InMemoryPublicationUnitOfWork();
  const pendingTransaction = unitOfWork.begin({ tenantScopeId: "tenant-r3b2", publicationId: "publication-r3b2" });

  assert.equal(isPromise(pendingTransaction), true);
  const transaction = await pendingTransaction;
  const pendingLookup = transaction.repository.find({ tenantScopeId: "tenant-r3b2", publicationId: "publication-r3b2" });
  assert.equal(isPromise(pendingLookup), true);
  assert.equal(await pendingLookup, undefined);
  const pendingRollback = transaction.rollback();
  assert.equal(isPromise(pendingRollback), true);
  await pendingRollback;
});

function isPromise(value: unknown): value is Promise<unknown> {
  return value instanceof Promise;
}
