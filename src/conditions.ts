/**
 * The grammar of a runtime condition: when a Widget shows, when a Form field is visible or disabled.
 *
 * Stored inside descriptors phis-server keeps, a Form's `visibleWhen` among them, so it is read here and
 * read once -- the renderer evaluates what the server accepted, by the same rules.
 */
import {
  readPhiControllerSignalAddress,
  readPhiSignalAddress,
  type PhiControllerSignalAddress,
  type PhiSignalAddress,
} from "./signals.js";
import { readPhiControlOptionFlags } from "./controls.js";
import { isPhiRecord, readPhiDotPath } from "./record.js";

/**
 * Where a condition reads the value it judges.
 *
 * `row`, `form`, `controller` and `widget` are values the page produced: a record under the cursor, what
 * has been typed, what a Controller holds, what a neighbouring Widget found out. `feature` is what this
 * Site was configured to have -- a named fact a Module publishes about its own setup, such as whether a
 * sign-in method is switched on, settled before anything renders and never seen by the browser. `page`
 * is the one the visitor arrived with --
 * the address of the page they opened, which is state as much as any of the others and the only kind
 * that is already settled before the first Widget renders. A confirmation link carries its token there,
 * an external login returns with its outcome there, and a Widget that should appear only for one of
 * those can say so without a component of its own to read the query string.
 *
 * `record` is the record the Page is about, read through the fields its Provider declares: `valuePath`
 * names a field by its key, the same key a Widget's `recordField` names, and reads the value that field
 * has. It is settled on the server, where the record is read once before anything renders, and never
 * handed to the browser. A record without the field answers as a value that is not there -- `truthy` does
 * not hold -- which is how a Widget bound to a field the record may lack takes its place in the Layout
 * with it rather than leaving an empty slot.
 */
export const PHI_RUNTIME_CONDITION_SOURCES = ["row", "form", "controller", "page", "widget", "feature", "record"] as const;
/**
 * How a condition judges what it reads. `truthy`, `falsy`, `equals`, `notEquals` and `contains` judge the
 * value at `valuePath`. `optionFlag` judges the option chosen there instead: `source: "form"` only,
 * `valuePath` a field of the same Form that offers options, and it holds where the chosen option carries
 * every bit of `flag` (`PhiControlOption.flags`) -- so a field can follow what a choice is, not which value
 * it has.
 *
 * `truthy` holds for a value JavaScript calls truthy, except an empty list, which holds nothing and is
 * falsy -- a multiple choice with nothing chosen is not a choice made. `falsy` is its opposite. `equals`
 * holds where the value is the condition's `value`, the same type included (`Object.is`: the number 2 is
 * not the text "2"); `notEquals` where it is not, which a value that is not there is not either.
 * `contains` holds for a list with an entry that equals `value`, and for a text containing `value` as text.
 */
export const PHI_RUNTIME_CONDITION_OPERATORS = ["truthy", "falsy", "equals", "notEquals", "contains", "optionFlag"] as const;
export const PHI_RUNTIME_CONDITION_GROUP_MATCHES = ["all", "any"] as const;

export type PhiRuntimeConditionSource = (typeof PHI_RUNTIME_CONDITION_SOURCES)[number];
export type PhiRuntimeConditionOperator = (typeof PHI_RUNTIME_CONDITION_OPERATORS)[number];
export type PhiRuntimeConditionGroupMatch = (typeof PHI_RUNTIME_CONDITION_GROUP_MATCHES)[number];
/** What `equals`, `notEquals` and `contains` compare with: a text, a finite number, a yes or no, or null. */
export type PhiRuntimeConditionValue = string | number | boolean | null;

export type PhiRuntimeValueCondition = {
  source: PhiRuntimeConditionSource;
  controllerAddress?: PhiControllerSignalAddress;
  /**
   * Which Widget is being asked, for a `widget` condition.
   *
   * A Controller is state that outlives the Widgets reading it; a Widget reports only what it found out
   * for itself. Both answer on the same channel, so a Widget beside another one -- a preview of what a
   * link will do, next to the form that does it -- needs no Controller of its own to be composed with.
   */
  widgetAddress?: PhiSignalAddress;
  valuePath: string;
  operator: PhiRuntimeConditionOperator;
  value?: PhiRuntimeConditionValue;
  /**
   * The bits an `optionFlag` condition asks of the chosen option, all of them: a whole number from 1 to
   * `PHI_CONTROL_OPTION_FLAGS_MAX`. Required with `optionFlag` and absent with every other operator.
   */
  flag?: number;
  /**
   * How to read a sender that has not said anything yet. Absent means "not matched".
   *
   * Hiding until told is right for a fact that is being fetched: a form that spends a confirmation link
   * must not appear before the link has been checked. It is wrong for a state that only a later action
   * can bring about -- nobody is halfway through a second authentication factor when the page opens, so
   * a Widget standing back "while a step is under way" would stand back forever, waiting for a report
   * that nothing is happening.
   */
  whenUnavailable?: PhiRuntimeConditionResult;
  reason?: string;
};

