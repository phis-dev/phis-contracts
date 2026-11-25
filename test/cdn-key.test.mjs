// Runs against the build: `pnpm test` builds first.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PHIS_CDN_FILE_ARCH_MASK,
  PHIS_CDN_FILE_OS_MASK,
  PHIS_CDN_KEY_SEGMENT_PATTERN,
  PHIS_CDN_KEY_VERSION_PATTERN,
  PhisCdnFileArch,
  PhisCdnFileOs,
} from "../dist/cdn.js";

const segment = (value) => PHIS_CDN_KEY_SEGMENT_PATTERN.test(value);
const version = (value) => PHIS_CDN_KEY_VERSION_PATTERN.test(value);

test("a Debian prerelease is a version, and its file a file name", () => {
  assert.equal(version("1.0.0~beta.1-1"), true);
  assert.equal(segment("1.0.0~beta.1-1"), true);
  assert.equal(segment("phis_1.0.0~beta.1-1+noble_amd64.deb"), true);
});

test("an epoch is a version and nothing else", () => {
  assert.equal(version("1:2.0-1"), true);
  assert.equal(segment("1:2.0-1"), false);
  assert.equal(segment("phis_1:2.0-1_amd64.deb"), false);
  assert.equal(segment("na:me"), false);
});

test("what was taken before is still taken", () => {
  for (const value of ["phis", "0.4.9-1+trixie", "phis_0.4.9-1+trixie_amd64.deb", "a", "_x", "+x", "-x"]) {
    assert.equal(segment(value), true, value);
    assert.equal(version(value), true, value);
  }
});

test("a slash, a leading tilde, dot or colon, and an empty segment are refused", () => {
  for (const value of ["a/b", "1.0/1", "~beta", ".hidden", ":1", ""]) {
    assert.equal(segment(value), false, value);
    assert.equal(version(value), false, value);
  }
});

test("a segment is at most 200 characters", () => {
  assert.equal(segment("a".repeat(200)), true);
  assert.equal(segment("a".repeat(201)), false);
  assert.equal(version("1".repeat(200)), true);
  assert.equal(version("1".repeat(201)), false);
});

test("the platform bits start at bit 0 and the masks hold every named bit", () => {
  assert.equal(PhisCdnFileOs.Linux, 1);
  assert.equal(PhisCdnFileArch.X64, 1);
  assert.equal(Object.values(PhisCdnFileOs).reduce((all, bit) => all | bit, 0), PHIS_CDN_FILE_OS_MASK);
  assert.equal(Object.values(PhisCdnFileArch).reduce((all, bit) => all | bit, 0), PHIS_CDN_FILE_ARCH_MASK);
  assert.ok(PHIS_CDN_FILE_OS_MASK < 1 << 8 && PHIS_CDN_FILE_ARCH_MASK < 1 << 8);
});
