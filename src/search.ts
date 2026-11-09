/**
 * What a Site and phis say to each other about searching the Site's own Pages.
 *
 * The texts a visitor searches are not phis's to know: a Page's words stand in Widget configs, in content
 * phis stores without knowing which Page shows it, and in documents a Widget fetches from elsewhere while
 * the Page is drawn. Only the Site, resolving a Page the way a visitor's request resolves it, sees the
 * whole text. So the Site writes the documents, one per Page and language, and phis keeps them, indexes
 * them and answers a query with the Pages that match -- which is the half a database does well.
 *
 * Both halves read the same shapes: what the Site sends (`PhiSearchIndexSet`), what phis answers
 * (`PhiSearchResponse`), and the query's admission (`readPhiSearchQuery`), because a query the Site shows
 * as "too short" and phis would have answered -- or the reverse -- is a visitor told two things at once.
 */
import { PhiCmsVisibilityContext } from "./cms.js";

/**
 * The Areas a search index covers: a visitor's Public Site and the App a signed-in member reaches.
 *
 * Admin, Editor, Builder and Accounting are the operator's chrome, not Pages anybody searches, and a
 * document set declared for one of them is refused rather than kept.
 */
export const PHI_SEARCH_INDEXED_AREA_MASK = PhiCmsVisibilityContext.PublicArea | PhiCmsVisibilityContext.AppArea;

/** The URL parameter the search box writes and the results Widget reads. */
export const PHI_SEARCH_QUERY_PARAM = "q";

/** A query shorter than this is not a search; two letters match too much to be an answer. */
export const PHI_SEARCH_MIN_QUERY_LENGTH = 2;
export const PHI_SEARCH_MAX_QUERY_LENGTH = 200;

export const PHI_SEARCH_DEFAULT_LIMIT = 20;
export const PHI_SEARCH_MAX_LIMIT = 50;

/** How many documents one set may carry; a Site with more Pages than this is a different product. */
export const PHI_SEARCH_MAX_DOCUMENTS = 5000;
export const PHI_SEARCH_MAX_PATH_LENGTH = 512;
export const PHI_SEARCH_MAX_TITLE_LENGTH = 512;
export const PHI_SEARCH_MAX_DESCRIPTION_LENGTH = 2048;
/** The text of one Page, as indexed; the words beyond it are not searched. */
export const PHI_SEARCH_MAX_TEXT_LENGTH = 200_000;

/** One Page in one language, as the Site read it when the set was built. */
export type PhiSearchDocument = {
  /** The Page's address within its Area, `/docs/install`, as a link to it is written. */
  path: string;
  title: string;
  description: string;
  /** The Page's words, in reading order, with no markup; a heading is a line like any other. */
  text: string;
};

/**
 * Every document of one Area in one language, replacing whatever the set held before.
 *
 * `fingerprint` names what the set was built from -- the live revisions, the route table, the Module
 * addresses -- so phis can tell a set it already holds from a new one and several Site processes
 * noticing the same publish write it once.
 */
export type PhiSearchIndexSet = {
  areaMask: number;
  locale: string;
  fingerprint: string;
  documents: PhiSearchDocument[];
};

/** What phis holds of one set: enough for a Site to decide whether to build it again. */
export type PhiSearchIndexState = {
  areaMask: number;
  locale: string;
  fingerprint: string;
  documentCount: number;
  /** ISO instant. */
  indexedAt: string;
};

export type PhiSearchIndexWriteResult = {
  /** `false` when the set phis holds already carries this fingerprint, and nothing was written. */
  accepted: boolean;
  state: PhiSearchIndexState;
};

/** A piece of a snippet; a `match` piece is one of the query's words as it stands in the text. */
export type PhiSearchSnippetSegment = {
  text: string;
  match: boolean;
};

export type PhiSearchHit = {
  path: string;
  areaMask: number;
  title: string;
  description: string;
  /** The passage around the best matches, in pieces; empty when the match is in the title alone. */
  snippet: PhiSearchSnippetSegment[];
  /** Higher is better; comparable within one answer only. */
  rank: number;
};

export type PhiSearchResponse = {
  /** The query as phis read it (`readPhiSearchQuery`). */
  query: string;
  locale: string;
  /** The Areas that were searched, as a mask. */
  areaMask: number;
  hits: PhiSearchHit[];
  /** How many documents match in all, of which `hits` are the first. */
  total: number;
};

/**
 * The query as both ends read it, or `null` for no query: whitespace collapsed, bounds applied.
 *
 * Length is measured after collapsing, so a visitor cannot pad past the ceiling with spaces, and a query
 * over the ceiling is cut rather than refused -- the first two hundred characters are a search, the rest
 * was never going to narrow it.
 */
export function readPhiSearchQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const collapsed = value.replace(/\s+/gu, " ").trim();
  if (collapsed.length < PHI_SEARCH_MIN_QUERY_LENGTH) return null;
  return collapsed.length > PHI_SEARCH_MAX_QUERY_LENGTH
    ? collapsed.slice(0, PHI_SEARCH_MAX_QUERY_LENGTH).trimEnd()
    : collapsed;
}

/**
 * The words of a query, as both ends count them: letters and digits of any script, lower-cased,
 * everything else a separator. phis builds its text query from these; the Site marks them in what it
 * shows. A word is at most 64 characters, so a pasted token does not become a search for nothing.
 */
export function tokenizePhiSearchQuery(query: string): string[] {
  const words: string[] = [];
  for (const match of query.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu)) {
    const word = match[0].slice(0, 64);
    if (!words.includes(word)) words.push(word);
  }
  return words;
}
