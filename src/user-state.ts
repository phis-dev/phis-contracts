/**
 * What a person decided, kept per Site under a key a Module owns.
 *
 * Two ends have to agree about it and neither can defer to the other. phis stores it on the membership
 * row and is the only party that validates a write; `@phis/ui` declares the keys in a Module descriptor,
 * reads them while rendering, and has to know before it renders what shape it will get back. A second
 * spelling of the shapes in either end is the one that drifts, which is why they are here and not there.
 *
 * What this is not: a session, a cache, or a Module's own records. It holds decisions -- a dismissed
 * card, a read marker, where somebody is in a guided sequence -- and losing one must be an annoyance
 * rather than a support case. Core's own account facts stay bit flags on `user_accounts.flags` and
 * `user_site_memberships.user_site_flags`, because those are finite and Core allocates them; the reason
 * this exists at all is that bits cannot be handed to an unknown number of Modules.
 */

/**
 * The shapes a value may have, closed on purpose.
 *
 * An open value invites the list that grows forever. Every shape here answers a question that a
 * general-purpose JSON blob would also answer, and answers it in a form whose cost is known in advance.
 */
export const PHIS_USER_STATE_SHAPES = ["flag", "marker", "value", "set"] as const;

export type PhisUserStateShape = (typeof PHIS_USER_STATE_SHAPES)[number];

export function isPhisUserStateShape(value: unknown): value is PhisUserStateShape {
  return typeof value === "string" && (PHIS_USER_STATE_SHAPES as readonly string[]).includes(value);
}

/**
 * `<module id>/<key>` -- the owning Module's own id in front, as a Widget type already carries it
 * (`@phis/example/modules/site/widgets/note`).
 *
 * The prefix is not decoration, it is the whole authorization. A Site's active Module ids are already
 * published, so phis answers "may this be written" by asking whether the key begins with the id of a
 * Module this Site has switched on -- and needs to know nothing about the key itself. Which is also why
 * the id and not the package name: a package may carry two Modules and a Site may run one of them.
 */
export type PhisUserStateKey = `${string}/${string}`;

export const PHIS_USER_STATE_MAX_KEY_LENGTH = 128;

const PHIS_USER_STATE_KEY_PATTERN =
  /^(@[a-z0-9-][a-z0-9._-]*\/)?[a-z0-9-][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)+$/;

export function isPhisUserStateKey(value: unknown): value is PhisUserStateKey {
  return typeof value === "string" &&
    value.length <= PHIS_USER_STATE_MAX_KEY_LENGTH &&
    PHIS_USER_STATE_KEY_PATTERN.test(value);
}

/** One bit under one key: a dismissed card, a hint somebody turned off. */
export type PhisUserStateFlag = boolean;

/**
 * One value that only ever moves forward: "read up to here".
 *
 * A marker is what keeps a feed affordable, because one number answers a question a set answers only by
 * growing. It is also the one shape where "the last write wins" is the wrong rule -- a second tab
 * answering late would move the mark backwards and unread what somebody read -- so a write that does not
 * increase it is accepted and changes nothing, rather than being refused or applied.
 */
export type PhisUserStateMarker = number;

/** One JSON document under a declared schema: a state machine's position, and its like. */
export type PhisUserStateValue = Record<string, unknown>;

/**
 * A bounded collection, in insertion order, for what a marker genuinely cannot express.
 *
 * The limit is declared rather than assumed, and reaching it drops the oldest entry instead of refusing
 * the write: a set that refuses is a set that silently stops recording, which is the failure that is
 * noticed last.
 */
export type PhisUserStateSet = readonly string[];

export type PhisUserStateStoredValue =
  | PhisUserStateFlag
  | PhisUserStateMarker
  | PhisUserStateValue
  | PhisUserStateSet;

export const PHIS_USER_STATE_MAX_SET_LIMIT = 256;

/**
 * How much one Module's namespace may weigh, serialized.
 *
 * The membership row travels with every request that resolves a session, so this is paid for constantly
 * and by everybody. It is a ceiling on a Module's whole namespace rather than on one key, because
 * splitting a large value across ten keys is the obvious way around a per-key limit.
 */
