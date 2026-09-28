/**
 * What one side of the house means when it points at a Page: `@phis/server/references:v1`.
 *
 * The codec stood in two copies, in phis-ui and in phi-server, for the same reason the CMS instance id
 * did before it moved here -- and with the same risk, which is that two sides agreeing byte for byte is
 * a thing nobody notices stopping. It is one file now.
 *
 * **A reference is short because a Page already has a name.** It used to be base64-encoded JSON carrying
 * the whole identity, which for a Module Page ran to 98 characters in every Markdown body that linked to
 * one. The envelope was never protection -- it is encoding, not a signature, and the server revalidates
 * Site and Area regardless -- so what it actually bought was a payload the server could unpack. It no
 * longer needs to: a Module Page is named by the CMS Page id derived from `(ownerModuleId, presetKey)`,
 * which is recomputable rather than allocated and therefore stands before any row does.
 *
 * The two variants are shaped differently on purpose. A Site Page carries its Page Scope id as a plain
 * number because the server writes that number into a foreign key with `ON DELETE RESTRICT`: the
 * database itself refuses to delete a Page something still points at, and nothing derived could take
 * that column's place. A Module Page has no row to point a foreign key at -- the Site may never have
 * touched it -- so it carries the derived id, which the server passes on without ever unpacking.
 */

import {
  createPhiPresetCmsInstanceId,
  isPhiCmsAreaKey,
  readPhiCmsInstanceIdDescriptor,
  type PhiCmsAreaKey,
  type PhiCmsInstanceId,
} from "./cms.js";

export const PHIS_INTERNAL_PAGE_SCHEME = "phis:page/" as const;
export const PHIS_INTERNAL_ASSET_SCHEME = "phis:asset/" as const;

/** The Page itself, not a node inside it -- the one place a Page id differs from a node id. */
const PHI_CMS_PAGE_NODE_KEY = "page";

const PHI_PAGE_REFERENCE_VERSION = "v1";
const PHI_PAGE_REFERENCE_SITE_TAG = "s";
const PHI_PAGE_REFERENCE_MODULE_TAG = "p";
const PHI_MODULE_ID_PATTERN = /^@[^/]+\/[^/]+(?:\/[^/]+)*$/;
const PHI_PAGE_SCOPE_ID_PATTERN = /^[1-9]\d*$/u;

/**
 * A Module Page's identity, hashed to one token both sides can recompute.
 *
 * Recomputable rather than allocated, so no row has to exist before the Page can be addressed, and it
 * never mentions the path: reassigning where a Page answers leaves everything pointing at it alone.
 */
export function createPhiPresetCmsPageId(
  identity: { ownerModuleId: string; presetKey: string },
): PhiCmsInstanceId {
  return createPhiPresetCmsInstanceId({
    ...identity,
    domain: "page",
    nodeKey: PHI_CMS_PAGE_NODE_KEY,
  });
}

/** What a reference says, once read. A Module Page answers with its id, never with what was hashed. */
export type PhiPageTarget =
  | { kind: "site"; pageScopeId: number }
  | { kind: "module"; pageId: PhiCmsInstanceId };

/** What a reference is made from. The Module variant differs: the identity goes in, the id comes out. */
export type PhiPageTargetInput =
  | { kind: "site"; pageScopeId: number }
  | { kind: "module"; ownerModuleId: string; presetKey: string };

export type PhiPageReference = string & { readonly __phiPageReference: unique symbol };

export type PhiInternalReference =
  | { kind: "page"; reference: PhiPageReference; target: PhiPageTarget; fragment: string | null }
  | { kind: "asset"; assetId: number };

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function readPresetPageId(value: string): PhiCmsInstanceId | null {
  const descriptor = readPhiCmsInstanceIdDescriptor(value);
  return descriptor?.origin === "preset" && descriptor.domain === "page"
    ? value as PhiCmsInstanceId
    : null;
}

