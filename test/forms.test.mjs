// Runs against the build: `pnpm test` builds first.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PHI_FORM_RESPONSIVE_MODES,
  parsePhiFormDescriptor,
  resolvePhiFormLayout,
  resolvePhiFormResponsiveValue,
  statedPhiFormGridRange,
  toPhiSlug,
} from "../dist/forms.js";

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

test("a slug writes German letters out, drops every other mark and joins the rest with single hyphens", () => {
  assert.equal(toPhiSlug("Größe & Übermaß"), "groesse-uebermass");
  assert.equal(toPhiSlug("ÄÖÜ äöü ẞ"), "aeoeue-aeoeue-ss");
  assert.equal(toPhiSlug("Crème brûlée, façon Noël"), "creme-brulee-facon-noel");
  // A decomposed ä is still an ä.
  assert.equal(toPhiSlug("Käse"), "kaese");
  assert.equal(toPhiSlug("  --Hello,   World!--  "), "hello-world");
  assert.equal(toPhiSlug("Kapitel Ⅻ"), "kapitel-xii");
  assert.equal(toPhiSlug("PhiVoice AI 2"), "phivoice-ai-2");
  assert.equal(toPhiSlug("日本語"), "");
  assert.equal(toPhiSlug(""), "");
});

const derived = (derive, from = {}) => ({
  schemaVersion: 1,
  key: "product",
  fields: [
    { key: "title", fieldProviderKey: "phis/field-text", ...from },
    { key: "slug", fieldProviderKey: "phis/field-text", derive },
  ],
});

test("a field derives its value from another field of the Form", () => {
  const [, slug] = parsePhiFormDescriptor(derived({ from: "title", source: "value", transform: "slug" })).fields;
  assert.deepEqual(slug.derive, { from: "title", source: "value", transform: "slug" });
  const [, fromOption] = parsePhiFormDescriptor(derived(
    { from: "title", source: "optionLabel", transform: "slug" },
    { optionsProvider: { providerKey: "core/site-locales" } },
  )).fields;
  assert.equal(fromOption.derive.source, "optionLabel");
  const [title] = parsePhiFormDescriptor(derived(undefined)).fields;
  assert.equal("derive" in title, false);
});

test("a derived field reads another field that derives nothing, and an option label only where there are options", () => {
  assert.throws(() => parsePhiFormDescriptor(derived({ from: "name", source: "value", transform: "slug" })), /fields\[1\]\.derive\.from names "name", which is no other field/u);
  assert.throws(() => parsePhiFormDescriptor(derived({ from: "slug", source: "value", transform: "slug" })), /no other field/u);
  assert.throws(
    () => parsePhiFormDescriptor(derived({ from: "title", source: "value", transform: "slug" }, { derive: { from: "slug", source: "value", transform: "slug" } })),
    /derives its own value/u,
  );
  assert.throws(() => parsePhiFormDescriptor(derived({ from: "title", source: "optionLabel", transform: "slug" })), /offers no options/u);
  assert.throws(() => parsePhiFormDescriptor(derived({ from: "title", source: "label", transform: "slug" })), /derive\.source must be "value" or "optionLabel"/u);
  assert.throws(() => parsePhiFormDescriptor(derived({ from: "title", source: "value", transform: "kebab" })), /derive\.transform must be "slug"/u);
  assert.throws(() => parsePhiFormDescriptor(derived({ from: "", source: "value", transform: "slug" })), /derive\.from must be a non-empty string/u);
  assert.throws(() => parsePhiFormDescriptor(derived("title")), /derive must be an object/u);
});

test("a fourth width, spacious, follows wide until it is stated", () => {
  const resolved = resolvePhiFormLayout(undefined);
  assert.deepEqual(resolved.label.spacious, resolved.label.wide);
  assert.deepEqual(resolved.control.spacious, resolved.control.wide);
  assert.equal(resolved.gap.spacious, resolved.gap.wide);
  assert.equal(resolved.columnGap.spacious, resolved.gap.wide);
  assert.deepEqual(PHI_FORM_RESPONSIVE_MODES, ["compact", "medium", "wide", "spacious"]);

  const stated = parsePhiFormDescriptor({
    schemaVersion: 1,
    key: "wide",
    fields: [{ key: "a", fieldProviderKey: "phis/field-text", placement: { control: { spacious: { start: 1, end: 13 } } } }],
    layout: { gap: { wide: "lg", spacious: "xl" }, label: { spacious: { start: 1, end: 7 } }, control: { spacious: { start: 7, end: 25 } } },
  });
  const layout = resolvePhiFormLayout(stated.layout);
  assert.deepEqual(layout.label.spacious, { start: 1, end: 7 });
  assert.deepEqual(layout.label.wide, { start: 1, end: 9 });
  assert.equal(layout.gap.wide, "lg");
  assert.equal(layout.gap.spacious, "xl");
  assert.equal(resolvePhiFormLayout({ gap: { medium: "lg" } }).gap.spacious, "lg");
  assert.deepEqual(statedPhiFormGridRange(stated.fields[0].placement.control, "spacious"), { start: 1, end: 13 });
  assert.equal(statedPhiFormGridRange(stated.fields[0].placement.control, "wide"), undefined);
  assert.deepEqual(statedPhiFormGridRange({ wide: { start: 1, end: 13 } }, "spacious"), { start: 1, end: 13 });
  assert.deepEqual(resolvePhiFormResponsiveValue({ compact: 1 }, { compact: 0, medium: 0, wide: 0, spacious: 0 }), { compact: 1, medium: 1, wide: 1, spacious: 1 });
  assert.throws(
    () => parsePhiFormDescriptor({ schemaVersion: 1, key: "x", fields: [], layout: { gap: { spacious: "huge" } } }),
    /layout\.gap\.spacious must be a Phi spacing token/u,
  );
  assert.throws(
    () => parsePhiFormDescriptor({ schemaVersion: 1, key: "x", fields: [], layout: { label: { spacious: { start: 9, end: 3 } } } }),
    /layout\.label\.spacious\.end must be greater/u,
  );
});
