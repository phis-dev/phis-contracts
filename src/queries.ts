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

/**
 * What a declared parameter holds. Narrower than the column vocabulary: these travel as values.
 *
 * `json` is the one that is not a scalar, and it is deliberately the one that cannot be compared. It
 * may be assigned to a `json` column and used nowhere else -- not in `compare`, not in `contains`, not
 * in `in`, not in `whenPresent`. A document one could filter on would need paths, operators and an
 * index vocabulary to go with them, and that is a second query language growing inside the one this
 * file exists to keep small. What it is for is the other half: a column declared `json` had no way to
 * be written at all, so an Add-on could store a document only by never storing one.
 */
export type PhisAddonQueryParameterType =
  | "integer"
  | "bigInteger"
  | "text"
  | "boolean"
  | "instant"
  | "uuid"
  | "json";

export type PhisAddonQueryParameter = {
  name: string;
  type: PhisAddonQueryParameterType;
  /** Whether the caller may pass null. Absent means it may not. */
  nullable?: boolean;
  /**
   * Whether this parameter carries many values rather than one.
   *
   * Only usable by `in`, and the reason `in` is worth having at all. Its other form takes values fixed
   * in the descriptor, which answers "one of these three states" and nothing a caller brings -- and the
   * commonest need is exactly that: the rows belonging to the page that was just read, whose keys are
   * known only at request time.
   *
   * It stays one binding. Core writes `= ANY($n::TYPE[])` rather than expanding the list into the
   * statement, so the query has one shape however many values arrive; a statement whose text grew with
   * its arguments would be assembled at request time, which is the thing this file exists to prevent.
   * Core caps the length, because a list is an unbounded read wearing a parameter.
   */
  list?: boolean;
};

/**
 * Where a value in a query comes from.
 *
 * `actor` is the point of the list. "My rows" is the commonest filter there is, and letting an Add-on
 * pass the acting user's id would mean trusting it to pass the right one. Core substitutes its own
 * bound actor, so the query cannot be aimed at somebody else -- the same reason the capability closes
 * over the Site instead of taking it as an argument.
 */
export type PhisAddonQueryValue =
  | { kind: "parameter"; name: string }
  | { kind: "literal"; value: string | number | boolean }
  /** The acting user's id, substituted by Core. Null when nobody is acting, which matches nothing. */
  | { kind: "actor" }
  | { kind: "now" };

export type PhisAddonQueryComparison = "=" | "<>" | "<" | "<=" | ">" | ">=";

/**
 * A condition, as a tree of a closed set of shapes.
 *
 * No expressions, no functions, no patterns an Add-on writes. `LIKE` is absent for the reason regular
 * expressions are absent from the schema descriptor: its escaping and collation behaviour differ
 * between database systems, and taking it would buy back the dependency this exists to remove. What
 * replaces it is `contains`, an operator: the Add-on names a column and a value, and Core decides how
 * that is spelled and escaped.
 */
