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
  /** In the Site's source language; translated like a Module's text. */
  readonly title: string;
  readonly summary: string;
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

/** What a supplier says of its own product. */
export type PhisProductDraft = {
  /** The key half of the id. */
  key: string;
  publisher?: string | null;
  type: string;
  title: string;
  summary: string;
  /** As `PhisProduct.imageAssetId`: refused unless a visitor is served it. Absent: none. */
  imageAssetId?: number | null;
  /** As `PhisProduct.iconAssetId`: refused unless a visitor is served it. Absent: none. */
  iconAssetId?: number | null;
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
  get(input: { id: PhisProductId }): Promise<PhisProduct | null>;
  /**
   * Registers this supplier's product, or changes it. Idempotent on the key: the same draft twice changes
   * nothing. A new product starts as `draft`. On a released product of a publisher, changed terms are
   * held as `pendingTerms`.
   *
   * Refused where `imageAssetId` or `iconAssetId` names an Asset a visitor would not be served: one that
   * is not ready, not delivered publicly, or in neither the Site's Space nor this supplier's own Add-on
   * Space. The message says so without saying whether an Asset of that id exists elsewhere.
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
 * Core's event when a product was registered, changed, released, moved to another state or lost or
 * regained its supplier. It carries no state -- a handler reads the product -- and reaches every enabled
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
 * The manifest is the statement of every field it carries, and of nothing else: it names no picture and no
 * icon, so a sync (enabling the Add-on, reconciling a release) neither sets nor clears `imageAssetId` or
 * `iconAssetId`.
 */
export type PhisAddonProductDescriptor = Omit<PhisProductDraft, "publisher" | "imageAssetId" | "iconAssetId">;
