/**
 * The request headers phis and the site UI must spell the same way.
 *
 * These five names are a wire protocol between processes that deploy independently. phis reads them in
 * its guards and route handlers; the site UI writes them in its proxies, gateways and browser widgets.
 * A disagreement is not a type error and not a failing test -- it is a 403 from `guardApiV1` or a 400
 * from `requireSiteFromExplicitKeyRequest`, at runtime, in whichever direction the mismatch happens to
 * point.
 *
 * They were string literals in both repositories before this file existed, eighty-odd of them, and the
 * one place that had bothered to name a constant named it in only one of the two. Renaming the prefix
 * from `x-phi-` to `x-phis-` is what made that visible; the point of collecting them here is that the
 * next such change is one edit rather than a search.
 */

/** Carries the public or internal API token on every `/api/v1/*` request. */
export const PHIS_TOKEN_HEADER = "x-phis-token" as const;

/**
 * Names the Site a request is scoped to, and is the only thing that does.
 *
 * There is deliberately no host, origin or referer fallback: those are caller-controlled, so a request
 * without this header could otherwise claim any Site whose hostname it spoofed.
 */
export const PHIS_SITE_KEY_HEADER = "x-phis-site-key" as const;

/** Names the CMS area a media request acts in, which decides what the actor may reach. */
export const PHIS_AREA_HEADER = "x-phis-area" as const;

/**
 * Hand the original request path and query from the site proxy to the server helpers behind it.
 *
 * Both are set and read inside the site runtime and never reach phis; they exist because a Server
 * Component cannot otherwise see the URL the proxy rewrote.
 */
export const PHIS_REQUEST_PATH_HEADER = "x-phis-request-path" as const;
export const PHIS_REQUEST_SEARCH_HEADER = "x-phis-request-search" as const;
