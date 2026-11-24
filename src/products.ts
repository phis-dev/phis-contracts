/**
 * Products: what a Site has that somebody can hold (`products:v1`).
 *
 * A product in Core is an identity: that it exists, who supplies it, in what state it is. It is the
 * thing an entitlement entry names, so "this account holds this product" needs no mapping kept anywhere.
 * How it is sold -- a price, a period, a category, stock -- is a seller's listing, and a seller may keep
 * several for one product. How it is delivered -- a key, a file, a version -- is its supplier's.
 *
 * Three kinds of Add-on meet here without knowing each other: a supplier registers products and delivers
 * them, a seller reads them and sells them, a showcase reads them and shows them.
 */

/**
 * A product, named under the Add-on that supplies it: `@scope/name:key`.
 *
 * The supplier's id is the first half, so two Add-ons cannot name the same product. The key is
 * `^[a-z][a-z0-9.-]*$`, at most 96 characters, chosen by the supplier and never reused for something else.
 */
export type PhisProductId = `@${string}/${string}:${string}`;

/**
 * `draft`: not yet to be had. `active`: can be acquired. `withdrawn`: no longer acquired, and whoever
 * holds it keeps it as it was. `locked`: no longer acquired, and no entry for it counts while it is
 * locked -- the Site operator's alone, for a product that must not be used.
 *
 * A product somebody ever acquired is never deleted; it changes state.
 */
export type PhisProductState = "draft" | "active" | "withdrawn" | "locked";

/**
 * Who sells it. `own`: the Site, through its seller. `referral`: its publisher, at an address of their
 * own -- no seller of the Site lists it and nothing is recorded here unless the publisher reports it.
 * `payout`: the Site, which owes the publisher a share.
 */
export type PhisProductSale = "own" | "referral" | "payout";

/** What needs the Site operator's release on a publisher's product, the first time and on every change. */
export type PhisProductReleasedTerms = {
  readonly sale: PhisProductSale;
  readonly referralUrl: string | null;
  readonly free: boolean;
  /**
   * Whether it can only be acquired with an account -- a licence, a subscription -- or by a guest as
   * well. The supplier knows, and a seller's checkout asks for the sign-in where a product says so.
   */
  readonly accountRequired: boolean;
  /** A bundle's parts. Whoever holds the bundle holds each of them (`entitlements:v1` resolves it). */
  readonly parts: readonly PhisProductId[];
};

