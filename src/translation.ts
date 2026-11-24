/**
 * The Translation service kind, as a Provider implements it.
 *
 * Core owns the question -- which text, out of which language, into which one -- and keeps asking it
 * from the places that already translate: the global and Site message stores, and a conversation
 * message somebody asked to read in their own language. A Provider answers it and nothing else.
 * Nothing here reaches a database, a request, or a secret store: the Provider gets configuration and a
 * context, and answers about text.
 *
 * What a Provider talks to is its own business, and deliberately not described here. A vendor over
 * HTTP, a model on the machine, a catalogue it maintains itself and a CDN it consults first are all the
 * same shape from Core's side, which is the reason this is a service kind rather than a list of
 * vendors Core knows the names of.
 */

export type PhisTranslationProviderId = `@${string}/${string}`;

/**
 * How the text is to be read.
 *
 * `text` includes Markdown. Control characters survive a translation unchanged, so a Provider is not
 * told about Markdown and has no reason to be: the markup arrives as part of the text and leaves as
 * part of it. `html` is the case where tags must be recognised rather than carried, because a
 * translator that reorders words around them has to know which spans it may not split.
 */
export type PhisTranslationFormat = "text" | "html";

export type PhisTranslationRequest = {
  /**
   * A batch, and the ordinary case rather than the exception.
   *
   * Core asks for everything it needs in one call -- a page of labels, a store's worth of messages --
   * and splits only where a Provider's own request limit forces it. The answer holds exactly as many
   * entries as the request, in its order; a Provider never drops, merges or reorders one, because the
   * caller matches them back by position and nothing else.
   *
   * One text is a batch of one and takes the same path.
   */
  texts: readonly string[];
  /**
   * What the text is written in, or `null` to let the Provider decide.
   *
   * `null` is a real case and not an omission: a Site message may carry no declared source, and a
   * conversation message written before anybody was asked carries none either. What Core must not do
   * is invent one, which is why this is nullable rather than defaulted.
   */
  sourceLang: string | null;
  targetLang: string;
  format: PhisTranslationFormat;
  /**
   * Context for the translator, and never translated itself.
   *
   * Natural language that influences how the text is read -- the subject matter, the surrounding
   * sentence, the register to keep. It is not a description of where the text sits: resource identity,
   * URLs, message keys and source languages are excluded by contract, and a Provider given those would
   * be given noise to translate around.
   *
   * Core's own storage flags travel in the same field internally and are stripped before this one is
   * built, so a Provider never sees `[html]` and has no reason to know such a thing exists. Absent
   * where there is nothing to say, which is every conversation message.
   */
  context?: string;
  /**
   * Told that nobody is waiting for this any more.
   *
   * A translation is one request in flight to somewhere else. A Provider that ignores this still
   * finishes and still costs what it costs; honouring it is how it stops paying for an answer nobody
   * will read.
   */
  signal?: AbortSignal;
};

/**
 * Both stores ask the same way.
 *
 * A global message is authored in English and a Site message in that Site's own immutable source
 * locale, and the difference lands in `sourceLang` and nowhere else. A Provider is not told which store
 * a text came from, because knowing would let it answer differently for one -- and the two are the same
 * question asked about different text.
 */
export type PhisTranslationResult = {
  /** As many entries as the request had, in its order. */
  texts: readonly string[];
};

/**
 * What this Provider was found to be able to do, asked once when it is configured.
 *
 * Not per translation, for the reason the Storage probe is not per upload: an installation has to be
 * able to offer a choice of target language before anybody presses anything, and a list fetched at the
 * moment of use is a list that decides whether a control can be drawn after it has been drawn.
 *
 * A Provider that cannot be reached answers `usable: false` with a finding rather than throwing. Not
 * being reachable is an answer, and an operator configuring one needs to be told which of the two it
 * is.
 */
export type PhisTranslationProbe = {
  usable: boolean;
  /**
   * The languages it accepts as a source, as locale keys.
   *
   * Empty means it accepts any, or decides for itself -- a Provider that only ever detects has nothing
   * to list. It does not mean it accepts none; a Provider that accepts none is not usable.
   */
  sourceLangs: string[];
  /** The languages it can produce. An installation offers the intersection with what a Site has. */
  targetLangs: string[];
  /** What did not answer, in an operator's terms. Empty when everything did. */
  findings: string[];
};

