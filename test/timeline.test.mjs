// Runs against the build: `pnpm test` builds first.
import { test } from "node:test";
import assert from "node:assert/strict";

import { PhiTimelineEntryFlag, readPhiTimelineEntries, readPhiTimelineEntry } from "../dist/timeline.js";

test("an entry keeps its Pending bit", () => {
  assert.deepEqual(readPhiTimelineEntry({ key: "a", content: "Building", flags: PhiTimelineEntryFlag.Pending }),
    { key: "a", content: "Building", flags: PhiTimelineEntryFlag.Pending });
});

test("flags 0 or absent is left out", () => {
  assert.deepEqual(readPhiTimelineEntry({ key: "a", content: "Done", flags: 0 }), { key: "a", content: "Done" });
  assert.deepEqual(readPhiTimelineEntry({ key: "a", content: "Done" }), { key: "a", content: "Done" });
});

test("an unknown bit or a flags that is no mask refuses the entry", () => {
  assert.equal(readPhiTimelineEntry({ key: "a", content: "x", flags: 2 }), null);
  assert.equal(readPhiTimelineEntry({ key: "a", content: "x", flags: -1 }), null);
  assert.equal(readPhiTimelineEntry({ key: "a", content: "x", flags: 1.5 }), null);
  assert.equal(readPhiTimelineEntry({ key: "a", content: "x", flags: "1" }), null);
  assert.deepEqual(readPhiTimelineEntries([{ key: "a", content: "x", flags: 4 }, { key: "b", content: "y", flags: 1 }]),
    [{ key: "b", content: "y", flags: 1 }]);
});

test("the old pending key is not read", () => {
  assert.deepEqual(readPhiTimelineEntry({ key: "a", content: "x", pending: true }), { key: "a", content: "x" });
});