export type PhisProduct = PhisProductReleasedTerms & {
  readonly id: PhisProductId;
  /** The Add-on that registered it and delivers it. */
  readonly supplier: string;
  /** Whether that Add-on is enabled for the Site. Where it is not, nobody delivers and the state is `withdrawn`. */
  readonly supplied: boolean;
  /** The supplier's reference for whose product it is; opaque to Core. Null: the Site's own. */
  readonly publisher: string | null;
  /** The supplier's own word for what it is (`addon`, `download`, `plan`). Core keeps no list of them. */
  readonly type: string;
  /**
   * The name, as the supplier wrote it in the Site's source language -- or, read with a `locale`
   * (`PhisProductListInput.locale`), in that language.
   *
   * Title, summary and description are source texts of the Site's translation store, each under the
   * product's own context (`product <n> title`, `... summary`, `... description`, `<n>` Core's number for
   * the product), recorded by Core whenever the supplier registers the product: Editor > Translations lists
   * them, a translator translates them there, and a change of the text is a new message whose old
   * translation goes with the old text.
   */
  readonly title: string;
  /**
   * The short text, as `title`: the source text, or with a `locale` its translation. Empty for none. Read in
   * a language nobody translated it into yet, title and summary are asked of the Site's translation provider
   * once and the answer kept, as a Widget's words are.
   */
  readonly summary: string;
  /**
   * The long description, as Markdown, as `title`: the source text, or with a `locale` the translation a
   * person wrote under Editor > Translations (or imported), the source text where nobody did -- a Markdown
   * document is never handed to a provider whole. Empty for none. What a product page shows under its
   * heading -- a seller shows the product's, it keeps none of its own. At most `PHIS_PRODUCT_DESCRIPTION_MAX`
   * characters.
   */
  readonly description: string;
  /**
   * The picture, as a Media Asset id -- what `assets:v1` answers as `mediaAssetId` for a file in one of
   * the supplier's slots, or an Asset of the Site's Media library.
   *
   * Only an Asset a visitor is served is accepted: it is ready, delivered publicly, and lies in the
   * Site's Space or in the registering supplier's own Add-on Space. An Asset of a User's or a Group's
   * Space, or of another Add-on's, is refused. A manifest names no picture, so a sync of the declared
   * products leaves the one that is set alone.
   */
  readonly imageAssetId: number | null;
  /**
   * Where the picture is served from, Site-relative, as Core addresses its own Media; null without one.
   * Read at the moment it is used and never stored, for the reason `PhisAddonAssetView.contentPath` gives.
   */
  readonly imagePath: string | null;
  /**
   * The icon, a small picture (a logo, an app icon) shown beside the title on the product's page, as a
   * Media Asset id. Accepted under exactly the rules of `imageAssetId`: only an Asset a visitor is served,
   * in the Site's Space or the registering supplier's own Add-on Space. A manifest names no icon either,
   * so a sync of the declared products leaves the one that is set alone.
   */
  readonly iconAssetId: number | null;
  /** Where the icon is served from, as `imagePath` is for the picture; null without one. */
  readonly iconPath: string | null;
  /**
   * The picture as a list or a table shows it: the Media library's `icon` variant (64 x 64, fitted whole
   * on a transparent ground, `PhiImageAssetVariantKey.Icon`), Site-relative and cache-safe (it carries
   * the Asset's revision). Null without a picture or where the picture is not an image. Read at the
   * moment it is used and never stored, as `imagePath`.
   */
  readonly imageListPath: string | null;
  /** The icon as a list or a table shows it, as `imageListPath` is for the picture; null without one. */
  readonly iconListPath: string | null;
  /**
   * Further pictures, first to last, beside `imageAssetId`: what a product page shows as its gallery. Each is
   * accepted under exactly the rules of `imageAssetId` -- only an Asset a visitor is served, in the Site's
   * Space or the registering supplier's own Add-on Space -- so every `path` here is a public address a
   * seller may hand on (a storefront elsewhere, a feed). An Asset deleted from the Media library leaves the
   * gallery; the Media library refuses to delete one a product still shows, as it does for the picture. At
   * most `PHIS_PRODUCT_GALLERY_MAX`. A manifest names no gallery, so a sync of the declared products leaves
   * the one that is set alone.
   */
  readonly gallery: readonly PhisProductGalleryPicture[];
  /** Whether holding it has a quantity that adds up (seats, hours) or is yes or no. */
  readonly counted: boolean;
  readonly state: PhisProductState;
  /**
   * A publisher's product can be `active` only once the Site operator released it; the Site's own
   * (`publisher` null) needs no release and is always `true` here.
   */
  readonly released: boolean;
  /**
   * What the publisher asked to change of the released terms and the operator has not released yet. The
   * terms above stay in force until then. Title, summary, picture and icon change at once.
   */
  readonly pendingTerms: PhisProductReleasedTerms | null;
  /**
   * What other Add-ons attached, keyed by the Add-on that wrote it: a mark, a rating, a category of a
   * showcase. Display and filtering data, never authority.
   */
  readonly attributes: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** One picture of a product's gallery (`PhisProduct.gallery`). */
export type PhisProductGalleryPicture = {
  /** The Media Asset id, as `PhisProduct.imageAssetId` is for the picture. */
  readonly assetId: number;
  /**
   * Where it is served from, Site-relative and cache-safe (it carries the Asset's revision), as
   * `imagePath`; read at the moment it is used and never stored. It changes when the picture does, and a
   * change of the gallery owes `product.changed`, so a seller that copied the addresses elsewhere copies
   * them again.
   */
  readonly path: string;
  /** The picture as a list shows it small, as `imageListPath`; null where it is not an image. */
  readonly listPath: string | null;
};

/** The longest description Core keeps, in characters. */
export const PHIS_PRODUCT_DESCRIPTION_MAX = 20000;
/** The most pictures a product's gallery holds. */
export const PHIS_PRODUCT_GALLERY_MAX = 20;

/** What a supplier says of its own product. */
export type PhisProductDraft = {
  /** The key half of the id. */
  key: string;
  publisher?: string | null;
  type: string;
  title: string;
  summary: string;
  /** Markdown, as `PhisProduct.description`. Absent: none. */
  description?: string;
  /** As `PhisProduct.imageAssetId`: refused unless a visitor is served it. Absent: none. */
  imageAssetId?: number | null;
  /** As `PhisProduct.iconAssetId`: refused unless a visitor is served it. Absent: none. */
  iconAssetId?: number | null;
  /**
   * The gallery's Media Asset ids, first to last, as `PhisProduct.gallery`: each refused unless a visitor is
   * served it, none twice, at most `PHIS_PRODUCT_GALLERY_MAX`. Absent: none.
   */
  gallery?: readonly number[];
  /** Fixed once somebody holds the product. */
  counted?: boolean;
  /** Absent: `own`. */
  sale?: PhisProductSale;
  referralUrl?: string | null;
  free?: boolean;
  /** Absent: false. */
  accountRequired?: boolean;
  parts?: readonly PhisProductId[];
};

export type PhisProductListInput = {
  /** Exactly these, at most 200, in whatever state unless `states` says otherwise -- a seller's listings. */
  ids?: readonly PhisProductId[];
  supplier?: string;
  publisher?: string;
  type?: string;
  /** Absent: `active` only; with `ids`, absent means every state. */
  states?: readonly PhisProductState[];
  /** Absent: both. `false` is what an operator's release list asks for. */
  released?: boolean;
  cursor?: string | null;
  /** At most 200; absent: 50. */
  limit?: number;
  /**
   * The language to answer `title`, `summary` and `description` in -- a reader's, `PhisAddonRequestContext.locale`
   * of the request a catalogue answers. Null or absent: the texts as the supplier wrote them, in the Site's
   * source language, which is what a supplier reads to write its product back and what a seller copies into
   * an order. A language the Site does not translate into is answered the source texts.
   */
  locale?: string | null;
};

/**
 * `products:v1`.
 *
 * Reading is open to every Add-on that requires the capability. A supplier writes its own products and
 * nobody else's: another supplier's product is not found, never refused. Any Add-on writes its own
 * entry of a product's attributes. Releasing, locking, and withdrawing somebody else's product are the
 * Site operator's and not here.
 *
 * An unverified hook -- a public read point, where nobody is signed in -- reads `active` products and
 * nothing else: `get` answers null for a product in any other state, `list` answers active ones whatever
 * `states` asks for, and `pendingTerms` is null there. It writes nothing. A catalogue is public; what is
 * not yet or no longer in it is not. Attributes are therefore public as well, and an Add-on puts nothing
 * there that is not.
 */
export type PhisProductsCapabilityV1 = {
  list(input?: PhisProductListInput): Promise<{ products: readonly PhisProduct[]; nextCursor: string | null }>;
  /** One product; `locale` as `PhisProductListInput.locale`. */
  get(input: { id: PhisProductId; locale?: string | null }): Promise<PhisProduct | null>;
  /**
   * Registers this supplier's product, or changes it. Idempotent on the key: the same draft twice changes
   * nothing. A new product starts as `draft`. On a released product of a publisher, changed terms are
   * held as `pendingTerms`. Title, summary and description are recorded as the Site's source texts in the
   * same transaction (`PhisProduct.title`), and the answer is in the source language.
   *
   * Refused where `imageAssetId`, `iconAssetId` or an entry of `gallery` names an Asset a visitor would not
   * be served: one that is not ready, not delivered publicly, or in neither the Site's Space nor this
   * supplier's own Add-on Space. The message says so without saying whether an Asset of that id exists
   * elsewhere. A change of the description or of the gallery -- its pictures or their order -- is a change
   * like any other: it raises the version and owes `product.changed`.
   */
  register(input: PhisProductDraft): Promise<PhisProduct>;
  /**
   * Moves this supplier's own product between `draft`, `active` and `withdrawn`. `active` is refused for
   * a publisher's product that is not released, and every move is refused on a locked one. Null where it
   * has none by that key.
   */
  setState(input: { key: string; state: "draft" | "active" | "withdrawn" }): Promise<PhisProduct | null>;
  /** Removes this supplier's own product that nobody ever acquired. False where somebody did, or it has none. */
  remove(input: { key: string }): Promise<boolean>;
  /** Writes the calling Add-on's own attributes of a product, whole; null takes them away. */
  annotate(input: { id: PhisProductId; data: Readonly<Record<string, unknown>> | null }): Promise<PhisProduct | null>;
};

/**
 * Core's event when a product was registered, changed (its description and its gallery included), released,
 * moved to another state or lost or regained its supplier. It carries no state -- a handler reads the product -- and reaches every enabled
 * Add-on of the Site that declares a handler for it. A seller takes a product out of sale on it.
 */
export type PhisProductChangedEventFacts = {
  event: "product.changed";
  subject: { kind: "product"; productId: PhisProductId };
};

/**
 * A product a package carries, declared in its manifest and registered when the Add-on is enabled for a
 * Site. What an Add-on makes at runtime it registers through the capability.
 *
 * The manifest is the statement of every field it carries, and of nothing else: it names no picture, no
 * icon and no gallery, so a sync (enabling the Add-on, reconciling a release) neither sets nor clears
 * `imageAssetId`, `iconAssetId` or `gallery`. It may carry a `description`, which it then states as every
 * other text: absent is none.
 */
export type PhisAddonProductDescriptor = Omit<PhisProductDraft, "publisher" | "imageAssetId" | "iconAssetId" | "gallery">;

/**
 * Who makes the products a Site package proposes: `@phis/products`, the supplier of the Site's own
 * products made by hand, through its command `product.add`. Core names it rather than looking for a
 * supplier, because a proposal is a product the Site will keep as its own -- edited, withdrawn or removed
 * on the Products page like any other -- and that is the one supplier whose products those are.
 */
export const PHIS_SITE_PACKAGE_PRODUCT_SUPPLIER = {
  addonId: "@phis/products",
  command: "product.add",
} as const;

/** What a proposed product is besides its texts, as bits (`PhisSitePackageProductProposal.flags`). */
export const PhisSitePackageProductFlag = {
  /** Holding it has a quantity that adds up (seats, hours): `product.add`'s `counted`. */
  Counted: 1 << 0,
  /** It can only be acquired with an account: `product.add`'s `accountRequired`. */
  AccountRequired: 1 << 1,
} as const;

/** Every bit `PhisSitePackageProductFlag` names. */
export const PHIS_SITE_PACKAGE_PRODUCT_FLAG_MASK =
  PhisSitePackageProductFlag.Counted | PhisSitePackageProductFlag.AccountRequired;

/** A proposal's own key: a lower-case word, or words joined by dashes, at most 48 characters. */
export const PHIS_SITE_PACKAGE_PRODUCT_KEY_PATTERN = /^[a-z][a-z0-9-]*$/;
export const PHIS_SITE_PACKAGE_PRODUCT_KEY_MAX = 48;
/** The product's kind (`product.add`'s `kind`, Core's `type`), as `@phis/products` takes it. */
export const PHIS_SITE_PACKAGE_PRODUCT_KIND_PATTERN = /^[a-z][a-z0-9-]*$/;
export const PHIS_SITE_PACKAGE_PRODUCT_KIND_MAX = 64;
/** As Core keeps them (`phis.products`: `VARCHAR(200)`, `VARCHAR(1000)`). */
export const PHIS_SITE_PACKAGE_PRODUCT_TITLE_MAX = 200;
export const PHIS_SITE_PACKAGE_PRODUCT_SUMMARY_MAX = 1000;
/** As Core keeps it (`PHIS_PRODUCT_DESCRIPTION_MAX`). */
export const PHIS_SITE_PACKAGE_PRODUCT_DESCRIPTION_MAX = PHIS_PRODUCT_DESCRIPTION_MAX;
/** As a product's gallery holds them (`PHIS_PRODUCT_GALLERY_MAX`). */
export const PHIS_SITE_PACKAGE_PRODUCT_GALLERY_MAX = PHIS_PRODUCT_GALLERY_MAX;
/** A product key in Core (`^[a-z][a-z0-9.-]*$`, at most 96 characters). */
const PHIS_PRODUCT_KEY_PATTERN = /^[a-z][a-z0-9.-]*$/;
const PHIS_PRODUCT_KEY_MAX = 96;
/** A package name, or each half of a scoped one, that can stand in a product key. */
const PHIS_SITE_PACKAGE_NAME_PART_PATTERN = /^[a-z][a-z0-9-]*$/;

/**
 * A product a Site package proposes, under `phis.products` in its `package.json`.
 *
 * What `@phis/products`' `product.add` takes, and nothing else: a Site package proposes products the Site
 * then owns, so it can say what a person on the Products page could say. Core makes each one once per Site
 * (`phis module products sync`), keyed by the package and this key, and never again: a product the Site
 * already had under the key, or changed or removed since, is left as it is. Title, summary and description
 * are in the package's `sourceLocale`.
 *
 * Core takes them when a Site Admin activates the package in the Builder (publishes an Area's Module
 * selection that holds one of its Modules), as that admin, and with `phis module products sync --as`.
 */
export type PhisSitePackageProductProposal = {
  /** The package's own name for it, unique in the package; the product's key is derived from it (`phisSitePackageProductKey`). */
  key: string;
  title: string;
  /** Absent: none. */
  summary?: string;
  /** Markdown, at most `PHIS_SITE_PACKAGE_PRODUCT_DESCRIPTION_MAX` characters. Absent: none. */
  description?: string;
  /** Absent: `@phis/products`' default, `product`. */
  kind?: string;
  /** Absent: `draft`, as `product.add` makes it. */
  state?: "draft" | "active";
  /** `PhisSitePackageProductFlag`. Absent: none. */
  flags?: number;
  /** The key of one of this package's own Media files (`phis.media.files[].key`), imported into the Site's Media library. */
  picture?: string;
  /** As `picture`, for the small picture beside the title. */
  icon?: string;
  /**
   * The gallery, first to last: keys of this package's own Media files as `picture` is, none twice, at most
   * `PHIS_SITE_PACKAGE_PRODUCT_GALLERY_MAX`. Core takes the proposal only once every one of them is in the
   * Site's Media library. Absent: none.
   */
  gallery?: string[];
};

/**
 * The key a proposal's product has at the Site: the package name's parts and the proposal's key, joined by
 * dots -- `@phis/phisys` and `phivoice-ai` are `phis.phisys.phivoice-ai`, the product
 * `@phis/products:phis.phisys.phivoice-ai`. Two packages cannot collide, because neither the parts nor the
 * key may hold a dot. Null where the package name cannot stand in a key (a dot, an underscore, a leading
 * digit) or the whole is longer than Core keeps.
 */
export function phisSitePackageProductKey(packageName: string, key: string): string | null {
  const parts = packageName.startsWith("@") ? packageName.slice(1).split("/") : [packageName];
  if (
    parts.length > 2 ||
    parts.some((part) => !PHIS_SITE_PACKAGE_NAME_PART_PATTERN.test(part)) ||
    !PHIS_SITE_PACKAGE_PRODUCT_KEY_PATTERN.test(key) ||
    key.length > PHIS_SITE_PACKAGE_PRODUCT_KEY_MAX
  ) {
    return null;
  }
  const productKey = [...parts, key].join(".");
  return productKey.length <= PHIS_PRODUCT_KEY_MAX && PHIS_PRODUCT_KEY_PATTERN.test(productKey) ? productKey : null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const PROPOSAL_FIELDS = ["key", "title", "summary", "description", "kind", "state", "flags", "picture", "icon", "gallery"] as const;

/**
 * Reads one proposal, reporting into `report(where, message)`. `mediaFileKeys` are the keys of the
 * package's `phis.media.files` a `picture` or `icon` must name; null where the caller does not hold the
 * package (Core, which is handed one proposal), and then they need only be a key.
 */
function readProposal(
  packageName: string,
  entry: unknown,
  where: string,
  mediaFileKeys: ReadonlySet<string> | null,
  report: (where: string, message: string) => void,
): PhisSitePackageProductProposal | null {
  if (!isPlainRecord(entry)) {
    report(where, "must be an object");
    return null;
  }
  let valid = true;
  const fault = (at: string, message: string) => {
    valid = false;
    report(at, message);
  };
  for (const name of Object.keys(entry)) {
    if (!(PROPOSAL_FIELDS as readonly string[]).includes(name)) fault(where, `unknown property "${name}"`);
  }
  const key = entry.key;
  if (typeof key !== "string" || key.length > PHIS_SITE_PACKAGE_PRODUCT_KEY_MAX || !PHIS_SITE_PACKAGE_PRODUCT_KEY_PATTERN.test(key)) {
    report(where, `key ${JSON.stringify(key)} must be 1 to ${PHIS_SITE_PACKAGE_PRODUCT_KEY_MAX} lowercase letters, digits or hyphens, starting with a letter`);
    return null;
  }
  const at = `${where} (key "${key}")`;
  if (phisSitePackageProductKey(packageName, key) === null) {
    fault(at, `the product key cannot be made from the package name: each part of it must be lowercase letters, digits or hyphens, starting with a letter, and the whole at most ${PHIS_PRODUCT_KEY_MAX} characters`);
  }
  const text = (name: "title" | "summary" | "description", max: number, required: boolean) => {
    const value = entry[name];
    if (value === undefined && !required) return undefined;
    if (typeof value !== "string" || value.trim() === "" || value.trim().length > max) {
      fault(at, `\`${name}\` must be ${required ? "a" : "an optional"} non-empty string of at most ${max} characters`);
      return undefined;
    }
    return value.trim();
  };
  const title = text("title", PHIS_SITE_PACKAGE_PRODUCT_TITLE_MAX, true);
  const summary = text("summary", PHIS_SITE_PACKAGE_PRODUCT_SUMMARY_MAX, false);
  const description = text("description", PHIS_SITE_PACKAGE_PRODUCT_DESCRIPTION_MAX, false);
  const kind = entry.kind;
  if (kind !== undefined && (typeof kind !== "string" || kind.length > PHIS_SITE_PACKAGE_PRODUCT_KIND_MAX || !PHIS_SITE_PACKAGE_PRODUCT_KIND_PATTERN.test(kind))) {
    fault(at, `\`kind\` must be a lower-case word, or words joined by dashes, of at most ${PHIS_SITE_PACKAGE_PRODUCT_KIND_MAX} characters`);
  }
  const state = entry.state;
  if (state !== undefined && state !== "draft" && state !== "active") fault(at, "`state` must be draft or active");
  const flags = entry.flags;
  if (flags !== undefined && (!Number.isSafeInteger(flags) || (flags as number) < 0 || ((flags as number) & ~PHIS_SITE_PACKAGE_PRODUCT_FLAG_MASK) !== 0)) {
    fault(at, "`flags` must be a sum of PhisSitePackageProductFlag bits (Counted 1, AccountRequired 2)");
  }
  const isMediaKey = (value: unknown) =>
    typeof value === "string" && (mediaFileKeys ? mediaFileKeys.has(value) : /^[a-z0-9][a-z0-9-]*$/.test(value));
  for (const name of ["picture", "icon"] as const) {
    const value = entry[name];
    if (value === undefined) continue;
    if (!isMediaKey(value)) fault(at, `\`${name}\` ${JSON.stringify(value)} must be the key of one of this package's phis.media.files`);
  }
  const gallery = entry.gallery;
  if (gallery !== undefined) {
    if (!Array.isArray(gallery) || gallery.length > PHIS_SITE_PACKAGE_PRODUCT_GALLERY_MAX) {
      fault(at, `\`gallery\` must be a list of at most ${PHIS_SITE_PACKAGE_PRODUCT_GALLERY_MAX} keys of this package's phis.media.files`);
    } else {
      for (const value of gallery) {
        if (!isMediaKey(value)) fault(at, `\`gallery\` entry ${JSON.stringify(value)} must be the key of one of this package's phis.media.files`);
      }
      if (new Set(gallery).size !== gallery.length) fault(at, "`gallery` names a Media file twice");
    }
  }
  if (!valid || title === undefined) return null;
  return {
    key,
    title,
    ...(summary !== undefined ? { summary } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(typeof kind === "string" ? { kind } : {}),
    ...(state === "draft" || state === "active" ? { state } : {}),
    ...(typeof flags === "number" && flags !== 0 ? { flags } : {}),
    ...(typeof entry.picture === "string" ? { picture: entry.picture } : {}),
    ...(typeof entry.icon === "string" ? { icon: entry.icon } : {}),
    ...(Array.isArray(gallery) && gallery.length > 0 ? { gallery: [...gallery] as string[] } : {}),
  };
}

/**
 * Reads `phis.products` of one package's `phis` block and reports every violation, each with the package
 * and the key it is about.
 *
 * Strict, as `phis.media` is read: an unknown property, a wrong type, a key that is not one or comes twice,
 * a package name that cannot stand in a product key, flags this release does not name, and a `picture`,
 * `icon` or `gallery` entry that is no key of the package's `phis.media.files` (or one the gallery names twice). `proposals` is empty when the package
 * proposes nothing or proposes wrongly; `issues` says which.
 */
export function readPhisSitePackageProductProposals(
  packageName: string,
  phisBlock: unknown,
): { proposals: PhisSitePackageProductProposal[]; issues: string[] } {
  const issues: string[] = [];
  const report = (where: string, message: string) => issues.push(`${packageName}: ${where}: ${message}`);
  if (!isPlainRecord(phisBlock) || phisBlock.products === undefined) return { proposals: [], issues };
  if (!Array.isArray(phisBlock.products)) {
    report("phis.products", "must be an array");
    return { proposals: [], issues };
  }
  const media = isPlainRecord(phisBlock.media) && Array.isArray(phisBlock.media.files) ? phisBlock.media.files : [];
  const mediaFileKeys = new Set(media.flatMap((file) =>
    isPlainRecord(file) && typeof file.key === "string" ? [file.key] : []));
  const seen = new Set<string>();
  const proposals: PhisSitePackageProductProposal[] = [];
  phisBlock.products.forEach((entry: unknown, index: number) => {
    const where = `phis.products[${index}]`;
    const proposal = readProposal(packageName, entry, where, mediaFileKeys, report);
    if (!proposal) return;
    if (seen.has(proposal.key)) {
      report(`${where} (key "${proposal.key}")`, "key is already used by another product of this package");
      return;
    }
    seen.add(proposal.key);
    proposals.push(proposal);
  });
  return issues.length > 0 ? { proposals: [], issues } : { proposals, issues };
}

/**
 * One proposal as Core is handed it, without the package around it: the same rules, except that a
 * `picture`, `icon` or `gallery` entry need only be a Media key -- whether the package declares it is the sender's to
 * check, and whether the Site holds it is Core's.
 */
export function readPhisSitePackageProductProposal(
  packageName: string,
  value: unknown,
): { proposal: PhisSitePackageProductProposal | null; issues: string[] } {
  const issues: string[] = [];
  const proposal = readProposal(packageName, value, "proposal", null, (where, message) =>
    issues.push(`${packageName}: ${where}: ${message}`));
  return { proposal: issues.length > 0 ? null : proposal, issues };
}