export function createPhiPageReference(target: PhiPageTargetInput): PhiPageReference {
  if (target.kind === "site") {
    if (!isPositiveInteger(target.pageScopeId)) {
      throw new Error("Phi Page Scope ids must be positive integers.");
    }
    return `${PHI_PAGE_REFERENCE_VERSION}${PHI_PAGE_REFERENCE_SITE_TAG}${target.pageScopeId}` as PhiPageReference;
  }
  /*
   * Checked here rather than left to the hash. A malformed owner id hashes perfectly well and produces
   * a reference that resolves to nothing, for a reason nobody can read back out of it -- the one real
   * cost of a one-way id, paid once at the only place that can still see what went in.
   */
  if (!PHI_MODULE_ID_PATTERN.test(target.ownerModuleId.trim())) {
    throw new Error("Invalid Phi Module id.");
  }
  const pageId = createPhiPresetCmsPageId({
    ownerModuleId: target.ownerModuleId,
    presetKey: target.presetKey,
  });
  return `${PHI_PAGE_REFERENCE_VERSION}${PHI_PAGE_REFERENCE_MODULE_TAG}${pageId}` as PhiPageReference;
}

export function readPhiPageReference(
  value: unknown,
): { reference: PhiPageReference; target: PhiPageTarget } | null {
  if (typeof value !== "string" || !value.startsWith(PHI_PAGE_REFERENCE_VERSION)) {
    return null;
  }
  const tag = value.slice(PHI_PAGE_REFERENCE_VERSION.length, PHI_PAGE_REFERENCE_VERSION.length + 1);
  const body = value.slice(PHI_PAGE_REFERENCE_VERSION.length + 1);
  if (tag === PHI_PAGE_REFERENCE_SITE_TAG) {
    const pageScopeId = PHI_PAGE_SCOPE_ID_PATTERN.test(body) ? Number(body) : NaN;
    return isPositiveInteger(pageScopeId)
      ? { reference: value as PhiPageReference, target: { kind: "site", pageScopeId } }
      : null;
  }
  if (tag === PHI_PAGE_REFERENCE_MODULE_TAG) {
    const pageId = readPresetPageId(body);
    return pageId
      ? { reference: value as PhiPageReference, target: { kind: "module", pageId } }
      : null;
  }
  return null;
}