export type PhisAddonQueryCondition =
  | {
      kind: "compare";
      column: string;
      operator: PhisAddonQueryComparison;
      value: PhisAddonQueryValue;
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
  | { kind: "contains"; column: string; value: PhisAddonQueryValue }
  /** One of a set fixed in the descriptor: a state, a kind, a handful of names the Add-on knows. */
  | { kind: "in"; column: string; values: PhisAddonQueryValue[]; parameter?: never }
  /**
   * One of a set the caller brings, named by a `list` parameter.
   *
   * What makes a second query about the same rows possible: read a page, then ask something else about
   * exactly those keys. Without it the second question can only be asked one row at a time or about the
   * whole table, and neither is a page.
   */
  | { kind: "in"; column: string; parameter: string; values?: never }
  | { kind: "all"; conditions: PhisAddonQueryCondition[] }
  | { kind: "any"; conditions: PhisAddonQueryCondition[] }
  /**
   * A condition that applies only when its parameter was given.
   *
   * A listing has filters the caller may or may not set, and a declared query has one fixed `where`.
   * Without this, every combination is its own query -- three optional filters are eight of them, four
   * are sixteen, each declared, validated and kept in step by hand. The parameter must be nullable, and
   * null means the condition is not there rather than that it matched nothing.
   */
  | { kind: "whenPresent"; parameter: string; condition: PhisAddonQueryCondition };

export type PhisAddonQueryOrdering = {
  column: string;
  direction: "asc" | "desc";
};

export type PhisAddonQueryAssignment = {
  column: string;
  value: PhisAddonQueryValue;
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
type PhisAddonRoleGuarded = {
  /** Names a role this Add-on's manifest declares. Absent means the query needs none. */
  requiresRole?: string;
  /**
   * A role that stands in for the row's own authority, where the ladder alone would say no.
   *
   * The other direction, and the one moderation needs. `requiresRole` narrows: it asks for the role on
   * top of the ladder, and on an owned table that means role *and* owner -- which nobody moderating a
   * stranger's row can ever be. This one widens: the row is judged first, and a caller the ladder turned
   * down is let through on the role instead. The owner keeps reaching their own row without any role at
   * all.
   *
   * It is a bypass, and it is named so that writing it down feels like declaring one. An Add-on that
   * hands a role the run of a table is making a real statement about that role, and it should be visible
   * in the descriptor rather than inferred from the absence of something.
   *
   * Only on `update` and `delete`, which are the only places a row is judged, and only on a table that
   * has authority to bypass. Not combined with `requiresRole`: a query needing both a narrowing and a
   * widening role is two queries wearing one name.
   */
  alsoAllowedByRole?: string;
};

export type PhisAddonSelectQueryDescriptor = PhisAddonRoleGuarded & {
  kind: "select";
  name: string;
  table: string;
  /** Absent means every declared column. Core's scope columns are never among them. */
  columns?: string[];
  where?: PhisAddonQueryCondition;
  orderBy?: PhisAddonQueryOrdering[];
  /**
   * The largest page this query will ever serve, whatever the caller asks for.
   *
   * The Add-on's own ceiling, not the page size: a call may ask for less, and Core takes the smallest of
   * the request, this, and `PHIS_ADDON_QUERY_MAX_LIMIT`.
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
export type PhisAddonInsertQueryDescriptor = PhisAddonRoleGuarded & {
  kind: "insert";
  name: string;
  table: string;
  values: PhisAddonQueryAssignment[];
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
export type PhisAddonUpdateQueryDescriptor = PhisAddonRoleGuarded & {
  kind: "update";
  name: string;
  table: string;
  set: PhisAddonQueryAssignment[];
  /** Names the parameter carrying the row's primary key value. */
  idParameter: string;
};

export type PhisAddonDeleteQueryDescriptor = PhisAddonRoleGuarded & {
  kind: "delete";
  name: string;
  table: string;
  idParameter: string;
};

/**
 * `count` without a column counts rows; every other function names one.
 *
 * `sum` and `avg` want an integer column, and validation says so rather than letting PostgreSQL raise it
 * at the first call: a manifest that averages a text column is wrong when it is written, not when it is
 * run. `avg` comes back as a string, because it is `numeric` and a JavaScript number is not.
 */
export type PhisAddonAggregateFunction = "count" | "sum" | "avg" | "min" | "max";

export type PhisAddonQueryAggregate = {
  function: PhisAddonAggregateFunction;
  column?: string;
  /** What the value is called in the answer. Must not collide with a grouping column. */
  as: string;
};

/**
 * Counting and summarising rows instead of returning them.
 *
 * The question a select cannot answer: "how many" and "what on average", per something. Without it an
 * Add-on reads every row to count them, which is the unbounded read paging exists to prevent, or keeps a
 * running total in a column of its own -- a number Core cannot hold true and that drifts the first time
 * a write is lost.
 *
 * It reads no row a select could not have read. The ladder is not consulted for either: what a query may
 * see is what the query says, `actor` and all, and an aggregate over rows the caller may not read one by
 * one is an aggregate the Add-on wrote that way deliberately. What changes here is arithmetic, not
 * reach.
 *
 * `groupBy` decides the shape of the answer. Without it there is exactly one row and no paging. With it
 * there is one row per group, paged like a select -- and the grouping columns are the ordering, which is
 * total by construction, since `GROUP BY` yields each combination once. That is also why they must be
 * `NOT NULL`, and why there is no ordering by an aggregated value: ranking by an average would page on a
 * key that is neither unique nor known before the group is computed.
 */
export type PhisAddonAggregateQueryDescriptor = PhisAddonRoleGuarded & {
  kind: "aggregate";
  name: string;
  table: string;
  aggregates: PhisAddonQueryAggregate[];
  where?: PhisAddonQueryCondition;
  groupBy?: string[];
  /** The Add-on's ceiling on groups per page. Required with `groupBy`, meaningless without it. */
  limit?: number;
};

export type PhisAddonQueryDescriptor =
  | PhisAddonSelectQueryDescriptor
  | PhisAddonInsertQueryDescriptor
  | PhisAddonUpdateQueryDescriptor
  | PhisAddonDeleteQueryDescriptor
  | PhisAddonAggregateQueryDescriptor;

/** The most rows one declared `select` may return, whatever it asks for. */
export const PHIS_ADDON_QUERY_MAX_LIMIT = 500 as const;

/**
 * The most values one `list` parameter may carry.
 *
 * A page's worth, because that is what it is for: the keys just read, asked about again. Larger, and it
 * is the unbounded read paging removed, arriving through the one door that still accepts a caller's
 * count. Exceeding it is refused rather than truncated -- a silently shortened list answers about some
 * of the rows and says it answered about all of them.
 */
export const PHIS_ADDON_QUERY_MAX_LIST = 500 as const;

export type PhisAddonQueryCatalog = {
  parameters: Readonly<Record<string, PhisAddonQueryParameter[]>>;
  queries: PhisAddonQueryDescriptor[];
};

/**
 * A document a `json` parameter carries, which is whatever survives a round trip through JSON.
 *
 * Not narrowed further, because the column is not narrowed either: a `json` column takes any document,
 * and a type here that took less would describe a restriction the store does not have.
 */
export type PhisAddonQueryJson =
  | { readonly [key: string]: unknown }
  | readonly unknown[];

export type PhisAddonQueryArguments = Readonly<
  Record<
    string,
    string | number | boolean | null | readonly (string | number)[] | PhisAddonQueryJson
  >
>;

export type PhisAddonQueryRow = Readonly<Record<string, unknown>>;

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
export type PhisAddonQueryPage = {
  rows: PhisAddonQueryRow[];
  cursor: string | null;
};

/** What a caller asks for a page, beside the query's own parameters. */
export type PhisAddonQueryPageRequest = {
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
 * Every mutation answers with the row it wrote and `null` where it wrote none. `null` means the row was
 * not there or was not the caller's to change, and the two are deliberately the same answer: telling
 * them apart would report the existence of a row the caller may not have. The row itself withholds
 * nothing further, because it comes back only when the write it describes actually happened.
 *
 * A select answers with a page. There is no method that returns everything, because the caller who
 * wanted everything is the one who brings the instance down.
 */
export type PhisDataCapabilityV1 = {
  select(
    name: string,
    args?: PhisAddonQueryArguments,
    page?: PhisAddonQueryPageRequest,
  ): Promise<PhisAddonQueryPage>;
  /**
   * Counting and summarising, as a page for the same reason a select is one.
   *
   * A grouped aggregate has as many rows as there are groups, which is a number the Add-on does not know
   * either. Ungrouped, the page holds one row and carries no cursor.
   */
  aggregate(
    name: string,
    args?: PhisAddonQueryArguments,
    page?: PhisAddonQueryPageRequest,
  ): Promise<PhisAddonQueryPage>;
  /** Returns the inserted row, with the scope columns Core filled in. */
  insert(name: string, args?: PhisAddonQueryArguments): Promise<PhisAddonQueryRow | null>;
  /**
   * Returns the row as it stands after the write, or `null` when nothing was written.
   *
   * The row rather than a count, because what was sent and what is now stored are not the same thing
   * wherever a default, a constraint, or a column the query did not name had a say.
   */
  update(
    name: string,
    args?: PhisAddonQueryArguments,
  ): Promise<PhisAddonQueryRow | null>;
  /**
   * Returns the row that was removed, or `null` when nothing was.
   *
   * The row is the only thing a delete can give that a count cannot, and it is needed: a row naming an
   * object in the Add-on's store is the last record of that object, and once the statement has run there
   * is nothing left to ask. The bytes would stay, counted against the quota, belonging to nobody.
   */
  delete(
    name: string,
    args?: PhisAddonQueryArguments,
  ): Promise<PhisAddonQueryRow | null>;
  /**
   * One unit of work. Everything inside commits together or not at all.
   *
   * The handle offers the same five operations and nothing else -- no commit, no rollback, no
   * savepoint. Returning ends the transaction; throwing rolls it back. An Add-on cannot leave one
   * open, because it never holds the thing that would stay open.
   */
  transaction<T>(body: (tx: PhisDataTransactionV1) => Promise<T>): Promise<T>;
};

export type PhisDataTransactionV1 = Omit<PhisDataCapabilityV1, "transaction">;
