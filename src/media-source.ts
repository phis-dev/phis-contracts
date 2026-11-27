import type { PhisSecretsCapabilityV1, PhisSettingsCapabilityV1 } from "./capabilities.js";
import type { PhiMediaKind } from "./media.js";

/**
 * Media sources: somewhere other than the Site's own library that a file can be taken from -- a stock
 * archive, a DAM, a brand portal.
 *
 * **A source is listed, and what is chosen from it is imported.** The Media picker shows a source beside
 * the Site's library; choosing one of its items brings the file into the Site's Media library as an
 * ordinary Asset, and what a field, a Widget or a Theme stores is that Asset's id. Nothing ever stores a
 * reference into a source: a Site must not lose a picture because a subscription ended or an archive
 * renamed its ids, and everything downstream -- variants, focal rectangle, delivery, quota -- works on
 * Assets and on nothing else.
 *
 * **One list contract, two kinds of supplier.** A source answers `PhisMediaSourceListInput` with a
 * `PhisMediaSourcePage`, whoever supplies it:
 *
 * - an Add-on, through the service kind `@phis/server/service/media-source`
 *   (`PhisMediaSourceAdapterV1`). Core asks it on the picker's behalf, and Core imports what is chosen;
 * - a Module of the Site's build, in the browser (`@phis/ui`, `mediaSources`). The picker asks it
 *   directly and uploads what is chosen like any other file.
 *
 * It is deliberately not the Media library's own listing. An Asset in that listing has an id, a Space, a
 * lifecycle and a delivery address, and an item of a source has none of them before it is imported.
 * What a source can truthfully say about an item is what is here.
 */

export type PhisMediaSourceKind = (typeof PhiMediaKind)[keyof typeof PhiMediaKind];

/** The longest search text a source is asked with; the picker cuts what somebody typed to it. */
export const PHIS_MEDIA_SOURCE_QUERY_MAX_LENGTH = 200;

/** The most items a source is asked for at once, and the most it may answer. */
export const PHIS_MEDIA_SOURCE_PAGE_MAX_ITEMS = 60;

/** The longest `id`, `cursor`, `title` and `credit` an item or a page may carry. */
export const PHIS_MEDIA_SOURCE_ITEM_ID_MAX_LENGTH = 256;
export const PHIS_MEDIA_SOURCE_CURSOR_MAX_LENGTH = 512;
export const PHIS_MEDIA_SOURCE_TEXT_MAX_LENGTH = 512;

/**
 * The most bytes an Add-on hands over for one item. The Site's own ceiling for one object applies as
 * well, and the smaller of the two decides; a file past it is refused, never cut.
 */
export const PHIS_MEDIA_SOURCE_TAKE_MAX_BYTES = 32 * 1024 * 1024;

/**
 * One thing a source offers.
 *
 * `id` is the source's own name for it and opaque to everybody else: it is what the source is asked
 * with when the item is chosen, and it need not mean anything after that.
 *
 * `thumbnailUrl` is loaded by the browser of whoever has the picker open, straight from where it points.
 * It is an absolute `https:` address of a small rendition, never the original, and it must be loadable
 * without the source's credentials: nothing of the Site travels with that request but the fact that
 * somebody looked.
 */
export type PhisMediaSourceItem = {
  id: string;
  kind: PhisMediaSourceKind;
  /** What the picker shows under the tile, and what the imported Asset is titled. */
  title: string;
  thumbnailUrl: string;
  /** Of the original, in pixels; null where the source does not say or the item has none. */
  width: number | null;
  height: number | null;
  /**
   * Who made it and on what terms, in the words the source wants shown ("Photo: A. Name / Archive").
   * Shown in the picker and kept on the imported Asset; null where the source asks for nothing.
   */
  credit: string | null;
};

/**
 * What a source is asked.
 *
 * `query` is what somebody typed, trimmed; empty asks for whatever the source shows unasked -- its
 * newest, its featured, nothing. `kinds` is what the picker that asks can take (an image field asks for
 * images); null is any kind, and a source answers no item of a kind that was not asked for.
 *
 * Paging is by cursor, because that is what archives offer: `cursor` is null for the first page and
 * otherwise the `nextCursor` of the page before, handed back unread.
 */