export function createPhiPageUri(reference: PhiPageReference, fragment?: string | null) {
  if (!readPhiPageReference(reference)) {
    throw new Error("Invalid Phi Page reference.");
  }
  const normalizedFragment = fragment?.replace(/^#/u, "").trim();
  return `${PHIS_INTERNAL_PAGE_SCHEME}${reference}${normalizedFragment ? `#${encodeURIComponent(normalizedFragment)}` : ""}`;
}

export function createPhiAssetUri(assetId: number) {
  if (!isPositiveInteger(assetId)) {
    throw new Error("Phi Asset ids must be positive integers.");
  }
  return `${PHIS_INTERNAL_ASSET_SCHEME}${assetId}`;
}

export function readPhiInternalReference(value: unknown): PhiInternalReference | null {
  if (typeof value !== "string") {
    return null;
  }
  if (value.startsWith(PHIS_INTERNAL_ASSET_SCHEME)) {
    const id = value.slice(PHIS_INTERNAL_ASSET_SCHEME.length);
    return /^[1-9]\d*$/u.test(id) && Number.isSafeInteger(Number(id))
      ? { kind: "asset", assetId: Number(id) }
      : null;
  }
  if (!value.startsWith(PHIS_INTERNAL_PAGE_SCHEME)) {
    return null;
  }
  const [encodedReference, ...fragmentParts] = value.slice(PHIS_INTERNAL_PAGE_SCHEME.length).split("#");
  const parsed = readPhiPageReference(encodedReference);
  if (!parsed) {
    return null;
  }
  try {
    const fragment = fragmentParts.length > 0 ? decodeURIComponent(fragmentParts.join("#")) : null;
    return { kind: "page", ...parsed, fragment };
  } catch {
    return null;
  }
}

/**
 * Where a Control that offers one link leads.
 *
 * Two kinds and no third. A Page is named by its reference, which is identity and outlives the path
 * moving under it; everything else is a literal URL somebody typed. What this refuses is the middle --
 * the root-relative string that reads as external and means internal -- because that is the shape that
 * rots in silence: the Page moves, the string does not, and nothing in the system ever knew the two were
 * related.
 *
 * `newTab` sits inside the target rather than beside it. A Widget that offers two links -- a Card with a
 * heading and an action -- otherwise grows one flag per link and names them in parallel (`newTab`,
 * `actionNewTab`, and a third the day a third link lands). That is one decision written twice, and it
 * drifts the first time only one of the two is read.
 */
export type PhiLinkTarget =
  | {
      kind: "page";
      reference: PhiPageReference;
      /**
       * Which Area to resolve the reference in, where it is not the one asking.
       *
       * A reference names a Page and not where to look for it: the Area is resolution context, supplied
       * by whoever asks. Every asker supplied its own, so a link out of one Area into another resolved
       * to nothing -- the Navigation source tree let an author pick a Page from another Area, the drop
       * kept it, and the table then showed it as unresolvable.
       *
       * Absent means the asking Area, which is nearly every link, so nothing is stored for the ordinary
       * case. Present, it does not make the reference mean something else; it says where the question
       * goes. Whether the reader may follow it is still the target Area's own answer.
       */
      area?: PhiCmsAreaKey;
      fragment?: string | null;
      newTab?: boolean;
    }
  | { kind: "external"; href: string; newTab?: boolean };

/**
 * The field names a stored link target may stand under, and nothing else identifies one in persisted
 * config.
 *
 * The Asset rule is the precedent and the reason: the server's reference collector reads persisted JSON,
 * not the Widget catalogue, so it cannot ask a plugin which of its fields hold targets. A Widget that
 * keeps one under another name authors a reference the delete guard cannot see, and the Page it points
 * at can be removed while the Widget still draws a link to it.
 *
 * One plain name for the single-link case and a suffix for the rest, so a Card's second link is
 * `actionLinkTarget` and is found by the same rule that finds the first.
 */
export const PHI_LINK_TARGET_CONFIG_KEY = "linkTarget";
const PHI_LINK_TARGET_CONFIG_KEY_SUFFIX = "LinkTarget";

export function isPhiLinkTargetConfigKey(key: string) {
  return key === PHI_LINK_TARGET_CONFIG_KEY
    || (key.endsWith(PHI_LINK_TARGET_CONFIG_KEY_SUFFIX) && key.length > PHI_LINK_TARGET_CONFIG_KEY_SUFFIX.length);
}

/**
 * Whether a string may be kept as an external target.
 *
 * Absolute, or an anchor on the document the reader already has. Everything else is refused, and the
 * refusal is the whole point rather than strictness for its own sake: a stored `/pricing` is a Page link
 * that has thrown its identity away, and one of them is enough to give the Site a second internal format
 * -- one the resolver cannot resolve, the index cannot see, and the delete guard cannot warn about.
 *
 * The reserved scheme is rejected here in its plain form only. Normalising the encodings it can hide in
 * belongs to the server's sanitizer, which sees the whole document; this is the near guard, so a target
 * never carries an unresolved `phis:` URI in the field where a literal URL belongs.
 */
const PHI_STORABLE_EXTERNAL_HREF_PATTERN = /^(?:https?:\/\/|\/\/|mailto:|tel:|#)/iu;

export function isPhiStorableExternalHref(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0
    && !trimmed.toLowerCase().startsWith("phis:")
    && PHI_STORABLE_EXTERNAL_HREF_PATTERN.test(trimmed);
}

/**
 * A stored link target, read back under the contract rather than trusted.
 *
 * Anything that is not one of the two shapes answers `null`, and a Control that gets `null` draws no
 * link at all. That is the same answer the contract gives for a Page reference that no longer resolves:
 * non-interactive text beats a link that goes somewhere nobody chose.
 */
export function readPhiLinkTarget(value: unknown): PhiLinkTarget | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const newTab = record.newTab === true ? { newTab: true as const } : {};
  if (record.kind === "page") {
    const parsed = readPhiPageReference(record.reference);
    if (!parsed) {
      return null;
    }
    const fragment = typeof record.fragment === "string" ? record.fragment.replace(/^#/u, "").trim() : "";
    /*
     * An Area that is not one is dropped rather than kept: the alternative is a stored value that asks
     * a question nowhere can answer, and a link drawing nothing with no way to see why. Falling back to
     * the asking Area is the behaviour of every link that names none, which is the honest default.
     */
    const area = isPhiCmsAreaKey(record.area) ? { area: record.area } : {};
    return {
      kind: "page",
      reference: parsed.reference,
      ...area,
      ...(fragment ? { fragment } : {}),
      ...newTab,
    };
  }
  if (record.kind === "external") {
    const href = typeof record.href === "string" ? record.href.trim() : "";
    return isPhiStorableExternalHref(href) ? { kind: "external", href, ...newTab } : null;
  }
  return null;
}
