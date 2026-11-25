import type { PhisAssetChangedEventFacts } from "./assets.js";
import type { PhisEntitlementChangedEventFacts } from "./entitlements.js";
import type { PhisProductChangedEventFacts } from "./products.js";
import type { PhisPaymentChangedEventFacts } from "./payments.js";
import type { PhisUserChangedEventFacts, PhisUserRegisteredEventFacts } from "./users.js";

/**
 * What Core offers, named once so both sides can spell it the same way.
 *
 * An Add-on declares which Core capabilities it needs and which Core-owned service kinds it
 * implements. Those names are an agreement between two artifacts that ship separately, which is
 * exactly what this package is for -- and until they lived here, an Add-on author had to read them out
 * of phi-server, a private application they never receive. The S3 Storage Add-on carried the media
 * storage digest as a copied hex literal for that reason.
 *
 * This list is a promise, not a plan. A capability appears here when Core delivers it, never before:
 * an Add-on that finds a name here must be able to rely on it. `images:v1` (image processing) is therefore
 * absent; reading Media library Assets is `media`. A name may arrive with the contracts release just
 * before the server release that delivers it, when both are rolled out together -- `cdnPublish` and
 * `cdnAdmin` are named here for `@phis/server` 0.8.1, as `users` arrived beside the server release that built it.
 *
 * A name is not always something an Add-on is handed. `authentication` and `cdnAdmin` say what this
 * server does, for a Site Module to bind to; the server keeps the list of the ones it binds to an
 * Add-on's context (`isPhisAddonCapabilityDeliverable` in phis-server), and an Add-on requiring any other
 * is refused before its handler runs.
 *
 * Still no node builtins. The digests are stated rather than derived, so a manifest stays readable
 * without hashing anything -- Core recomputes them and checks, which is where that belongs.
 */

/** The Core capabilities an Add-on may require. */
export const PHIS_CORE_CAPABILITIES = {
  authentication: "@phis/server/authentication:v1",
  /**
   * "May this actor", in all three of its sources: does the row belong to them, what level do they
   * hold in its group, and what may they do on this Site at all. It is spelled out rather than
   * shortened to `auth` because the shortening would sit one letter away from `authentication` and
   * mean the opposite half of the same word.
   */
  authorization: "@phis/server/authorization:v1",
  /** Running the queries the manifest declared against this Add-on's own tables. */
  data: "@phis/server/data:v1",
  threads: "@phis/server/threads:v1",
  resourceLinks: "@phis/server/resource-links:v1",
  support: "@phis/server/support:v1",
  /** Group facts -- which groups exist, who is in them. What follows from them is `authorization`. */
  groups: "@phis/server/groups:v1",
  storage: "@phis/server/storage:v1",
  /**
   * The files a row carries, in the slots its table declared.
   *
   * Separate from `storage` because they answer different questions. `storage` hands out a key space an
   * Add-on manages itself; this hands out places Core knows about, which is what makes the file of a
   * deleted row collectable rather than merely gone from view.
   */
  assets: "@phis/server/assets:v1",
  /** Reading the secrets an operator set for this Add-on, and no others. */
  secrets: "@phis/server/secrets:v1",
  /** Reading what an operator configured for this Add-on on this Site. */
  settings: "@phis/server/settings:v1",
  /** Whether the acting user holds one of this Add-on's own declared roles. */
  roles: "@phis/server/roles:v1",
  payments: "@phis/server/payments:v1",
  paymentNotifications: "@phis/server/payment-notifications:v1",
  /** Writing to a person about an occasion the Add-on declared, with Core owning frame and transport. */
  notifications: "@phis/server/notifications:v1",
  /** Announcing an event this Add-on declared under its own name, for the Add-ons of this Site that listen. */
  events: "@phis/server/events:v1",
  /** Who is entitled to what: read by whoever provides a thing, written by the sources the Site allowed. */
  entitlements: "@phis/server/entitlements:v1",
  /** The Site's products: registered by whoever supplies them, read by whoever sells or shows them. */
  products: "@phis/server/products:v1",
  /** The Site's CDN catalogue, read-only: every file offered under the Site's name, with its public address. */
  cdn: "@phis/server/cdn:v1",
  /**
   * Putting a file into the Site's CDN catalogue from an address Core fetches itself, or recording it as a
   * link (`cdn.ts`, `PhisCdnPublishCapabilityV1`). Separate from `cdn`, so being able to read the catalogue
   * is not being able to publish under the Site's name. Delivered from `@phis/server` 0.8.1 on.
   */
  cdnPublish: "@phis/server/cdn-publish:v1",
  /**
   * Name only, like `authentication`: this server answers the CDN Admin routes (`/api/site/admin/cdn`,
   * the `PhisCdnAdmin*` types of `cdn.ts`), which the Site's CDN Module binds to. Never bound to an
   * Add-on's context; an Add-on requiring it is refused as for `authentication`. Named from
   * `@phis/server` 0.8.1 on.
   */
  cdnAdmin: "@phis/server/cdn-admin:v1",
  /** The Site's Media library, read-only: an Asset by its id, and whether a visitor is served it. */
  media: "@phis/server/media:v1",
  /**
   * Giving up Media library Assets this Add-on used: Core deletes one that nothing references any more.
   * Separate from `media`, so being able to read Assets is not being able to delete them.
   */
  mediaRelease: "@phis/server/media-release:v1",
  /**
   * A person of the Site -- name, e-mail, telephone, the Site's addresses -- as far as the acting person
   * may read them, or as far as the Site's admin granted this Add-on in the background (`users.ts`).
   */
  users: "@phis/server/users:v1",
  /**
   * Words this Add-on keeps -- a listing's hint -- as source texts of the Site's translation store, and
   * read in a reader's language (`translation.ts`, `PhisTranslationsCapabilityV1`).
   */
  translations: "@phis/server/translations:v1",
} as const;

