/**
 * The numbers a CMS row carries, in the one reading both sides must give them.
 *
 * A status, a Region type, a visibility mask and a flag set are written by the site UI, checked and
 * stored by phi-server, and read back by both -- as columns, as fields of a write payload, and as
 * values inside a stored tree. They are the same kind of agreement as the identity below and were
 * kept the same way the arithmetic was: two files, identical line for line, in two repositories.
 *
 * The visibility mask is the one that shows what that costs. Its bits are not dense -- public 1,
 * app 2, admin 8, editor 16, accounting 64, builder 256 -- so a side that renumbered them would not
 * fail anything loudly. It would store a Page in a different Area than the other side reads it from,
 * and every row would look correct where it was written.
 */

export const PhiCmsPageType = {
  Standard: 0,
  Landing: 1,
  Legal: 2,
  System: 3,
  Redirect: 4,
} as const;

export const PhiCmsStatus = {
  Draft: 0,
  Published: 1,
  Archived: 2,
  Deleted: 3,
} as const;

export const PhiCmsRegionStatus = {
  Draft: 0,
  Active: 1,
  Disabled: 2,
} as const;

/** Numbered with room between the groups, so a Region can be added beside its neighbours. */
export const PhiCmsRegionType = {
  HeaderTop: 10,
  HeaderMain: 11,
  HeaderBottom: 12,
  SiderLeft: 20,
  SiderRight: 21,
  Hero: 25,
  Content: 30,
  FooterTop: 39,
  Footer: 40,
  FooterBottom: 41,
  Drawer: 50,
} as const;

export type PhiCmsRegionTypeValue =
  (typeof PhiCmsRegionType)[keyof typeof PhiCmsRegionType];

/**
 * Which Areas a row is visible in, as one value per Area rather than a running number.
 *
 * Bits 2, 5 and 7 are unassigned. That is what makes the numbers worth stating once: 8 reads like the
 * fourth Area and is the third, and phi-server stores it as `area_id` where nothing spells it out.
 */
export const PhiCmsVisibilityContext = {
  PublicArea: 1 << 0,
  AppArea: 1 << 1,
  AdminArea: 1 << 3,
  EditorArea: 1 << 4,
  AccountingArea: 1 << 6,
  BuilderArea: 1 << 8,
} as const;

/**
 * The flags a CMS row carries, in the one numbering both sides read them from.
 *
 * Not every flag reaches every kind of row -- `Collapsed` is a Region's answer and `MobileOnly` a
 * renderable's -- but they share one space, because a row is stored as a row whatever it holds.
 *
 * `NoIndex` is a Page's, and it is the Site's answer rather than the preset's: a Module states what a
 * Page it ships starts out as, and the Builder's switch is what decides from then on. That is why it
 * lives here, on the record, and not on the route descriptor -- a descriptor is read fresh on every
 * request and would overrule the Operator on every one of them.
 */
export const PhiCmsFlags = {
  SiteCustom: 1 << 0,
  Hidden: 1 << 1,
  MobileOnly: 1 << 2,
  DesktopOnly: 1 << 3,
  Collapsed: 1 << 4,
  NoTranslate: 1 << 5,
  NoIndex: 1 << 6,
} as const;

export const PhiCmsRevisionFlags = {
  Draft: 1 << 0,
  Published: 1 << 1,
  Deleted: 1 << 2,
} as const;

export const DEFAULT_PHI_CMS_VISIBILITY_MASK = PhiCmsVisibilityContext.PublicArea;

/**
 * The identity a CMS node carries, in the one encoding both sides must compute alike.
 *
 * A node id is not allocated, it is derived: a Preset node's id is a hash of the Module, the preset
 * and the node key, so the same node has the same id before any row exists and after every
 * republish. The site UI derives it to address blocks and Pages; phi-server derives it to check that
 * stored wiring points at nodes that are really there, and to write Page identities of its own.
 *
 * Which is why this cannot be two implementations agreeing by inspection -- and it was exactly that:
 * `hashPresetIdentity` stood twice, line for line, in `@phis/ui` and in phi-server. The two had to
 * produce identical bytes forever, and a changed constant on one side would not have failed
 * anything loudly. It would have given one process a different Page identity than the other, and
 * Pages would have stopped resolving with nothing to point at.
 *
 * That makes it the exception this package's rule allows for. Everywhere else the rule is shape here,
 * membership with whoever holds the registry; here there is no shape to check, only an arithmetic --
 * and the reason it belongs here is precisely that the arithmetic must be one.
 */

