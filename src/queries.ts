/**
 * What an Add-on says about the queries it runs.
 *
 * The same bargain as the schema descriptor, one step further: an Add-on ships no SQL for its tables
 * and none for its statements either. It declares named queries, Core derives the statements once, and
 * the Add-on invokes them by name with parameters. Nothing is assembled at request time, so `phis-cli`
 * can show an operator every statement an installed Add-on is able to run -- which a query builder
 * handed out at runtime could never do.
 *
 * The vocabulary is poorer than SQL on purpose, and poorer than the schema descriptor's in one further
 * way: there are no joins. A join to a Core table would make the kernel's shape an Add-on's dependency,
 * and a join between two Add-ons' tables is already forbidden. A query that needs one is either cut
 * wrong or wants a Core service.
 */

/** What a declared parameter holds. Narrower than the column vocabulary: these travel as values. */
export type PhiServerAddonQueryParameterType =
  | "integer"
  | "bigInteger"
  | "text"
  | "boolean"
  | "instant"
  | "uuid";

export type PhiServerAddonQueryParameter = {
  name: string;
  type: PhiServerAddonQueryParameterType;
  /** Whether the caller may pass null. Absent means it may not. */
  nullable?: boolean;
};

/**
 * Where a value in a query comes from.
 *
 * `actor` is the point of the list. "My rows" is the commonest filter there is, and letting an Add-on
 * pass the acting user's id would mean trusting it to pass the right one. Core substitutes its own
 * bound actor, so the query cannot be aimed at somebody else -- the same reason the capability closes
 * over the Site instead of taking it as an argument.
 */
export type PhiServerAddonQueryValue =
  | { kind: "parameter"; name: string }
  | { kind: "literal"; value: string | number | boolean }
  /** The acting user's id, substituted by Core. Null when nobody is acting, which matches nothing. */
  | { kind: "actor" }
  | { kind: "now" };

export type PhiServerAddonQueryComparison = "=" | "<>" | "<" | "<=" | ">" | ">=";

/**
 * A condition, as a tree of a closed set of shapes.
 *
 * No expressions, no functions, no pattern matching. `LIKE` is absent for the reason regular
 * expressions are absent from the schema descriptor: its escaping and collation behaviour differ
 * between database systems, and taking it would buy back the dependency this exists to remove. Text
 * search is a Core service, not a query the Add-on writes.
 */
export type PhiServerAddonQueryCondition =
  | {
      kind: "compare";
      column: string;
      operator: PhiServerAddonQueryComparison;
      value: PhiServerAddonQueryValue;
    }
  | { kind: "isNull"; column: string; negated?: boolean }
  | { kind: "in"; column: string; values: PhiServerAddonQueryValue[] }
  | { kind: "all"; conditions: PhiServerAddonQueryCondition[] }
  | { kind: "any"; conditions: PhiServerAddonQueryCondition[] };

export type PhiServerAddonQueryOrdering = {
  column: string;
  direction: "asc" | "desc";
};

export type PhiServerAddonQueryAssignment = {
  column: string;
  value: PhiServerAddonQueryValue;
};

/**
 * Reading rows of one of this Add-on's tables.
 *
 * `limit` is required and bounded. An unbounded read is how an Add-on takes an instance down with a
 * table that grew, and "the caller will pass a sensible one" is not a bound.
 */
export type PhiServerAddonSelectQueryDescriptor = {
  kind: "select";
  name: string;
  table: string;
  /** Absent means every declared column. Core's scope columns are never among them. */
  columns?: string[];
  where?: PhiServerAddonQueryCondition;
  orderBy?: PhiServerAddonQueryOrdering[];
  limit: number;
  offsetParameter?: string;
};

/**
 * Adding a row.
 *
 * The scope columns are absent by construction: `siteScoped`, `groupScoped` and `ownerScoped` mean Core
 * writes them, so there is nowhere here to name one. Core fills the Site and the actor from the bound
 * context; the group comes from a declared parameter because a row can belong to any group the actor is
 * in, and Core refuses one they are not.
 */
export type PhiServerAddonInsertQueryDescriptor = {
  kind: "insert";
  name: string;
  table: string;
  values: PhiServerAddonQueryAssignment[];
  /** Names the parameter carrying the group id, and is required for a group-scoped table. */
  groupParameter?: string;
};

/**
 * Changing or removing exactly one row, addressed by its primary key.
 *
 * There is no `where` here and no bulk form. Core checks `mayActOnRow` against the row before it
 * writes, and a check that has to be remembered is one that eventually is not -- so the shape makes it
 * unskippable rather than the discipline. An Add-on that needs to rewrite many rows at once is doing
 * something Core should be doing for it.
 */
export type PhiServerAddonUpdateQueryDescriptor = {
  kind: "update";
  name: string;
  table: string;
  set: PhiServerAddonQueryAssignment[];
  /** Names the parameter carrying the row's primary key value. */
  idParameter: string;
};

export type PhiServerAddonDeleteQueryDescriptor = {
  kind: "delete";
  name: string;
  table: string;
  idParameter: string;
};

export type PhiServerAddonQueryDescriptor =
  | PhiServerAddonSelectQueryDescriptor
  | PhiServerAddonInsertQueryDescriptor
  | PhiServerAddonUpdateQueryDescriptor
  | PhiServerAddonDeleteQueryDescriptor;

/** The most rows one declared `select` may return, whatever it asks for. */
export const PHI_SERVER_ADDON_QUERY_MAX_LIMIT = 500 as const;

export type PhiServerAddonQueryCatalog = {
  parameters: Readonly<Record<string, PhiServerAddonQueryParameter[]>>;
  queries: PhiServerAddonQueryDescriptor[];
};

export type PhiServerAddonQueryArguments = Readonly<
  Record<string, string | number | boolean | null>
>;

export type PhiServerAddonQueryRow = Readonly<Record<string, unknown>>;

/**
 * Running the declared queries: `@phis/server/data:v1`.
 *
 * Every call names a query the manifest declared. There is no method that takes SQL, a table, or a
 * condition, because an Add-on that could pass one of those at request time would be holding a
 * database handle with extra steps.
 *
 * A mutation answers how many rows it touched. Zero from an `update` or `delete` means the row was not
 * there or was not the caller's to change, and the two are deliberately the same answer: telling them
 * apart would report the existence of a row the caller may not have.
 */
export type PhiServerDataCapabilityV1 = {
  select(name: string, args?: PhiServerAddonQueryArguments): Promise<PhiServerAddonQueryRow[]>;
  /** Returns the inserted row, with the scope columns Core filled in. */
  insert(name: string, args?: PhiServerAddonQueryArguments): Promise<PhiServerAddonQueryRow | null>;
  update(name: string, args?: PhiServerAddonQueryArguments): Promise<number>;
  delete(name: string, args?: PhiServerAddonQueryArguments): Promise<number>;
  /**
   * One unit of work. Everything inside commits together or not at all.
   *
   * The handle offers the same four operations and nothing else -- no commit, no rollback, no
   * savepoint. Returning ends the transaction; throwing rolls it back. An Add-on cannot leave one
   * open, because it never holds the thing that would stay open.
   */
  transaction<T>(body: (tx: PhiServerDataTransactionV1) => Promise<T>): Promise<T>;
};

export type PhiServerDataTransactionV1 = Omit<PhiServerDataCapabilityV1, "transaction">;