export type PhisCoreCapabilityId =
  (typeof PHIS_CORE_CAPABILITIES)[keyof typeof PHIS_CORE_CAPABILITIES];

/**
 * What Core tells an Add-on about after the fact.
 *
 * An integration that mirrors a conversation cannot wait to be asked: somebody writes a reply here and
 * it has to appear over there, and no request the Add-on serves is involved. Polling would be the
 * alternative, and polling for "did anybody write anything" is the Site-wide read every capability here
 * is shaped to prevent.
 *
 * An event is delivered only to an Add-on linked to the thread it happened in, and a message this same
 * Add-on imported is never announced back to it -- which is what stops a mirror from echoing.
 *
 * The list is short on purpose and grows when an Add-on needs an entry, the way the capability catalogue
 * does. Every event a Site could emit, declared in advance, would be a contract to get wrong.
 */
export const PHIS_ADDON_EVENTS = {
  threadMessageCreated: "thread.message.created",
  threadMessageUpdated: "thread.message.updated",
  threadStatusChanged: "thread.status.changed",
  /** The link itself is gone; what follows from that is the Add-on's own business. */
  threadLinkRemoved: "thread.link.removed",
  paymentChanged: "payment.changed",
  /** A subject's answer for a product may have changed; the handler reads the current one. */
  entitlementChanged: "entitlement.changed",
  /** A product was registered, changed, released or moved to another state; the handler reads it. */
  productChanged: "product.changed",
  /** The files of one of this Add-on's own slots changed; the handler reads the slot. */
  assetChanged: "asset.changed",
  /** A person became a member of the Site; the handler reads what it may through `users:v1`. */
  userRegistered: "user.registered",
  /** Which groups of a person's data changed, never their values; the handler reads them through `users:v1`. */
  userChanged: "user.changed",
} as const;

export type PhisAddonThreadEventId =
  Exclude<(typeof PHIS_ADDON_EVENTS)[keyof typeof PHIS_ADDON_EVENTS], "payment.changed" | "entitlement.changed" | "product.changed" | "asset.changed" | "user.registered" | "user.changed">;

/** The events Core itself emits: the thread events, the Payment event, the entitlement, product and asset events, and the user events. */
export type PhisCoreEventId =
  | PhisAddonThreadEventId
  | PhisPaymentChangedEventFacts["event"]
  | PhisEntitlementChangedEventFacts["event"]
  | PhisProductChangedEventFacts["event"]
  | PhisAssetChangedEventFacts["event"]
  | PhisUserRegisteredEventFacts["event"]
  | PhisUserChangedEventFacts["event"];

/**
 * An event an Add-on emits, named under the Add-on that emits it: `@scope/name:what.happened`.
 *
 * The emitter's own id is the first half, so two Add-ons cannot name the same event and a reader of
 * a manifest sees who announces it without looking anything up. The second half is the Add-on's own
 * word for it, `^[a-z][a-z0-9.-]*$`, the shape Core's own event names have. Core's names stay bare:
 * a bare name is Core's, a prefixed one is an Add-on's, and the two can never be confused.
 */
export type PhisAddonEmittedEventId = `@${string}/${string}:${string}`;

/** Delivered v1 event vocabulary: Core's own events, and what an installed Add-on emits. */
export type PhisAddonEventId = PhisCoreEventId | PhisAddonEmittedEventId;

/**
 * How many Add-ons an event may pass through.
 *
 * An Add-on that emits inside an event handler writes an event with the incoming hop plus one. A
 * handler that answers every event with an event, met by another doing the same, would otherwise
 * write forever; at this depth the emit is refused and logged instead of delivered.
 */
export const PHIS_ADDON_EVENT_MAX_HOPS = 4;

/**
 * The Core-owned service kinds an Add-on may implement.
 *
 * A service kind is not a capability. A capability is something Core offers an Add-on; a service kind
 * is something Core already owns and an Add-on supplies an implementation of -- S3 for Media Storage,
 * LDAP for a Directory. Core keeps selecting the configured implementation itself.
 */
