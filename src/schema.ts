/**
 * What an Add-on says about the tables it owns.
 *
 * An Add-on ships no SQL. It states the shape it wants and Core derives the statements, which is what
 * lets an Add-on outlive a change of database system and what turns most of the rules in section 15 of
 * the Add-on contract from something checked afterwards into something that cannot be expressed at all.
 *
 * The vocabulary is deliberately poorer than SQL. There are no triggers, functions, views, expression or
 * partial indexes, and no free-form check, because each of those would be SQL again and would put back
 * exactly what this removes. An Add-on that needs one of them is either cut wrong or needs a Core
 * service.
 */

export const PHI_SERVER_ADDON_SCHEMA_DESCRIPTOR_VERSION = 1 as const;

/**
 * What a column holds, said abstractly so Core can map it.
 *
 * `identity` is a generated key and may appear only in a primary key; the width is Core's business, not
 * the Add-on's.
 */
export type PhiServerAddonColumnType =
  | "identity"
  | "smallInteger"
  | "integer"
  | "bigInteger"
  | "text"
  | "string"
  | "boolean"
  | "instant"
  | "json"
  | "uuid"
  | "binary";

/** The closed vocabulary a default may be drawn from. Anything wider would be an expression. */
export type PhiServerAddonColumnDefault =
  | { kind: "literal"; value: string | number | boolean }
  | { kind: "now" };

/**
 * A Core table an Add-on may point at, named symbolically.
 *
 * An Add-on never writes `phis.sites(id)`. Core is then free to rename its own tables without breaking
 * an installed Add-on, and which Core tables are referenceable becomes a decision instead of a
 * consequence of what happens to be reachable.
 *
 * A group exists only inside a Site, so a table pointing at `core.group` must be Site-scoped and Core
 * binds the pair rather than the id alone. Core never references a group any other way, and an Add-on
 * that could would be able to name a group belonging to a different Site.
 */
export const PHI_SERVER_ADDON_CORE_REFERENCES = {
  site: "core.site",
  user: "core.user",
  group: "core.group",
} as const;

export type PhiServerAddonCoreReference =
  (typeof PHI_SERVER_ADDON_CORE_REFERENCES)[keyof typeof PHI_SERVER_ADDON_CORE_REFERENCES];

/**
 * A delete rule, offered as two values and no third.
 *
 * An Add-on must not be able to refuse a Core deletion: an operator who cannot delete a user because an
 * installed package forbids it is looking at a constraint error from code they may not know they have.
 */
export type PhiServerAddonDeleteRule = "cascade" | "setNull";

export type PhiServerAddonValueColumnDescriptor = {
  name: string;
  type: PhiServerAddonColumnType;
  /** Required for `string`, forbidden otherwise. */
  maxLength?: number;
  nullable?: boolean;
  /**
   * Unique -- within the Site, when the table is Site-scoped.
   *
   * Core prepends the Site column, because the Add-on cannot: it may not declare `site_id` and so has
   * nowhere to name the pair. Without that, uniqueness would reach across every tenant on the instance,
   * and the second Site to install the Add-on would collide with the first over a value neither of them
   * can see. Instance-wide uniqueness is therefore not expressible on a Site-scoped table, which is the
   * intended answer rather than a missing feature.
   */
  unique?: boolean;
  default?: PhiServerAddonColumnDefault;
};

/**
 * A column that points at something, and therefore has no type of its own.
 *
 * Its type is whatever it references, which is Core's to know: a Core key may be a different width than
 * an Add-on would guess, and stating one here would be a guess that compiles. This is also the only
 * shape a foreign key takes -- there is no separate list of them, and no composite key, because a
 * reference that needs two columns is pointing at something an Add-on should not be reaching into.
 */
export type PhiServerAddonReferenceColumnDescriptor = {
  name: string;
  /** A Core table under its symbolic name, or one of this Add-on's own tables. */
  references: PhiServerAddonCoreReference | { table: string };
  nullable?: boolean;
  unique?: boolean;
  /** `setNull` requires a nullable column. */
  onDelete: PhiServerAddonDeleteRule;
};

export type PhiServerAddonColumnDescriptor =
  | PhiServerAddonValueColumnDescriptor
  | PhiServerAddonReferenceColumnDescriptor;