const PHI_CMS_INSTANCE_ID_BYTE_LENGTH = 12;
const PHI_CMS_INSTANCE_ID_ENCODED_LENGTH = 16;
const PHI_CMS_INSTANCE_ID_VERSION = 1;
const PHI_CMS_INSTANCE_ID_ORIGIN_PRESET = 1;
const PHI_CMS_INSTANCE_ID_ORIGIN_DRAFT = 2;
const PHI_CMS_INSTANCE_ID_VERSION_SHIFT = 4;
const PHI_CMS_INSTANCE_ID_ORIGIN_MASK = 0x0f;
const PHI_CMS_INSTANCE_ID_PATTERN = /^[A-Za-z0-9_-]{16}$/;
const PHI_CMS_BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const PHI_CMS_MAX_DRAFT_REVISION_ID = 0xffff_ffff_ffff;
const PHI_CMS_MAX_DRAFT_SEQUENCE = 0xffff_ffff;

declare const PHI_CMS_INSTANCE_ID_BRAND: unique symbol;

export type PhiCmsInstanceId = string & {
  readonly [PHI_CMS_INSTANCE_ID_BRAND]: "PhiCmsInstanceId";
};

export type PhiCmsInstanceOrigin = "preset" | "draft";
export type PhiCmsInstanceDomain = "area" | "page" | "navigation";

const PHI_CMS_INSTANCE_DOMAIN_CODES = {
  area: 1,
  page: 2,
  navigation: 3,
} as const satisfies Record<PhiCmsInstanceDomain, number>;

const PHI_CMS_INSTANCE_DOMAINS_BY_CODE = new Map<number, PhiCmsInstanceDomain>(
  Object.entries(PHI_CMS_INSTANCE_DOMAIN_CODES).map(([domain, code]) => [
    code,
    domain as PhiCmsInstanceDomain,
  ]),
);

export type PhiCmsInstanceIdDescriptor =
  | {
      version: 1;
      origin: "preset";
      domain: PhiCmsInstanceDomain;
    }
  | {
      version: 1;
      origin: "draft";
      domain: PhiCmsInstanceDomain;
      draftRevisionId: number;
      sequence: number;
    };

export type PhiCmsPresetInstanceIdentity = {
  domain: PhiCmsInstanceDomain;
  ownerModuleId: string;
  presetKey: string;
  nodeKey: string;
};

function encodeBase64Url(bytes: Uint8Array) {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    output += PHI_CMS_BASE64URL_ALPHABET[first >>> 2];
    output += PHI_CMS_BASE64URL_ALPHABET[((first & 0x03) << 4) | (second >>> 4)];
    output += PHI_CMS_BASE64URL_ALPHABET[((second & 0x0f) << 2) | (third >>> 6)];
    output += PHI_CMS_BASE64URL_ALPHABET[third & 0x3f];
  }
  return output;
}

function decodeBase64Url(value: string) {
  if (!PHI_CMS_INSTANCE_ID_PATTERN.test(value)) {
    return null;
  }

  const bytes = new Uint8Array(PHI_CMS_INSTANCE_ID_BYTE_LENGTH);
  for (let index = 0; index < value.length; index += 4) {
    const first = PHI_CMS_BASE64URL_ALPHABET.indexOf(value[index]!);
    const second = PHI_CMS_BASE64URL_ALPHABET.indexOf(value[index + 1]!);
    const third = PHI_CMS_BASE64URL_ALPHABET.indexOf(value[index + 2]!);
    const fourth = PHI_CMS_BASE64URL_ALPHABET.indexOf(value[index + 3]!);
    if (first < 0 || second < 0 || third < 0 || fourth < 0) {
      return null;
    }
    const byteIndex = (index / 4) * 3;
    bytes[byteIndex] = (first << 2) | (second >>> 4);
    bytes[byteIndex + 1] = ((second & 0x0f) << 4) | (third >>> 2);
    bytes[byteIndex + 2] = ((third & 0x03) << 6) | fourth;
  }
  return bytes;
}

function createHeader(origin: number) {
  return (PHI_CMS_INSTANCE_ID_VERSION << PHI_CMS_INSTANCE_ID_VERSION_SHIFT) | origin;
}

function readHeader(bytes: Uint8Array) {
  const version = bytes[0]! >>> PHI_CMS_INSTANCE_ID_VERSION_SHIFT;
  const origin = bytes[0]! & PHI_CMS_INSTANCE_ID_ORIGIN_MASK;
  return { version, origin };
}

function assertSafeIntegerInRange(value: number, min: number, max: number, label: string) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be a safe integer from ${min} through ${max}.`);
  }
}

function writeUnsignedBigEndian(bytes: Uint8Array, offset: number, length: number, value: number) {
  let remaining = value;
  for (let index = offset + length - 1; index >= offset; index -= 1) {
    bytes[index] = remaining % 256;
    remaining = Math.floor(remaining / 256);
  }
}

function readUnsignedBigEndian(bytes: Uint8Array, offset: number, length: number) {
  let value = 0;
  for (let index = offset; index < offset + length; index += 1) {
    value = (value * 256) + bytes[index]!;
  }
  return value;
}

function normalizeIdentityPart(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} must not be empty.`);
  }
  return normalized;
}

