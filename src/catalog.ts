/**
 * What a Module is for, as an operator reads it on the Modules page.
 *
 * An Add-on declares it, per Module and not per package, because a package may ship a shop and a
 * report and neither answer would be true of the other. The site UI groups the Modules page by it, and
 * a Module may read another's category and show it.
 *
 * Here rather than in the site UI package because of the reader that cannot follow it there: a
 * marketplace is a phi-server Add-on, it compiles against this package and nothing else, and it is
 * meant to let a shopper filter on category. That filter is not built yet -- the offering's category is
 * still free text -- but it is the reason this list is a contract and not a UI detail.
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
 * stood next to and no Add-on could have guessed a value another Module already used. An Add-on that
 * fits nothing here says `other` rather than inventing a nineteenth.
 *
 * Several values claim no built-in at all, and that is deliberate. A vocabulary that only describes
 * what already exists is right for an internal registry and wrong for a market: the shelf has to be
 * there before the goods, or the first arrival is filed under `other` and nobody ever finds it. So
 * this list is read as a question about what a Module is for, not as an index of what we happen to
 * have built.
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
  "media",
  "commerce",
  "identity",
  "communication",
  "events",
  "analytics",
  "integration",
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

/** The package.json key a Module package declares itself under. */
export const PHIS_MODULE_PACKAGE_KEY = "phis" as const;

/** One Module a package contributes, as its package.json states it. */
export type PhisModulePackageEntry = {
  moduleId: string;
  /**
   * Shape, not membership. A category this build has never heard of is still a well-formed
   * declaration; whether it is a category *we* offer is the question a party with the list asks, and
   * asks at intake, where refusing costs the publisher a message rather than the operator a page.
   */
  category: string;
};

/**
 * What a Module package says about itself, without being run.
 *
 * A Module is compiled UI code: React, the Site's bundler, four fixed entry points. Reading a category
 * out of it means executing a stranger's package inside whatever process asked -- the `phis` CLI, or a
 * marketplace taking a submission. Neither should, so the package states it instead, in the one file it
 * already has and that a registry serves without anybody fetching a tarball.
 *
 * Not a second manifest. A package carries one product at one version: the Add-on manifest is what
 * phi-server is handed when an artifact is installed, and this is what a catalogue reads about the half
 * that never reaches phi-server at all. Same package, same version, different readers.
 *
 * Derived, never composed by hand -- the definitions are the truth and this is their shadow. A package
 * whose declaration and definitions disagree has a build problem, not two opinions.
 */
export type PhisModulePackageDeclaration = {
  /**
   * The language the Modules' own titles and descriptions are written in. Null means `en`.
   *
   * Per package rather than per Module: one package carries one product, written by one hand. A
   * catalogue that translates has to know what it is translating from -- told the wrong source it does
   * not fail, it produces fluent nonsense, which is the one kind of wrong nobody sees.
   */
  sourceLocale: string | null;
  modules: PhisModulePackageEntry[];
};

/**
 * Reads the declaration out of a parsed package.json.
 *
 * Null when the key is absent, which is a legitimate answer: a storage adapter is an Add-on and nothing
 * else, and has no Module half to describe. Present but malformed throws, because that is an author's
 * mistake and silence would file it next to the honest absence.
 */
export function readPhisModulePackageDeclaration(
  packageJson: unknown,
): PhisModulePackageDeclaration | null {
  if (typeof packageJson !== "object" || packageJson === null) {
    return null;
  }
  const declared = (packageJson as Record<string, unknown>)[PHIS_MODULE_PACKAGE_KEY];
  if (declared === undefined) {
    return null;
  }
  if (typeof declared !== "object" || declared === null || Array.isArray(declared)) {
    throw new Error(`"${PHIS_MODULE_PACKAGE_KEY}" in package.json must be an object.`);
  }
  const block = declared as Record<string, unknown>;
  const sourceLocale = block.sourceLocale;
  if (sourceLocale !== undefined && (typeof sourceLocale !== "string" || !sourceLocale.trim())) {
    throw new Error(`"${PHIS_MODULE_PACKAGE_KEY}.sourceLocale" must be a non-empty string when stated.`);
  }
  if (!Array.isArray(block.modules)) {
    throw new Error(`"${PHIS_MODULE_PACKAGE_KEY}.modules" must be an array.`);
  }
  const modules = block.modules.map((entry, index) => {
    const at = `${PHIS_MODULE_PACKAGE_KEY}.modules[${index}]`;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error(`"${at}" must be an object.`);
    }
    const { moduleId, category } = entry as Record<string, unknown>;
    if (typeof moduleId !== "string" || !moduleId.trim()) {
      throw new Error(`"${at}.moduleId" must be a non-empty string.`);
    }
    if (typeof category !== "string" || !category.trim()) {
      throw new Error(`"${at}.category" must be a non-empty string.`);
    }
    return { moduleId, category };
  });
  return { sourceLocale: typeof sourceLocale === "string" ? sourceLocale : null, modules };
}
