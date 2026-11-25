// Runs against the build: `pnpm test` builds first.
import { test } from "node:test";
import assert from "node:assert/strict";

import { PhisProductText, readPhisProductLink, readPhisSitePackageProductProposals } from "../dist/products.js";
import { createPhiPageReference } from "../dist/references.js";

const page = { kind: "page", reference: createPhiPageReference({ kind: "module", ownerModuleId: "@phis/phisys/home", presetKey: "pvai" }) };

test("the link label is the fourth text bit", () => {
  assert.equal(PhisProductText.LinkLabel, 8);
});

test("no link is no issue", () => {
  assert.deepEqual(readPhisProductLink(undefined), { link: null, issue: null });
  assert.deepEqual(readPhisProductLink(null), { link: null, issue: null });
});

test("a Page or an https address, with a trimmed label or none", () => {
  assert.deepEqual(readPhisProductLink({ target: page, label: "  Open  " }), { link: { target: page, label: "Open" }, issue: null });
  assert.deepEqual(readPhisProductLink({ target: { kind: "external", href: "https://apps.apple.com/app/id1" }, label: "" }),
    { link: { target: { kind: "external", href: "https://apps.apple.com/app/id1" } }, issue: null });
});

test("a label without a target is refused", () => {
  assert.equal(readPhisProductLink({ label: "Open" }).link, null);
  assert.match(readPhisProductLink({ label: "Open" }).issue, /without a target/);
  assert.match(readPhisProductLink({ target: null, label: "Open" }).issue, /without a target/);
});

test("any target but a Page or https is refused", () => {
  for (const href of ["http://example.com", "mailto:a@example.com", "#top", "//example.com"]) {
    assert.notEqual(readPhisProductLink({ target: { kind: "external", href } }).issue, null, href);
  }
  assert.notEqual(readPhisProductLink({ target: { kind: "page", reference: "nope" } }).issue, null);
  assert.notEqual(readPhisProductLink({ target: page, label: "x".repeat(81) }).issue, null);
  assert.notEqual(readPhisProductLink({ target: page, newTab: true }).issue, null);
});

test("a Site package proposal carries its link", () => {
  const read = readPhisSitePackageProductProposals("@phis/phisys", {
    products: [{ key: "pvai", title: "PhiVoice AI", link: { target: page, label: "Details" } }],
  });
  assert.deepEqual(read.issues, []);
  assert.deepEqual(read.proposals[0].link, { target: page, label: "Details" });
  const refused = readPhisSitePackageProductProposals("@phis/phisys", { products: [{ key: "pvai", title: "PhiVoice AI", link: { label: "Details" } }] });
  assert.equal(refused.proposals.length, 0);
  assert.match(refused.issues[0], /without a target/);
});