export type PhisMediaSourceListInput = {
  query: string;
  kinds: readonly PhisMediaSourceKind[] | null;
  cursor: string | null;
  /** At most `PHIS_MEDIA_SOURCE_PAGE_MAX_ITEMS`. */
  limit: number;
  /** The locale of whoever asks, as a BCP 47 tag, for a source that titles its items per language. */
  locale: string;
};

export type PhisMediaSourcePage = {
  items: readonly PhisMediaSourceItem[];
  /** Null: there is no further page. */
  nextCursor: string | null;
};

/**
 * One source an implementation offers on a Site: an archive, a collection, an account.
 *
 * `key` is the implementation's own and stable; `label` is what the picker's source switch says.
 */
export type PhisMediaSourceEntry = {
  key: string;
  label: string;
};

/**
 * Whether this implementation can be asked on this Site right now, and what it offers.
 *
 * Asked before a picker shows a switch. `findings` say in an operator's terms what does not answer when
 * `Usable` is not set or a source is left out -- a missing key, an account without access.
 */
export type PhisMediaSourceProbe = {
  /** `PhisMediaSourceProbeFlag`. */
  flags: number;
  sources: PhisMediaSourceEntry[];
  findings: string[];
};

/** Bit flags of `PhisMediaSourceProbe.flags`. */
export const PhisMediaSourceProbeFlag = {
  /** The implementation can be asked on this Site now and is offered in the picker. */
  Usable: 1 << 0,
} as const;

/**
 * An item, taken: the file itself and what is known about it.
 *
 * **Core takes bytes and fetches nothing from an address**, as `assets:v1` `put` does and for the same
 * reason: an address handed to Core is a request Core would make from inside the installation's
 * network. The implementation fetches from its own archive with its own credentials and hands over what
 * it got.
 *
 * `contentType` is what the implementation believes; Core reads the bytes and files the Asset as what
 * they are, and refuses what the Site's library does not take.
 */
export type PhisMediaSourceFile = {
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
  /**
   * What the Asset is titled: the item's `title`, as a rule. The implementation says it again here
   * because Core imports by the item's id alone and trusts no title a browser sends along.
   */
  title: string;
  altText?: string | null;
  /** Absent or null: nothing is kept. */
  credit?: string | null;
};

/**
 * What Core hands an implementation of `@phis/server/service/media-source` when it builds one.
 *
 * Built per Site and per request, as for Support Forwarding: which account a Site searches with is
 * per-Site configuration, and so are the credentials. The implementation reads its own Site secrets and
 * settings and nothing else of Core.
 */
export type PhisMediaSourceServiceContext = {
  /** The Add-on implementing the kind. */
  providerId: string;
  siteKey: string;
  secrets: PhisSecretsCapabilityV1;
  settings: PhisSettingsCapabilityV1;
};

/**
 * The interface of `@phis/server/service/media-source`, version 1.
 *
 * Several implementations may be installed at once and nothing is configured in Core: every
 * implementation that resolves for the Site and probes `Usable` is offered, each with the sources it
 * names, and whoever has the picker open chooses.
 *
 * Every call carries an `AbortSignal` with Core's deadline, and an implementation honours it: Core does
 * not race the call. A throw is logged and shown as "the source did not answer"; it never takes the
 * picker's own library with it.
 *
 * `list` and `take` name the source by the `key` the probe answered. `take` is asked once somebody
 * chose an item, by somebody who may write to the Site's library; what it hands over becomes an Asset
 * there. Taking the same item twice hands over the same bytes, and Core answers the Asset that is
 * already in the library instead of keeping a second copy.
 */
export interface PhisMediaSourceAdapterV1 {
  probe(input: { signal: AbortSignal }): Promise<PhisMediaSourceProbe>;
  list(input: PhisMediaSourceListInput & { source: string; signal: AbortSignal }): Promise<PhisMediaSourcePage>;
  take(input: { source: string; itemId: string; signal: AbortSignal }): Promise<PhisMediaSourceFile>;
}