export type PhiRuntimeConditionExpression =
  | PhiRuntimeValueCondition
  | {
      match: PhiRuntimeConditionGroupMatch;
      conditions: readonly PhiRuntimeConditionExpression[];
    };

export type PhiRuntimeConditionResult = "matched" | "not-matched" | "unavailable";

/**
 * The address of the page as the visitor opened it, which is what a `page` condition reads.
 *
 * A missing query parameter is an answer rather than a gap: `falsy` on `query.token` matches on the
 * page without one, which is how a form with two stages knows which of them it is on.
 */
export type PhiRuntimePageConditionState = {
  path: string;
  query: Readonly<Record<string, string>>;
};

/**
 * What the active Modules report about this Site's configuration, by namespaced name.
 *
 * A Module publishes these the way it publishes signal capabilities: deliberately, under a name it
 * keeps. A condition reads `auth.password`, not a field of somebody's internal context, so renaming
 * something inside a Module cannot silently change which Widgets a page shows.
 */
export type PhiRuntimeFeatureState = Readonly<Record<string, unknown>>;

export type PhiRuntimeConditionSourceValues = {
  row?: Record<string, unknown> | null;
  features?: PhiRuntimeFeatureState | null;
  form?: Record<string, unknown> | null;
  controllers?: Readonly<Record<string, Record<string, unknown>>> | null;
  /** Reported by Widgets, keyed by the address each one sends from. */
  widgets?: Readonly<Record<string, Record<string, unknown>>> | null;
  page?: PhiRuntimePageConditionState | null;
  /** The fields of the record the Page is about, by key, each as the value it has. */
  record?: Readonly<Record<string, unknown>> | null;
  /**
   * What an `optionFlag` condition reads: per field key of the Form, the `flags` of the option chosen
   * there -- of every chosen option together for a field that holds several, 0 for a field that holds
   * nothing or whose option carries none. A field whose chosen option is not known (yet), its options
   * still loading, is absent, and the condition is unavailable.
   */
  formOptionFlags?: Readonly<Record<string, number>> | null;
};

export type PhiRuntimeConditionStateSignalValue = {
  state: Record<string, unknown>;
};

function readConditionValue(value: unknown): PhiRuntimeConditionValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readConditionSource(value: unknown): PhiRuntimeConditionSource | null {
  return PHI_RUNTIME_CONDITION_SOURCES.includes(value as PhiRuntimeConditionSource)
    ? value as PhiRuntimeConditionSource
    : null;
}

export function readPhiRuntimeValueCondition(value: unknown): PhiRuntimeValueCondition | null {
  if (!isPhiRecord(value)) return null;
  const source = readConditionSource(value.source);
  const operator = PHI_RUNTIME_CONDITION_OPERATORS.includes(value.operator as PhiRuntimeConditionOperator)
    ? value.operator as PhiRuntimeConditionOperator
    : null;
  const flag = operator === "optionFlag" ? readPhiControlOptionFlags(value.flag) : undefined;
  const valuePath = typeof value.valuePath === "string" ? value.valuePath.trim() : "";
  const whenUnavailable = value.whenUnavailable === "matched" || value.whenUnavailable === "not-matched"
    ? value.whenUnavailable
    : undefined;
  const controllerAddress = source === "controller"
    ? readPhiControllerSignalAddress(value.controllerAddress)
    : undefined;
  const widgetAddress = source === "widget"
    ? readPhiSignalAddress(value.widgetAddress)
    : undefined;
  const conditionValue = readConditionValue(value.value);
  if (
    !source ||
    !operator ||
    !valuePath ||
    (source === "controller" && !controllerAddress) ||
    (source === "widget" && !widgetAddress) ||
    (operator === "optionFlag" && (source !== "form" || flag === undefined || value.value !== undefined)) ||
    (operator !== "optionFlag" && value.flag !== undefined) ||
    (operator !== "truthy" && operator !== "falsy" && operator !== "optionFlag" && conditionValue === undefined)
  ) {
    return null;
  }
  return {
    source,
    controllerAddress,
    widgetAddress,
    valuePath,
    operator,
    whenUnavailable,
    value: operator === "truthy" || operator === "falsy" || operator === "optionFlag" ? undefined : conditionValue,
    ...(flag !== undefined ? { flag } : {}),
    reason: typeof value.reason === "string" && value.reason.trim() ? value.reason.trim() : undefined,
  };
}