function hashPresetIdentity(value: string) {
  const bytes = new TextEncoder().encode(value);
  const state = new Uint32Array([0x811c9dc5, 0x9e3779b9, 0x85ebca6b]);
  const primes = [0x01000193, 0x27d4eb2d, 0x165667b1] as const;

  for (const byte of bytes) {
    for (let index = 0; index < state.length; index += 1) {
      state[index] = Math.imul(state[index]! ^ (byte + index * 17), primes[index]!) >>> 0;
      state[index] = state[index]! ^ (state[index]! >>> 13);
    }
  }

  const result = new Uint8Array(10);
  for (let index = 0; index < result.length; index += 1) {
    const lane = index % state.length;
    state[lane] = Math.imul(state[lane]! ^ (index + bytes.length), primes[lane]!) >>> 0;
    result[index] = state[lane]! >>> ((index % 4) * 8);
  }
  return result;
}

export function createPhiDraftCmsInstanceId({
  domain,
  draftRevisionId,
  sequence,
}: {
  domain: PhiCmsInstanceDomain;
  draftRevisionId: number;
  sequence: number;
}): PhiCmsInstanceId {
  assertSafeIntegerInRange(draftRevisionId, 1, PHI_CMS_MAX_DRAFT_REVISION_ID, "Draft revision id");
  assertSafeIntegerInRange(sequence, 1, PHI_CMS_MAX_DRAFT_SEQUENCE, "Draft node sequence");

  const bytes = new Uint8Array(PHI_CMS_INSTANCE_ID_BYTE_LENGTH);
  bytes[0] = createHeader(PHI_CMS_INSTANCE_ID_ORIGIN_DRAFT);
  bytes[1] = PHI_CMS_INSTANCE_DOMAIN_CODES[domain];
  writeUnsignedBigEndian(bytes, 2, 6, draftRevisionId);
  writeUnsignedBigEndian(bytes, 8, 4, sequence);
  return encodeBase64Url(bytes) as PhiCmsInstanceId;
}

export function createPhiPresetCmsInstanceId({
  domain,
  ownerModuleId,
  presetKey,
  nodeKey,
}: PhiCmsPresetInstanceIdentity): PhiCmsInstanceId {
  const identity = [
    `v${PHI_CMS_INSTANCE_ID_VERSION}`,
    domain,
    normalizeIdentityPart(ownerModuleId, "Preset owner module id"),
    normalizeIdentityPart(presetKey, "Preset key"),
    normalizeIdentityPart(nodeKey, "Preset node key"),
  ].join("\u001f");
  const bytes = new Uint8Array(PHI_CMS_INSTANCE_ID_BYTE_LENGTH);
  bytes[0] = createHeader(PHI_CMS_INSTANCE_ID_ORIGIN_PRESET);
  bytes[1] = PHI_CMS_INSTANCE_DOMAIN_CODES[domain];
  bytes.set(hashPresetIdentity(identity), 2);
  return encodeBase64Url(bytes) as PhiCmsInstanceId;
}

export function readPhiCmsInstanceIdDescriptor(value: unknown): PhiCmsInstanceIdDescriptor | null {
  if (typeof value !== "string" || value.length !== PHI_CMS_INSTANCE_ID_ENCODED_LENGTH) {
    return null;
  }
  const bytes = decodeBase64Url(value);
  if (!bytes) {
    return null;
  }
  const header = readHeader(bytes);
  if (header.version !== PHI_CMS_INSTANCE_ID_VERSION) {
    return null;
  }
  const domain = PHI_CMS_INSTANCE_DOMAINS_BY_CODE.get(bytes[1]!);
  if (!domain) {
    return null;
  }
  if (header.origin === PHI_CMS_INSTANCE_ID_ORIGIN_PRESET) {
    return { version: 1, origin: "preset", domain };
  }
  if (header.origin !== PHI_CMS_INSTANCE_ID_ORIGIN_DRAFT) {
    return null;
  }
  const draftRevisionId = readUnsignedBigEndian(bytes, 2, 6);
  const sequence = readUnsignedBigEndian(bytes, 8, 4);
  if (draftRevisionId < 1 || sequence < 1) {
    return null;
  }
  return { version: 1, origin: "draft", domain, draftRevisionId, sequence };
}

export function isPhiCmsInstanceId(value: unknown): value is PhiCmsInstanceId {
  return readPhiCmsInstanceIdDescriptor(value) !== null;
}

export function readPhiCmsInstanceId(value: unknown): PhiCmsInstanceId | null {
  return isPhiCmsInstanceId(value) ? value : null;
}

export function comparePhiCmsInstanceIds(left: PhiCmsInstanceId, right: PhiCmsInstanceId) {
  return left === right ? 0 : left < right ? -1 : 1;
}
