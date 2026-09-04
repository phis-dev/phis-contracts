/**
 * What a Module is for, as an operator reads it on the Modules page.
 *
 * Three parties read this one list. An Add-on declares it, per Module and not per package, because a
 * package may ship a shop and a report and neither answer would be true of the other. The site UI
 * groups the Modules page by it. A marketplace -- itself an Add-on -- refuses an offering that names a
 * category nobody knows. One list, because when a vocabulary like this was two lists it drifted, and
 * the drift surfaced as a save being refused rather than as a mismatch anyone could see.
 *
 * Deliberately not in `/addon`. That subpath is the frozen ABI a third party compiles against, and this
 * list grows as the product does: an eighth category would lift the package everybody builds against,
 * for a change that concerns none of them. phi-server never asks the membership question either -- a
 * package manifest carries its Modules' categories as plain strings, Core checks the shape, and the
 * stricter question is asked where a registry is actually held. That is the same split `/signals`
 * makes, for the same reason.
 *
 * A closed list rather than free text, because free text produced a bijection: every one of the
 * eighteen built-in Modules answered the field with its own name, so the column repeated the title it
 * stood next to and no Add-on could have guessed a value another Module already used. Six answers
 * group the built-ins without splitting any of them, and an Add-on that fits none says `other` rather
 * than inventing a nineteenth. `commerce` is the one value no built-in claims: the built-ins are all
 * infrastructure, so a list drawn from them alone would have had a shop nowhere to go.
 *
 * An Area's base Module is `foundation` whatever the Area does, because it is not a Module the
 * operator chose -- it is the ground the Area stands on, and the row for it is the locked one.
 *
 * Distinct from the plugin categories the site UI keeps, which file a Widget or Layout into a drawer of
 * the Builder's insert picker. That is a question about where a block is found, not about what a Module
 * is, and it is answered by the UI alone.
 */
export const PHI_RUNTIME_MODULE_CATEGORIES = [
  "foundation",
  "workspace",
  "content",
  "commerce",
  "people",
  "operations",
  "other",
] as const;

export type PhiRuntimeModuleCategory = (typeof PHI_RUNTIME_MODULE_CATEGORIES)[number];

const PHI_RUNTIME_MODULE_CATEGORY_SET = new Set<string>(PHI_RUNTIME_MODULE_CATEGORIES);

export function isPhiRuntimeModuleCategory(value: unknown): value is PhiRuntimeModuleCategory {
  return typeof value === "string" && PHI_RUNTIME_MODULE_CATEGORY_SET.has(value);
}

/**
 * The category to file a Module under, for a reader that did not compile against this list.
 *
 * A separately shipped Add-on may name a category added after the site it is installed on was built.
 * Refusing it would cost the operator the whole Modules page over one unknown word, so an unrecognised
 * category reads as `other` -- which is what an Add-on that fits nothing is meant to say anyway.
 *
 * A Module built in the same tree never reaches this: its category is typed, so a typo is a compile
 * error long before anything renders. This is for the values that arrive already compiled.
 */
export function readPhiRuntimeModuleCategory(value: unknown): PhiRuntimeModuleCategory {
  return isPhiRuntimeModuleCategory(value) ? value : "other";
}
