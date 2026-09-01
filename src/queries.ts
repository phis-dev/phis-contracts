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
 * No expressions, no functions, no patterns an Add-on writes. `LIKE` is absent for the reason regular
 * expressions are absent from the schema descriptor: its escaping and collation behaviour differ
 * between database systems, and taking it would buy back the dependency this exists to remove. What
 * replaces it is `contains`, an operator: the Add-on names a column and a value, and Core decides how
 * that is spelled and escaped.
 */
export type PhiServerAddonQueryCondition =
  | {
      kind: "compare";
      column: string;
      operator: PhiServerAddonQueryComparison;
      value: PhiServerAddonQueryValue;
    }
  | { kind: "isNull"; column: string; negated?: boolean }
  /**
   * Whether a text column contains this fragment, case-insensitively.
   *
   * The one search the vocabulary offers, and it is an operator rather than a pattern: the Add-on says
   * what it wants and Core writes the statement, so there is no `LIKE` syntax in a manifest and no
   * escaping for an author to get wrong. A `%` or a `_` in the value is a character to look for, not a
   * wildcard.
   *
   * It wants a `text` index on the column. Without one it still works and reads the whole table to do
   * it, which `phis addon check` reports at install rather than leaving to be discovered in production.
   */
  | { kind: "contains"; column: string; value: PhiServerAddonQueryValue }
  | { kind: "in"; column: string; values: PhiServerAddonQueryValue[] }
  | { kind: "all"; conditions: PhiServerAddonQueryCondition[] }
  | { kind: "any"; conditions: PhiServerAddonQueryCondition[] }
  /**
   * A condition that applies only when its parameter was given.
   *
   * A listing has filters the caller may or may not set, and a declared query has one fixed `where`.
   * Without this, every combination is its own query -- three optional filters are eight of them, four
   * are sixteen, each declared, validated and kept in step by hand. The parameter must be nullable, and
   * null means the condition is not there rather than that it matched nothing.
   */
  | { kind: "whenPresent"; parameter: string; condition: PhiServerAddonQueryCondition };

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
 * Every select is paged, whether or not it was written as a listing. There is no unpaged form to reach
 * for: an unbounded read is how an Add-on takes an instance down with a table that grew, and "the
 * caller will pass a sensible one" is not a bound.
 *
 * `orderBy` is completed by Core with the primary key, so the order is total. Without that a cursor is
 * quietly wrong: two rows sharing a sort value may come back in either order, and a row then appears on
 * two pages while another appears on none. It is the kind of fault that stays invisible until the table
 * is large, and no Add-on author has to think about it.
 *
 * Every column named in `orderBy` must be declared `NOT NULL`. Where nulls sort is a decision the
 * descriptor cannot express, so an order over a nullable column is underdetermined -- and a keyset
 * comparison against a null value matches nothing at all, which would end the paging early rather than
 * loudly.
 */
/**
 * A role the acting user must hold for this query to run at all.
 *
 * The one thing Core does with an Add-on's role vocabulary, and it is deliberately the smallest thing
 * that is useful: it compares a name against what is stored. Core does not learn that `curator` may
 * moderate -- that meaning stays here, as the pairing of a role with a query, which is the Add-on's own
 * statement about its own vocabulary.
 *
 * It is what makes a table nobody owns writable. Without an owner and without a group, Core has no way
 * to judge a row and answers no to every update and delete -- correct for a row that should belong to
 * somebody, wrong for a catalogue, a rate table, or a moderation note, which belong to the Add-on. A
 * declared role is the missing authority, and being declared is what makes it unforgettable: the check
 * is in the descriptor rather than at the top of a handler, where it is one refactor from gone.
 *
 * On a table that is owned or grouped it narrows rather than replaces: both the role and the ladder
 * have to be satisfied.
 */
type PhiServerAddonRoleGuarded = {
  /** Names a role this Add-on's manifest declares. Absent means the query needs none. */
  requiresRole?: string;
};

export type PhiServerAddonSelectQueryDescriptor = PhiServerAddonRoleGuarded & {
  kind: "select";
  name: string;
  table: string;
  /** Absent means every declared column. Core's scope columns are never among them. */
  columns?: string[];
  where?: PhiServerAddonQueryCondition;
  orderBy?: PhiServerAddonQueryOrdering[];
  /**
   * The largest page this query will ever serve, whatever the caller asks for.
   *
   * The Add-on's own ceiling, not the page size: a call may ask for less, and Core takes the smallest of
   * the request, this, and `PHI_SERVER_ADDON_QUERY_MAX_LIMIT`.
   */
  limit: number;
};

/**
 * Adding a row.
 *
 * The scope columns are absent by construction: `siteScoped`, `groupScoped` and `ownerScoped` mean Core
 * writes them, so there is nowhere here to name one. Core fills the Site and the actor from the bound
 * context; the group comes from a declared parameter because a row can belong to any group the actor is
 * in, and Core refuses one they are not.
 */
export type PhiServerAddonInsertQueryDescriptor = PhiServerAddonRoleGuarded & {
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
export type PhiServerAddonUpdateQueryDescriptor = PhiServerAddonRoleGuarded & {
  kind: "update";
  name: string;
  table: string;
  set: PhiServerAddonQueryAssignment[];
  /** Names the parameter carrying the row's primary key value. */
  idParameter: string;
};

export type PhiServerAddonDeleteQueryDescriptor = PhiServerAddonRoleGuarded & {
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
 * One page of a select, and whether there is another.
 *
 * `cursor` present means there is more; absent means that was everything. It is the one promise a
 * consumer can neither detect nor repair on its own -- a truncated answer is indistinguishable from a
 * complete one unless the answer says so -- and Core keeps it by reading one row more than it returns,
 * which costs a row and no count.
 *
 * The cursor is opaque. It encodes the ordering it was made for and is refused by a query with a
 * different one, because paging on somebody else's order silently skips and repeats rows.
 */
export type PhiServerAddonQueryPage = {
  rows: PhiServerAddonQueryRow[];
  cursor: string | null;
};

/** What a caller asks for a page, beside the query's own parameters. */
export type PhiServerAddonQueryPageRequest = {
  /** A wish. Core takes the smallest of this, the descriptor's `limit`, and the hard maximum. */
  limit?: number;
  /** From a previous page. Absent starts at the beginning. */
  cursor?: string | null;
};

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
 *
 * A select answers with a page. There is no method that returns everything, because the caller who
 * wanted everything is the one who brings the instance down.
 */
export type PhiServerDataCapabilityV1 = {
  select(
    name: string,
    args?: PhiServerAddonQueryArguments,
    page?: PhiServerAddonQueryPageRequest,
  ): Promise<PhiServerAddonQueryPage>;
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