export const PHIS_USER_STATE_MAX_SERIALIZED_BYTES = 4096;

/**
 * What a Module says it keeps, and what a write is checked against.
 *
 * This is contract discipline rather than authorization, and it does not travel to phis. A Module
 * declaring its keys lets the browser refuse a malformed write before sending one, and makes what a
 * Module stores readable from its own source. What phis checks is the prefix -- an active Module's id --
 * and the value against the shape the write itself names, because a Module that calls one key a flag
 * today and a marker tomorrow damages only its own data.
 *
 * Both ends check a write with `readPhisUserStateWrite`, which asks for less than this: the browser hands
 * it the declaration, phis the shape the write names, clamping `limit` to
 * `PHIS_USER_STATE_MAX_SET_LIMIT` because that one arrives from outside.
 *
 * `default` is deliberately absent -- an unwritten key is absent, and what absence means belongs to the
 * Module reading it, which is not the same question as what value to start from.
 */
export type PhisDeclarableUserStateKey =
  | { readonly key: PhisUserStateKey; readonly shape: "flag" }
  | { readonly key: PhisUserStateKey; readonly shape: "marker" }
  | {
      readonly key: PhisUserStateKey;
      readonly shape: "value";
      readonly valueSchema: import("./signals.js").PhiSignalValueSchema;
    }
  | { readonly key: PhisUserStateKey; readonly shape: "set"; readonly limit: number };

export function isPhisDeclarableUserStateKey(value: unknown): value is PhisDeclarableUserStateKey {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (!isPhisUserStateKey(record.key) || !isPhisUserStateShape(record.shape)) return false;
  if (record.shape === "value") {
    return typeof record.valueSchema === "string" && record.valueSchema.includes("/signals/");
  }
  if (record.shape === "set") {
    return typeof record.limit === "number" &&
      Number.isSafeInteger(record.limit) &&
      record.limit > 0 &&
      record.limit <= PHIS_USER_STATE_MAX_SET_LIMIT;
  }
  return true;
}

/**
 * What checking a write actually needs: the shape, and a set's limit.
 *
 * Deliberately less than a declaration. The key does not take part in deciding whether a value is
 * admissible, and phis has no declaration to hand -- requiring one would only make it invent the fields
 * it does not use. A `PhisDeclarableUserStateKey` satisfies this, so the browser passes its declaration
 * straight through.
 */
export type PhisUserStateWriteShape =
  | { readonly shape: "flag" }
  | { readonly shape: "marker" }
  | { readonly shape: "value" }
  | { readonly shape: "set"; readonly limit: number };

/**
 * The value a write may store, or `null` when the shape does not admit it.
 *
 * Both ends call this -- phis before it writes, `@phis/ui` before it sends -- but they are not equals.
 * The two packages ship separately and may be different versions of this file, so the browser's check is
 * a saved round trip and never a substitute: phis checks again from its own copy and its answer is the
 * one that counts. A shape a server does not know is refused there rather than stored and read back as
 * something else, which is what keeps a newer Module against an older server a clear error instead of a
 * quiet corruption.
 *
 * `stored` is what the key already holds, needed by the two shapes whose answer depends on it -- a
 * marker that may not move backwards, and a set that evicts once it is full.
 */
export function readPhisUserStateWrite(
  descriptor: PhisUserStateWriteShape,
  value: unknown,
  stored?: PhisUserStateStoredValue | null,
): { value: PhisUserStateStoredValue } | null {
  switch (descriptor.shape) {
    case "flag":
      return typeof value === "boolean" ? { value } : null;
    case "marker": {
      if (typeof value !== "number" || !Number.isFinite(value)) return null;
      const current = typeof stored === "number" ? stored : Number.NEGATIVE_INFINITY;
      return { value: value > current ? value : current };
    }
    case "value":
      return value && typeof value === "object" && !Array.isArray(value)
        ? { value: value as PhisUserStateValue }
        : null;
    case "set": {
      if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) return null;
      const entries = [...new Set(value as string[])];
      return { value: entries.slice(Math.max(0, entries.length - descriptor.limit)) };
    }
  }
}