export interface PhisTranslationAdapter {
  probeCapabilities(): Promise<PhisTranslationProbe>;
  translate(input: PhisTranslationRequest): Promise<PhisTranslationResult>;
}

/**
 * What a Provider is given, and the whole of it.
 *
 * A Provider needs its credential and must not be able to reach anything else, so the context carries
 * no database handle and no general secret accessor: `readSecret` resolves the one reference this
 * Provider's own configuration names, and there is no argument that could make it resolve another.
 *
 * There is no Site here. Which translator an installation uses is an installation's decision and not a
 * Site's, unlike a Storage Profile, so a Provider is never handed a Site to branch on and can never
 * come to treat one differently from another.
 */
export type PhisTranslationServiceContext = {
  providerId: PhisTranslationProviderId;
  /** The Provider's own secret, or null when its configuration names none. */
  readSecret: () => Promise<string | null>;
};

/** The longest context an Add-on names for its texts, in characters (`PhisTranslationsCapabilityV1`). */
export const PHIS_ADDON_TRANSLATION_CONTEXT_MAX = 64;
/** The most texts one call of `translations:v1` takes. */
export const PHIS_ADDON_TRANSLATION_TEXTS_MAX = 200;
/** The longest text `translations:v1` takes, in characters: as long as a product's description may be. */
export const PHIS_ADDON_TRANSLATION_TEXT_MAX = 20000;

/**
 * `@phis/server/translations:v1`: words an Add-on keeps in its own tables -- a listing's hint, a
 * category's name -- as source texts of the Site's translation store, and read back in a reader's
 * language.
 *
 * They are the Site's words, written in the Site's source language by whoever administers the Add-on, so
 * they live where a Page's words live (`tr_site_msg`): Editor > Translations lists them and a translator
 * translates them there, `phis translations export --site` and `import` carry them, and a reader in
 * another language is answered the translation -- a person's where one is held, else the configured
 * translation provider's, asked once and kept, as for a Widget's words.
 *
 * `context` is the Add-on's own natural-language word for what the texts are (`listing hint`), at most
 * `PHIS_ADDON_TRANSLATION_CONTEXT_MAX` characters, not starting with `[`, and never a resource identity: no
 * id, no key, no address. Core keeps the texts under `<addonId>: <context>` (`@phis/shop: listing hint`),
 * built by Core and never taken from the caller, so an Add-on's texts never land in a register of the
 * platform's or of another Add-on, and the translator reads whose words they are. The same text under the
 * same context is one message, however many rows carry it: "20 % off" is translated once.
 *
 * Absent from the payload: dynamic values. A text is what an author wrote, never a visitor's input, a
 * name, an address or a number filled in.
 */
export type PhisTranslationsCapabilityV1 = {
  /**
   * Records texts as source texts of the Site, so a translator finds them before anybody reads them in
   * another language. Called where the Add-on writes them -- a save -- with the texts it saved; recording a
   * text twice changes nothing, and an empty text is skipped. Refused from an unverified hook: a visitor
   * writes nothing into the Site's store.
   *
   * Nothing is taken away when a text changes or its row goes: the message may be another row's too, and
   * `phis translations usage` finds what nobody reads any more.
   */
  record(input: { context: string; texts: readonly string[] }): Promise<void>;
  /**
   * The texts in `locale`, each at its position: the translation held for it, else the provider's, asked
   * for the missing ones in one request and kept; the text as written where `locale` is the Site's source
   * language, null, or no language the Site translates into, and for a text never recorded (`record`),
   * which this never records. `provisional` is true where any answer is the text as written standing in
   * for a provider that failed: a caller that keeps answers does not keep that one.
   *
   * `locale` is the reader's, `PhisAddonRequestContext.locale` for a request.
   */
  translate(input: {
    context: string;
    locale: string | null;
    texts: readonly string[];
  }): Promise<{ texts: string[]; provisional: boolean }>;
};
