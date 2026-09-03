/**
 * The language this software is written in.
 *
 * Not a default and not a preference: it is the locale every label, every email template and every
 * global message is authored in, and therefore the one a translation starts from. `TRANSLATIONS.md`
 * fixes it -- global messages in `phis.tr_msg` always use English as their canonical source, while a
 * Site's own messages use the immutable `sourceLocale` chosen when the Site was created.
 *
 * It was called DEFAULT_LOCALE on both sides, which is the name of a different thing: a Site's default
 * locale is configuration, stored per Site in `sites.default_locale`, and an installation may set it to
 * anything. Under one name the two were indistinguishable at the call site, and a reader could not tell
 * whether a line stated a fact about the source text or made an assumption about somebody's Site.
 */

export const PHI_CANONICAL_SOURCE_LOCALE = "en";