export function readPhiRuntimeConditionExpression(value: unknown): PhiRuntimeConditionExpression | null {
  const leaf = readPhiRuntimeValueCondition(value);
  if (leaf) return leaf;
  if (!isPhiRecord(value) || (value.match !== "all" && value.match !== "any") || !Array.isArray(value.conditions)) {
    return null;
  }
  const conditions = value.conditions.map(readPhiRuntimeConditionExpression);
  if (conditions.length === 0 || conditions.some((condition) => condition == null)) {
    return null;
  }
  return {
    match: value.match,
    conditions: conditions as PhiRuntimeConditionExpression[],
  };
}

export function collectPhiRuntimeValueConditions(
  expression: PhiRuntimeConditionExpression | null | undefined,
): PhiRuntimeValueCondition[] {
  if (!expression) return [];
  if ("source" in expression) return [expression];
  return expression.conditions.flatMap(collectPhiRuntimeValueConditions);
}

export function combinePhiRuntimeConditionExpressions(
  match: PhiRuntimeConditionGroupMatch,
  expressions: readonly (PhiRuntimeConditionExpression | null | undefined)[],
): PhiRuntimeConditionExpression | undefined {
  const conditions = expressions.filter((entry): entry is PhiRuntimeConditionExpression => Boolean(entry));
  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return { match, conditions };
}

export function readPhiRuntimeConditionStateSignalValue(
  value: unknown,
): PhiRuntimeConditionStateSignalValue | null {
  return isPhiRecord(value) && isPhiRecord(value.state) ? { state: value.state } : null;
}

export function readPhiRuntimeConditionValue(input: unknown, valuePath: string): unknown {
  return readPhiDotPath(input, valuePath);
}

function resolvePhiRuntimeConditionSource(
  condition: PhiRuntimeValueCondition,
  sources: PhiRuntimeConditionSourceValues,
): Record<string, unknown> | null {
  if (condition.source === "row") return sources.row ?? null;
  if (condition.source === "form") return sources.form ?? null;
  if (condition.source === "page") return sources.page ?? null;
  if (condition.source === "feature") return sources.features ?? null;
  if (condition.source === "record") return sources.record ?? null;
  if (condition.source === "widget") {
    return condition.widgetAddress ? sources.widgets?.[condition.widgetAddress] ?? null : null;
  }
  return condition.controllerAddress
    ? sources.controllers?.[condition.controllerAddress] ?? null
    : null;
}

export function matchesPhiRuntimeValueCondition(
  condition: PhiRuntimeValueCondition,
  sources: PhiRuntimeConditionSourceValues,
) {
  if (condition.operator === "optionFlag") {
    const flags = sources.formOptionFlags?.[condition.valuePath];
    return flags !== undefined && condition.flag !== undefined && (flags & condition.flag) === condition.flag;
  }
  const source = resolvePhiRuntimeConditionSource(condition, sources);
  if (source == null) return false;
  const current = readPhiRuntimeConditionValue(source, condition.valuePath);
  if ((condition.source === "controller" || condition.source === "widget") && current === undefined) return false;
  // An empty list holds nothing: a multiple choice with nothing chosen is falsy.
  const truthy = Array.isArray(current) ? current.length > 0 : Boolean(current);
  if (condition.operator === "truthy") return truthy;
  if (condition.operator === "falsy") return !truthy;
  if (condition.operator === "equals") return Object.is(current, condition.value);
  if (condition.operator === "notEquals") return !Object.is(current, condition.value);
  return Array.isArray(current)
    ? current.some((entry) => Object.is(entry, condition.value))
    : typeof current === "string" && typeof condition.value === "string"
      ? current.includes(condition.value)
      : false;
}

export function evaluatePhiRuntimeConditionExpression(
  expression: PhiRuntimeConditionExpression,
  sources: PhiRuntimeConditionSourceValues,
): PhiRuntimeConditionResult {
  if ("source" in expression) {
    if (expression.operator === "optionFlag") {
      if (sources.formOptionFlags?.[expression.valuePath] === undefined) {
        return expression.whenUnavailable ?? "unavailable";
      }
      return matchesPhiRuntimeValueCondition(expression, sources) ? "matched" : "not-matched";
    }
    const source = resolvePhiRuntimeConditionSource(expression, sources);
    if (source == null) return expression.whenUnavailable ?? "unavailable";
    if (
      (expression.source === "controller" || expression.source === "widget") &&
      readPhiRuntimeConditionValue(source, expression.valuePath) === undefined
    ) {
      return expression.whenUnavailable ?? "unavailable";
    }
    return matchesPhiRuntimeValueCondition(expression, sources) ? "matched" : "not-matched";
  }

  const results = expression.conditions.map((condition) =>
    evaluatePhiRuntimeConditionExpression(condition, sources));
  if (expression.match === "all") {
    if (results.some((result) => result === "not-matched")) return "not-matched";
    return results.every((result) => result === "matched") ? "matched" : "unavailable";
  }
  if (results.some((result) => result === "matched")) return "matched";
  return results.every((result) => result === "not-matched") ? "not-matched" : "unavailable";
}
