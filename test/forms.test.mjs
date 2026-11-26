// Runs against the build: `pnpm test` builds first.
import { test } from "node:test";
import assert from "node:assert/strict";

import { parsePhiFormDescriptor } from "../dist/forms.js";

const label = (key, fallback) => ({ kind: "label", key, fallback });
const form = (field) => ({
  schemaVersion: 1,
  key: "message",
  fields: [{ key: "sourceLang", fieldProviderKey: "phis/field-select", ...field }],
});

test("a field with options declares its empty option by a label", () => {
  const [field] = parsePhiFormDescriptor(form({
    optionsProvider: { providerKey: "core/site-locales" },
    emptyOption: { label: label("other", "Other language") },
  })).fields;
  assert.deepEqual(field.emptyOption, { label: label("other", "Other language") });

  const [written] = parsePhiFormDescriptor(form({
    options: [{ value: "de", label: label("de", "Deutsch") }],
    emptyOption: { label: { kind: "literal", value: "None" } },
  })).fields;
  assert.deepEqual(written.emptyOption, { label: { kind: "literal", value: "None" } });
});

test("a field without one says nothing about it", () => {
  const [field] = parsePhiFormDescriptor(form({ options: [{ value: "de", label: label("de", "Deutsch") }] })).fields;
  assert.equal("emptyOption" in field, false);
});

test("an empty option holds no value, needs a label and stands beside options", () => {
  const options = [{ value: "de", label: label("de", "Deutsch") }];
  assert.throws(
    () => parsePhiFormDescriptor(form({ options, emptyOption: { value: "other", label: label("other", "Other") } })),
    /fields\[0\]\.emptyOption holds no value/u,
  );
  assert.throws(
    () => parsePhiFormDescriptor(form({ options, emptyOption: { value: "", label: label("other", "Other") } })),
    /holds no value/u,
  );
  assert.throws(() => parsePhiFormDescriptor(form({ options, emptyOption: {} })), /emptyOption\.label must say/u);
  assert.throws(() => parsePhiFormDescriptor(form({ options, emptyOption: "Other" })), /emptyOption must be an object/u);
  assert.throws(() => parsePhiFormDescriptor(form({ options, emptyOption: [] })), /emptyOption must be an object/u);
  assert.throws(
    () => parsePhiFormDescriptor(form({ options, emptyOption: { label: "Other" } })),
    /emptyOption\.label must be a Form text descriptor/u,
  );
  assert.throws(
    () => parsePhiFormDescriptor(form({ emptyOption: { label: label("other", "Other") } })),
    /emptyOption needs options or an optionsProvider/u,
  );
});

test("a written-out option keeps its separator, and refuses one that is neither before nor after", () => {
  const [field] = parsePhiFormDescriptor(form({
    options: [
      { value: "de", label: label("de", "Deutsch") },
      { value: "custom", label: label("custom", "Custom"), separator: "before" },
    ],
  })).fields;
  assert.deepEqual(field.options.map((option) => option.separator), [undefined, "before"]);
  assert.throws(
    () => parsePhiFormDescriptor(form({ options: [{ value: "de", label: label("de", "Deutsch"), separator: true }] })),
    /fields\[0\]\.options\[0\]\.separator must be "before" or "after"/u,
  );
});

test("a layout states its size as small or medium, and nothing else", () => {
  const sized = (size) => ({ schemaVersion: 1, key: "picker", fields: [], layout: { size } });
  assert.equal(parsePhiFormDescriptor(sized("small")).layout.size, "small");
  assert.equal(parsePhiFormDescriptor(sized("medium")).layout.size, "medium");
  assert.equal("size" in parsePhiFormDescriptor({ schemaVersion: 1, key: "picker", fields: [], layout: {} }).layout, false);
  for (const size of ["large", "", 1, true]) {
    assert.throws(() => parsePhiFormDescriptor(sized(size)), /layout\.size must be "small" or "medium"/u);
  }
});