/**
 * A constraint, in structured form.
 *
 * These belong in the first version of a descriptor and are the one part that does not wait: a column
 * can be added later and an index can be added later, but a constraint added later meets the rows that
 * are already there.
 *
 * Regular expressions are absent on purpose. Their syntax differs between database systems, and taking
 * them would buy back the dependency this file exists to remove.
 */
export type PhiServerAddonTableConstraintDescriptor =
  | {
      kind: "range";
      name: string;
      column: string;
      min?: number;
      max?: number;
      exclusiveMin?: boolean;
      exclusiveMax?: boolean;
    }
  | { kind: "enumeration"; name: string; column: string; values: string[] }
  | { kind: "notEmpty"; name: string; column: string }
  | {
      kind: "columnComparison";
      name: string;
      left: string;
      operator: "<" | "<=" | ">" | ">=";
      right: string;
    }
  /** For the polymorphic row: exactly `nonNullCount` of `columns` is set. */
  | { kind: "nullCardinality"; name: string; columns: string[]; nonNullCount: number };

/**
 * What an index is for, said abstractly so Core can choose the structure.
 *
 * `ordered` is the ordinary one: equality, ranges, and the orderings a paged select runs under.
 * `text` is for substring search, names exactly one text column, and is what makes `contains` more than
 * a scan -- measured on 200,000 rows, 72 ms without it and 0.5 ms with. It cannot be unique, because it
 * indexes fragments rather than values.
 *
 * Absent means `ordered`: an index declared before this field existed had not forgotten it.
 */
export type PhiServerAddonIndexKind = "ordered" | "text";

export type PhiServerAddonIndexDescriptor = {
  name: string;
  kind?: PhiServerAddonIndexKind;
  columns: string[];
  /**
   * Unique, and read exactly as `unique` on a column: within the Site, on a Site-scoped table, with the
   * Site column prepended by Core.
   *
   * A non-unique index is only an access path and is left as it was written. Which order helps depends
   * on the query, and Core does not know it.
   */
  unique?: boolean;
};

export type PhiServerAddonTableDescriptor = {
  name: string;
  /**
   * Core adds the Site column, its foreign key, and its cascade, puts the Site filter into every query
   * that reads this table, and prepends it to every uniqueness rule the table declares. The Add-on
   * neither writes the column nor is able to forget it.
   *
   * This is more than a reference column: it is the boundary a query is compiled against. A table that
   * merely wants to mention a Site uses a reference column instead.
   */
  siteScoped?: boolean;
  /**
   * Core adds the owner column and its foreign key, and answers whether a row belongs to the acting
   * user. The Add-on neither writes the column nor decides what "own" means, which is the point: the
   * rule that a person may edit and delete what they created is one rule, not one per package.
   *
   * The column is nullable and a deleted user leaves it null rather than taking the rows along. A row
   * without an owner therefore belongs to nobody, and no membership level reaches it through ownership.
   *
   * This is authority, not history. A table that only wants to record who created a row uses an
   * ordinary `core.user` reference column, which grants nothing.
   */
  ownerScoped?: boolean;
  /**
   * Core adds the group column and binds it to the Site's group, which makes the group membership
   * levels applicable to this table. Requires `siteScoped`, because a group has no meaning without one.
   *
   * As with the Site, this is more than a reference column: it says the rows are group property and are
   * read through a membership level. A table that merely wants to mention a group uses a `core.group`
   * reference column instead.
   */
  groupScoped?: boolean;
  columns: PhiServerAddonColumnDescriptor[];
  primaryKey: string[];
  indexes?: PhiServerAddonIndexDescriptor[];
  constraints?: PhiServerAddonTableConstraintDescriptor[];
};

/**
 * The shape an Add-on's schema should have -- not the steps to reach it.
 *
 * `version` is the schema version the manifest reports, and Core compares this description against the
 * one it recorded to decide what to run.
 */
export type PhiServerAddonSchemaDescriptor = {
  descriptorVersion: typeof PHI_SERVER_ADDON_SCHEMA_DESCRIPTOR_VERSION;
  version: number;
  tables: PhiServerAddonTableDescriptor[];
};
