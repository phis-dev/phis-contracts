// Runs against the build: `pnpm test` builds first.
import { test } from "node:test";
import assert from "node:assert/strict";

import { evaluatePhiRuntimeConditionExpression, readPhiRuntimeValueCondition } from "../dist/conditions.js";

const on = (form, condition) => evaluatePhiRuntimeConditionExpression(
  readPhiRuntimeValueCondition({ source: "form", valuePath: "x", ...condition }), { form });

test("a condition compares with a text, a number, a yes or no, or null, the kind included", () => {
  assert.equal(on({ x: 2 }, { operator: "equals", value: 2 }), "matched");
  assert.equal(on({ x: "2" }, { operator: "equals", value: 2 }), "not-matched");
  assert.equal(on({ x: true }, { operator: "equals", value: true }), "matched");
  assert.equal(on({ x: null }, { operator: "equals", value: null }), "matched");
  assert.equal(on({ x: [1, 3] }, { operator: "contains", value: 3 }), "matched");
  assert.equal(on({ x: "abc" }, { operator: "contains", value: "b" }), "matched");
  assert.equal(readPhiRuntimeValueCondition({ source: "form", valuePath: "x", operator: "equals", value: Number.NaN }), null);
  assert.equal(readPhiRuntimeValueCondition({ source: "form", valuePath: "x", operator: "equals", value: {} }), null);
  assert.equal(readPhiRuntimeValueCondition({ source: "form", valuePath: "x", operator: "equals" }), null);
});

test("notEquals holds where the value is not the one named, also where there is none", () => {
  assert.equal(on({ x: "a" }, { operator: "notEquals", value: "b" }), "matched");
  assert.equal(on({ x: "b" }, { operator: "notEquals", value: "b" }), "not-matched");
  assert.equal(on({}, { operator: "notEquals", value: "b" }), "matched");
  assert.equal(on({ x: 1 }, { operator: "notEquals", value: "1" }), "matched");
  assert.equal(readPhiRuntimeValueCondition({ source: "form", valuePath: "x", operator: "notEquals" }), null);
});

test("an empty list is falsy", () => {
  assert.equal(on({ x: [] }, { operator: "truthy" }), "not-matched");
  assert.equal(on({ x: [] }, { operator: "falsy" }), "matched");
  assert.equal(on({ x: ["a"] }, { operator: "truthy" }), "matched");
  assert.equal(on({ x: 0 }, { operator: "falsy" }), "matched");
  assert.equal(on({ x: {} }, { operator: "truthy" }), "matched");
});