export const PHIS_SERVICE_KINDS = {
  mediaStorage: "@phis/server/service/media-storage",
  payments: "@phis/server/service/payments",
  directory: "@phis/server/service/directory",
  /**
   * Turning text in one language into text in another.
   *
   * A kind rather than a capability for the same reason as the two above: Core owns the question and
   * keeps asking it, and what an implementation talks to -- a vendor, a model on the machine, a
   * catalogue it maintains itself -- is its own business. Several may be installed at once; the
   * operator selects which one an installation uses.
   */
  translation: "@phis/server/service/translation",
  /**
   * Handing a Support ticket's work to a system outside the Site -- an issue tracker, a ticket desk.
   *
   * A kind because Core owns the question: which ticket, which task, what may leave and what comes back.
   * What the implementation talks to is its own business, and several may be installed at once; a
   * Supporter chooses one per forward. The interface is `PhisSupportForwardingAdapterV1` in
   * `@phis/contracts/support`.
   */
  supportForwarding: "@phis/server/service/support-forwarding",
  /**
   * Somewhere other than the Site's own Media library that a file can be taken from -- a stock archive,
   * a DAM.
   *
   * A kind because Core owns the question and what follows from it: the Media picker asks through Core,
   * and what somebody chooses is imported into the Site's library as an ordinary Asset by Core. What the
   * implementation searches and how it signs in is its own business; several may be installed at once,
   * and whoever has the picker open chooses among what they offer. The interface is
   * `PhisMediaSourceAdapterV1` in `@phis/contracts/media-source`.
   */
  mediaSource: "@phis/server/service/media-source",
  /**
   * Signing a person in through a provider Core does not speak itself -- a SAML identity provider, a
   * national eID, a login outside OpenID Connect.
   *
   * **A contract without a Core delivery yet.** The interface is stated
   * (`PhisIdentityProviderAdapterV1` in `@phis/contracts/identity-provider`) so an Add-on can be built
   * against it; Core does not yet resolve, offer or call an implementation, so an installed one signs
   * nobody in until the server release that builds it (phis-server design/IDENTITY_PROVIDERS.md).
   * Google, Apple, GitHub, Microsoft and generic OpenID Connect stay Core's own providers.
   */
  identityProvider: "@phis/server/service/identity-provider",
} as const;

export type PhisServiceKind =
  (typeof PHIS_SERVICE_KINDS)[keyof typeof PHIS_SERVICE_KINDS];

/**
 * The digest of the interface each service kind currently has.
 *
 * An Add-on puts the digest of the interface it was built against into its manifest. Core compares it
 * with what this release offers and refuses the Add-on when they differ -- at install, with the value
 * quoted back, rather than at the first call. Whoever changes the shape of an interface raises its
 * version and replaces the digest here, and every Add-on built against the old one is refused.
 *
 * The digest is `sha256("phi-server-service-kind:<kind>:v<interface version>")`. That recipe is
 * documented for whoever has to produce the next value; nothing needs to run it to read a manifest.
 *
 * **Before the v1 release every version here stays at 1, whatever changes shape.** There is no released
 * Add-on to protect and nothing in the field built against an older interface, so raising a version buys
 * no compatibility and costs the installation: the recorded manifest of every installed Add-on stops
 * matching, `buildPhisCapabilitySnapshot` refuses the desired state, and every request that resolves a
 * viewer answers 500 until each Add-on has been rebundled and upgraded. An interface that changes before
 * v1 is simply the interface, and both sides are rebuilt from one tree.
 */
export const PHIS_SERVICE_INTERFACE_VERSIONS: Readonly<Record<PhisServiceKind, number>> = {
  [PHIS_SERVICE_KINDS.mediaStorage]: 1,
  [PHIS_SERVICE_KINDS.payments]: 1,
  [PHIS_SERVICE_KINDS.directory]: 1,
  [PHIS_SERVICE_KINDS.translation]: 1,
  [PHIS_SERVICE_KINDS.supportForwarding]: 1,
  [PHIS_SERVICE_KINDS.mediaSource]: 1,
  [PHIS_SERVICE_KINDS.identityProvider]: 1,
};

export const PHIS_SERVICE_INTERFACE_DIGESTS: Readonly<Record<PhisServiceKind, string>> = {
  [PHIS_SERVICE_KINDS.payments]:
    "6b106818d5edbfeddd484e9f571509695a1a8dbb5b82435338a094216410fcf7",
  [PHIS_SERVICE_KINDS.mediaStorage]:
    "45a871522511f7d77841ca8dd0113b423b3cfd4cb921f143cd1d3d116cab6952",
  [PHIS_SERVICE_KINDS.directory]:
    "2cac7397c7beb1b8e71fc67f5cae3be89182dddf096895570a15deafa1adbfc9",
  [PHIS_SERVICE_KINDS.translation]:
    "9bae2e7b92ded5cdde9321939a3bb8cd589f6e1ef8bca7bc5f65608313b3207d",
  [PHIS_SERVICE_KINDS.supportForwarding]:
    "e9d01711a5ebdfa37ea4c6828952c87935b6e755b98ab8e69cc397933dfbed6f",
  [PHIS_SERVICE_KINDS.mediaSource]:
    "252af23499cf2c3ed0ee0ae36d3f50a13eae920c5125d0fadbdb14cf3c490c88",
  [PHIS_SERVICE_KINDS.identityProvider]:
    "38807b1dbef2bf6deea31d9eb78c5ccbbcc508b402493044832ba06df79f3aa9",
};
