/**
 * The Form descriptor: what a form's fields are, how they are laid out on its grid, what it says when
 * it succeeds or is refused -- and the one parser that decides whether a stored value is one.
 *
 * A descriptor is written by a Module's preset or by the Form Builder, stored by phis-server and drawn
 * by the site UI. All three read it here, so a descriptor the server accepts is one the renderer can
 * draw, and the other way round. What stays in the UI is how the grid becomes CSS.
 */
import {
  collectPhiRuntimeValueConditions,
  readPhiRuntimeConditionExpression,
  type PhiRuntimeConditionExpression,
} from "./conditions.js";
import {
  PHI_CONTROL_OPTION_FLAGS_MAX,
  parsePhiControlOptionsProviderConfig,
  readPhiControlOptionFlags,
  type PhiControlOption,
  type PhiControlOptionsProviderConfig,
} from "./controls.js";
import {
  isPhiSpacingToken,
  type PhiSpacingToken,
} from "./layout.js";
import { isPhiRecord } from "./record.js";

export type PhiFormProviderKey = `${string}/${string}`;

export type PhiFormLabelSetKey = `${string}/${string}`;

export const PHI_FORM_DESCRIPTOR_SCHEMA_VERSION = 1 as const;

/**
 * Where a piece of a form's wording comes from.
 *
 * `literal` is the word itself. `label` is a key into the form's label set, which is how anything a
 * visitor reads gets translated. `config` is a value the Widget was placed with -- the target of a
 * consent link, say, which is a property of where the form stands rather than of the form: the same
 * registration form points at one site's terms in one Area and another's elsewhere, and only the
 * placement knows which, and in which language's path.
 */
export type PhiFormTextDescriptor =
  | {
      kind: "literal";
      value: string;
    }
  | {
      kind: "label";
      key: string;
      fallback: string;
    }
  | {
      kind: "config";
      key: string;
      fallback: string;
    };

/** The number of tracks every form grid is divided into. */
export const PHI_FORM_GRID_TRACKS = 24 as const;

/**
 * Where one element lies on the form grid, written the way CSS Grid writes it: `start` is the line the
 * element begins at and `end` is the line it stops before, both counted from 1, so the last line is 25.
 *
 * A range rather than a width, because a width can only say how much room something takes and never
 * where the room is. A label at 1-7 with an input at 7-19 leaves 19-25 empty, and a tool button can
 * then say 21-25 and stand in that gap on the same row -- neither of which a span can express. Ranges
 * also carry the responsive case without a second concept: a label at 1-25 above an input at 1-25 is
 * the stacked form, because two elements that both claim the whole width cannot share a row.
 */
export type PhiFormGridRange = {
  /** First line the element occupies, 1 to 24. */
  start: number;
  /** Line the element stops before, 2 to 25. Exclusive, as in CSS. */
  end: number;
};

/**
 * A value per measured Form width: `compact` below 377px, `medium` from 377px, `wide` from 610px and
 * `spacious` from 987px (the site UI's `PHI_CONTAINER_BREAKPOINT_COL3`, `_CONTENT` and `_REGION`;
 * owner, 2026-11-26).
 *
 * The Form's own and not the layout vocabulary's `PhiResponsiveValue`, which the Grid and the Masonry
 * share: a fourth step for a Form running the width of a Region is a Form's question, and a Grid that
 * never asked for one would otherwise have to answer it. A stated value cascades upwards to the wider
 * modes (`resolvePhiFormResponsiveValue`), so a descriptor that says nothing of `spacious` draws there
 * what it draws at `wide`.
 */
export type PhiFormResponsiveValue<TValue> = {
  compact?: TValue;
  medium?: TValue;
  wide?: TValue;
  spacious?: TValue;
};

export type PhiResolvedFormResponsiveValue<TValue> = {
  compact: TValue;
  medium: TValue;
  wide: TValue;
  spacious: TValue;
};

/** A stated value cascades upwards to the wider modes; the fallback answers only where nothing is. */
export function resolvePhiFormResponsiveValue<TValue>(
  value: PhiFormResponsiveValue<TValue> | undefined,
  fallback: PhiResolvedFormResponsiveValue<TValue>,
): PhiResolvedFormResponsiveValue<TValue> {
  if (!value) return fallback;
  const compact = value.compact ?? fallback.compact;
  const medium = value.medium ?? (value.compact === undefined ? fallback.medium : compact);
  const wide = value.wide ?? (
    value.medium === undefined && value.compact === undefined ? fallback.wide : medium
  );
  const spacious = value.spacious ?? (
    value.wide === undefined && value.medium === undefined && value.compact === undefined ? fallback.spacious : wide
  );
  return { compact, medium, wide, spacious };
}

export type PhiFormResponsiveGridRange = PhiFormResponsiveValue<PhiFormGridRange>;

export type PhiFormLogicalAlignment = "start" | "center" | "end";

/** The sizes a Form is drawn at: the Controls' vocabulary without `large`. */
export type PhiFormLayoutSize = "small" | "medium";

/**
 * What a form's rows look like where a field says nothing of its own.
 *
 * There is no `columns` and no `labelPlacement` here any more: a two-column form is fields whose
 * ranges lie in 1-13 and 13-25, and a stacked form is a label whose range is the full width. One
 * mechanism decides all of it, and the responsive sets decide it per measured width.
 */
export type PhiFormLayoutDescriptor = {
  /**
   * How large the Form draws its fields, its labels and its submit, where its placement says nothing:
   * `medium`, or `small` for a Form made to stand among chrome -- a picker, a popover, a panel of tools.
   *
   * The descriptor's default and not the last word: a placement that states a size (the site UI's Form
   * Widget `controlSize`, its `PhiFormControl` `size`) wins over it, because the same Form may be a page's
   * question in one place and a popover's in another. Absent is `medium`.
   */
  size?: PhiFormLayoutSize;
  gap?: PhiFormResponsiveValue<PhiSpacingToken>;
  /**
   * What stands between two columns of a row, where a row has two.
   *
   * The grid's own `column-gap` cannot say this: it would fall between every pair of adjacent elements,
   * so a label beside its control would be pushed away from it by the same amount that separates one
   * field from the next -- and that distance is already said, per cell, as the label's own gutter. This
   * is the other distance, and it is laid on the cell that opens a column: a field placed at 13-25 is
   * moved off the field placed at 1-13, and one placed at 1-13 is not moved at all.
   *
   * Absent, it follows `gap`: the space between two fields side by side is the space between two fields
   * one above the other, which is the reading that needs no second number. A row's two columns are then
   * further apart than a label is from its own control, which is half of it -- the hierarchy a
   * two-column form needs to read as two columns.
   */
  columnGap?: PhiFormResponsiveValue<PhiSpacingToken>;
  labelAlign?: Exclude<PhiFormLogicalAlignment, "center">;
  label?: PhiFormResponsiveGridRange;
  control?: PhiFormResponsiveGridRange;
};

/**
 * Where this one field's parts lie, overriding the layout's defaults.
 *
 * `label` and `control` are column ranges on the 24-track grid, not content, and each mode is decided
 * from what is stated for it:
 * - both: the label in its range, the control in its range;
 * - only `control`: the field has no label column. The control takes exactly that range, and a label,
 *   where the field has one, stands above it inside the same range;
 * - only `label`: the field has no control column. The label takes exactly that range, and whatever the
 *   field draws as its control stands under it inside the same range;
 * - neither, or no placement: the layout's ranges.
 *
 * The part left out is never taken from the layout: a control moved to 7-19 beside a layout label at 1-9
 * would overlap it and fall onto a second row without anyone having asked for it.
 *
 * Elements are placed in declaration order and CSS Grid does not go back to fill a gap it has passed,
 * so a field meant to stand beside the one before it is declared after it and the row fills from the
 * inline start. That is the whole ordering rule.
 */
export type PhiFormFieldPlacementDescriptor = {
  label?: PhiFormResponsiveGridRange;
  control?: PhiFormResponsiveGridRange;
};

export type PhiFormValidationRuleDescriptor = {
  providerKey: PhiFormProviderKey;
  message?: PhiFormTextDescriptor;
  config?: Record<string, unknown>;
};

export type PhiFormOptionDescriptor = Omit<
  PhiControlOption,
  "label" | "description"
> & {
  label: PhiFormTextDescriptor;
  description?: PhiFormTextDescriptor;
};

/**
 * A choice field's "none of these", declared: an option the field offers beside the others, last and set
 * apart by a line, whose choosing means the field holds no value.
 *
 * Declared rather than spelled as an option with a value of its own, because the answer it gives is
 * "nothing": a sentinel value ("other", "none") would reach every handler that reads the field, and each
 * of them would have to know to throw it away. Chosen, the field holds no value and is left out of what
 * the Form submits, so a handler sees the key absent -- the one reading "not declared" has everywhere.
 *
 * It has a label and nothing else: no value, because it holds none, and no place, because it always
 * stands last, after a separator, beside whatever the field's options are -- written out or from an
 * Options Provider. A field that opens on no value opens on it.
 */
export type PhiFormEmptyOptionDescriptor = {
  label: PhiFormTextDescriptor;
};

/**
 * A value the field proposes from another field of the same Form: an address from a name, typed once.
 *
 * A proposal and never a binding. The field takes the proposal while it is empty or still holds the last
 * proposal it took; once somebody writes something of their own there, it keeps that, whatever `from`
 * becomes afterwards -- and emptying it again lets the proposals back in. What is submitted is the
 * field's value as it stands, like any other field's; nobody recomputes it on the way.
 *
 * `from` names another field of this Form that derives nothing itself, so proposals never run in a
 * circle. `source` says what of it is read: `value`, its value where that is a string or a number, or
 * `optionLabel`, the label of the option chosen in it as the field shows it -- for a field that offers
 * options, written out or from an Options Provider. Nothing chosen, or a value of another kind, proposes
 * nothing. `transform` is how the text becomes the proposal: `slug` is `toPhiSlug`.
 */
export type PhiFormFieldDeriveDescriptor = {
  from: string;
  source: "value" | "optionLabel";
  transform: "slug";
};

export type PhiFormFieldDescriptor = {
  key: string;
  fieldProviderKey: PhiFormProviderKey;
  label?: PhiFormTextDescriptor;
  controlLabel?: PhiFormTextDescriptor;
  description?: PhiFormTextDescriptor;
  placeholder?: PhiFormTextDescriptor;
  autoComplete?: string;
  initialValue?: unknown;
  options?: readonly PhiFormOptionDescriptor[];
  optionsProvider?: PhiControlOptionsProviderConfig | null;
  /** The field's "none of these", for a field that offers options (`PhiFormEmptyOptionDescriptor`). */
  emptyOption?: PhiFormEmptyOptionDescriptor;
  /** A value proposed from another field of this Form (`PhiFormFieldDeriveDescriptor`). */
  derive?: PhiFormFieldDeriveDescriptor;
  validation?: readonly PhiFormValidationRuleDescriptor[];
  visibleWhen?: PhiRuntimeConditionExpression;
  disabledWhen?: PhiRuntimeConditionExpression;
  placement?: PhiFormFieldPlacementDescriptor;
  config?: Record<string, unknown>;
};

/**
 * What a form shows when a submit is accepted.
 *
 * Declared rather than coded, because every form that submits to a handler has this moment and each of
 * them used to answer it in its own component: the Contact form with a toast, the Registration with an
 * alert, each with its own wording and its own idea of whether the fields stay filled in.
 *
 * Absent means the form says nothing of its own. That is the right answer wherever something else is
 * listening -- a Controller that closes an Overlay on `submitSuccess`, a page that navigates away.
 */
/**
 * What the form's own submit looks like, where one is drawn.
 *
 * Whether one is drawn is not said here. That is the placement's question: the same form stands on a
 * page of its own with a button under its fields, and in a dialog whose footer carries the button --
 * or with no button anywhere, submitted by a Button Widget through the `submit` capability, or by
 * Enter where the placement allows it. The Form Widget answers it (`inline` or `external`); the form
 * answers only what its button says and where on its grid it stands, because that is geometry of the
 * same grid its fields are laid out on.
 */
export type PhiFormSubmitDescriptor = {
  /** What it says. Absent is `PHI_FORM_DEFAULT_SUBMIT_LABEL`. */
  label?: PhiFormTextDescriptor;
  /** Where inside its range it sits. Absent is `start`: under the first input, where the eye is. */
  align?: PhiFormLogicalAlignment;
  /**
   * The tracks it stands on. Absent is the layout's control range -- the tracks a field that says
   * nothing about itself puts its control on, including the label column a Form Layout may move.
   */
  control?: PhiFormResponsiveGridRange;
};

/** What a submit says where the descriptor names nothing: the form's own word for it, else "Submit". */
export const PHI_FORM_DEFAULT_SUBMIT_LABEL = {
  kind: "label",
  key: "actions.submitLabel",
  fallback: "Submit",
} as const satisfies PhiFormTextDescriptor;

export type PhiFormSuccessDescriptor = {
  title: PhiFormTextDescriptor;
  text?: PhiFormTextDescriptor;
  /** Whether the fields go back to their initial values, ready for another entry. */
  reset?: boolean;
  /**
   * Whether the form has done its one job once it succeeds: the success stays, the fields and the
   * Widget's submit go. A confirmation link is spent by its first submit, and a button left standing
   * would only offer to spend it again.
   */
  complete?: boolean;
};

/**
 * A refusal text with values of the refusal in it: `"%1" is not in stock in that quantity.`, `%1` being
 * the `product` the handler answered beside its `code`.
 *
 * The sentence is translated and the values are not, which is the rule every text with a value in it
 * follows (TRANSLATIONS.md): `%1` to `%n` stand for `params` in order, each the name of a field of the
 * refusal's body, and they are filled after the template is read in the visitor's language.
 *
 * `otherwise` is what the form says where a value is not there -- absent, empty, or neither a string nor a
 * finite number. Declared, and required, because each of the two silent answers is wrong: the template
 * with its `%1` standing, or with the value left out, is a sentence nobody wrote, and the body's `error`
 * line is the log's English. A code's general text is what a code without values says anyway, so it is
 * what this one says when its values do not come.
 */
export type PhiFormErrorTemplateDescriptor = {
  /** The sentence, `%1` to `%n` for `params`. Its source text holds exactly those placeholders. */
  template: PhiFormTextDescriptor;
  /** Names of the refusal's body fields the placeholders take, in order. At least one, no repeats. */
  params: readonly string[];
  /** What the form says without the values. No placeholder of its own. */
  otherwise: PhiFormTextDescriptor;
};

/** What a form says for one refusal `code`: a text, or a text with values of the refusal in it. */
export type PhiFormErrorTextDescriptor = PhiFormTextDescriptor | PhiFormErrorTemplateDescriptor;

export type PhiFormDescriptor = {
  schemaVersion: typeof PHI_FORM_DESCRIPTOR_SCHEMA_VERSION;
  key: string;
  labelSetKey?: PhiFormLabelSetKey;
  fields: readonly PhiFormFieldDescriptor[];
  layout?: PhiFormLayoutDescriptor;
  success?: PhiFormSuccessDescriptor;
  /**
   * What the form says when the server refuses it, by the `code` that refusal carries.
   *
   * The counterpart of `success`, and there for the same reason: what a visitor reads has to be in
   * their language, and a response body cannot be. A handler answers `{ code: "invalid_credentials" }`
   * and the wording is looked up here, in the form's own label set. A code nothing maps falls back to
   * the body's `error` line, which is English because its other reader is a log.
   *
   * A code's text may name values of the refusal itself -- the product a shop is out of -- through a
   * `PhiFormErrorTemplateDescriptor`.
   */
  errors?: Readonly<Record<string, PhiFormErrorTextDescriptor>>;
  /**
   * Whether what has been typed survives leaving the page, for as long as the tab is open.
   *
   * For the long form somebody fills in once and would have to fill in again after following a link to
   * read the terms. Session storage, never local: a half-finished registration on a shared machine is
   * not something to leave behind, and it is cleared the moment the form is accepted.
   */
  persistDraft?: boolean;
  /**
   * That the server accepts this form only with a guard token: `issuedAt` and `formToken`, signed by
   * phis-server when the form was shown and refused if it comes back too fast or too late.
   *
   * The browser asks for the token when the form mounts (`/api/site/forms?phase=guard`) and adds it to
   * what it submits. It is not rendered into the page, so a page with a guarded form is the same for
   * every visitor and can be cached.
   */
  guard?: boolean;
  submit?: PhiFormSubmitDescriptor;
};

/** The last grid line, one past the last track, because `end` is exclusive. */
export const PHI_FORM_GRID_LAST_LINE = PHI_FORM_GRID_TRACKS + 1;

function readRequiredString(value: unknown, path: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new Error(`${path} must be a non-empty string.`);
  }
  return normalized;
}

function readOptionalString(value: unknown, path: string) {
  if (value == null) {
    return undefined;
  }
  return readRequiredString(value, path);
}

function readProviderKey(value: unknown, path: string) {
  const key = readRequiredString(value, path);
  if (!key.includes("/")) {
    throw new Error(`${path} must use a namespaced package/key form.`);
  }
  return key as `${string}/${string}`;
}

function readTextDescriptor(value: unknown, path: string): PhiFormTextDescriptor {
  if (!isPhiRecord(value)) {
    throw new Error(`${path} must be a Form text descriptor.`);
  }
  if (value.kind === "literal") {
    return { kind: "literal", value: typeof value.value === "string" ? value.value : "" };
  }
  if (value.kind === "label" || value.kind === "config") {
    return {
      kind: value.kind,
      key: readRequiredString(value.key, `${path}.key`),
      fallback: typeof value.fallback === "string" ? value.fallback : "",
    };
  }
  throw new Error(`${path}.kind must be "literal", "label" or "config".`);
}

const PHI_FORM_TEXT_PLACEHOLDER_PATTERN = /%(\d+)/gu;
const PHI_FORM_ERROR_PARAM_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;

/** The text a translation is made from: what a reader without a label or a placed value would read. */
function phiFormSourceText(text: PhiFormTextDescriptor) {
  return text.kind === "literal" ? text.value : text.fallback;
}

/** The placeholder numbers a source text holds, each once, in ascending order. */
function readPlaceholderNumbers(source: string) {
  return [...new Set([...source.matchAll(PHI_FORM_TEXT_PLACEHOLDER_PATTERN)].map((match) => Number(match[1])))]
    .sort((left, right) => left - right);
}

function readErrorTextDescriptor(value: unknown, path: string): PhiFormErrorTextDescriptor {
  if (!isPhiRecord(value) || !("template" in value)) {
    // Values beside a plain text would be dropped without a word, and the sentence shown with `%1` in it.
    if (isPhiRecord(value) && ("params" in value || "otherwise" in value)) {
      throw new Error(`${path} names params or otherwise without a template; write { template, params, otherwise }.`);
    }
    return readTextDescriptor(value, path);
  }
  const template = readTextDescriptor(value.template, `${path}.template`);
  if (value.otherwise == null) {
    throw new Error(`${path}.otherwise must say what the form shows when the refusal lacks a value.`);
  }
  const otherwise = readTextDescriptor(value.otherwise, `${path}.otherwise`);
  if (!Array.isArray(value.params) || value.params.length === 0) {
    throw new Error(`${path}.params must name at least one field of the refusal.`);
  }
  const params = value.params.map((param, index) => {
    if (typeof param !== "string" || !PHI_FORM_ERROR_PARAM_PATTERN.test(param)) {
      throw new Error(`${path}.params[${index}] must be a field name (letters, digits, _): ${JSON.stringify(param)}.`);
    }
    return param;
  });
  if (new Set(params).size !== params.length) {
    throw new Error(`${path}.params must not name a field twice.`);
  }
  const source = phiFormSourceText(template);
  const placeholders = readPlaceholderNumbers(source);
  if (placeholders.length !== params.length || placeholders.some((number, index) => number !== index + 1)) {
    throw new Error(
      `${path}.template must hold %1 to %${params.length} for its ${params.length} params and no other placeholder: ${JSON.stringify(source)}.`,
    );
  }
  if (readPlaceholderNumbers(phiFormSourceText(otherwise)).length > 0) {
    throw new Error(`${path}.otherwise is the text without the values and holds no placeholder: ${JSON.stringify(phiFormSourceText(otherwise))}.`);
  }
  return { template, params, otherwise };
}

function readGridRange(value: unknown, path: string): PhiFormGridRange | undefined {
  if (value == null) {
    return undefined;
  }
  if (!isPhiRecord(value)) {
    throw new Error(`${path} must be a grid range object.`);
  }
  return assertPhiFormGridRange(
    {
      start: typeof value.start === "number" ? value.start : Number.NaN,
      end: typeof value.end === "number" ? value.end : Number.NaN,
    },
    path,
  );
}

function readResponsiveGridRange(
  value: unknown,
  path: string,
): PhiFormResponsiveGridRange | undefined {
  if (value == null) {
    return undefined;
  }
  if (!isPhiRecord(value)) {
    throw new Error(`${path} must be a responsive grid range object.`);
  }
  return {
    compact: readGridRange(value.compact, `${path}.compact`),
    medium: readGridRange(value.medium, `${path}.medium`),
    wide: readGridRange(value.wide, `${path}.wide`),
    spacious: readGridRange(value.spacious, `${path}.spacious`),
  };
}

function readFormConditionExpression(value: unknown, path: string) {
  if (value == null) return undefined;
  const expression = readPhiRuntimeConditionExpression(value);
  if (!expression) throw new Error(`${path} must be a valid runtime condition expression.`);
  for (const condition of collectPhiRuntimeValueConditions(expression)) {
    if (condition.source !== "form" && condition.source !== "controller") {
      throw new Error(`${path} may use only form or controller condition sources.`);
    }
  }
  return expression;
}

function readResponsiveGap(
  value: unknown,
  path: string,
): PhiFormResponsiveValue<PhiSpacingToken> | undefined {
  if (value == null) return undefined;
  if (!isPhiRecord(value)) throw new Error(`${path} must be a responsive spacing object.`);
  const readToken = (entry: unknown, entryPath: string) => {
    if (entry == null) return undefined;
    if (!isPhiSpacingToken(entry)) throw new Error(`${entryPath} must be a Phi spacing token.`);
    return entry;
  };
  return {
    compact: readToken(value.compact, `${path}.compact`),
    medium: readToken(value.medium, `${path}.medium`),
    wide: readToken(value.wide, `${path}.wide`),
    spacious: readToken(value.spacious, `${path}.spacious`),
  };
}

function readValidationRule(value: unknown, path: string): PhiFormValidationRuleDescriptor {
  if (!isPhiRecord(value)) {
    throw new Error(`${path} must be a validation rule object.`);
  }
  return {
    providerKey: readProviderKey(value.providerKey, `${path}.providerKey`),
    message: value.message == null ? undefined : readTextDescriptor(value.message, `${path}.message`),
    config: value.config == null
      ? undefined
      : isPhiRecord(value.config)
        ? value.config
        : (() => { throw new Error(`${path}.config must be an object.`); })(),
  };
}

function readOption(value: unknown, path: string): PhiFormOptionDescriptor {
  if (!isPhiRecord(value)) {
    throw new Error(`${path} must be an option object.`);
  }
  return {
    value: readRequiredString(value.value, `${path}.value`),
    label: readTextDescriptor(value.label, `${path}.label`),
    description: value.description == null
      ? undefined
      : readTextDescriptor(value.description, `${path}.description`),
    disabled: typeof value.disabled === "boolean" ? value.disabled : undefined,
    icon: readOptionalString(value.icon, `${path}.icon`),
    separator: readOptionSeparator(value.separator, `${path}.separator`),
    flags: readOptionFlags(value.flags, `${path}.flags`),
  };
}

/** A line before or after the option, where the Control draws one (`PhiControlOption.separator`). */
function readOptionSeparator(value: unknown, path: string) {
  if (value == null) return undefined;
  if (value !== "before" && value !== "after") {
    throw new Error(`${path} must be "before" or "after".`);
  }
  return value;
}

/**
 * The field's "none of these": a label, nothing else. A value written beside it is refused rather than
 * ignored -- whoever wrote it expects the field to submit it, and the empty option submits nothing.
 */
function readEmptyOption(value: unknown, path: string): PhiFormEmptyOptionDescriptor | undefined {
  if (value == null) return undefined;
  if (!isPhiRecord(value)) {
    throw new Error(`${path} must be an object with a label.`);
  }
  if ("value" in value) {
    throw new Error(`${path} holds no value: choosing it leaves the field empty, and the field is left out of the submit.`);
  }
  if (value.label == null) {
    throw new Error(`${path}.label must say what the option reads.`);
  }
  return { label: readTextDescriptor(value.label, `${path}.label`) };
}

function readDerive(value: unknown, path: string): PhiFormFieldDeriveDescriptor | undefined {
  if (value == null) return undefined;
  if (!isPhiRecord(value)) {
    throw new Error(`${path} must be an object with from, source and transform.`);
  }
  const from = readRequiredString(value.from, `${path}.from`);
  if (value.source !== "value" && value.source !== "optionLabel") {
    throw new Error(`${path}.source must be "value" or "optionLabel".`);
  }
  if (value.transform !== "slug") {
    throw new Error(`${path}.transform must be "slug".`);
  }
  return { from, source: value.source, transform: value.transform };
}

/**
 * A derived field reads another field of the same Form, one that derives nothing itself -- so no chain
 * and no circle -- and, for `optionLabel`, one that offers options. A key that names nothing would leave
 * the field without proposals for good, which nobody would notice.
 */
function assertDerivedFieldsReadOtherFields(fields: readonly PhiFormFieldDescriptor[]) {
  fields.forEach((field, index) => {
    if (!field.derive) return;
    const { from, source } = field.derive;
    const read = fields.find((other) => other.key === from);
    if (!read || read === field) {
      throw new Error(`fields[${index}].derive.from names "${from}", which is no other field of this Form.`);
    }
    if (read.derive) {
      throw new Error(`fields[${index}].derive.from names "${from}", which derives its own value; a proposal is made from a field somebody fills in.`);
    }
    if (source === "optionLabel" && !read.options && !read.optionsProvider) {
      throw new Error(`fields[${index}].derive reads the option label of "${from}", which offers no options.`);
    }
  });
}

/**
 * The address form of a text: what a derived field proposes (`PhiFormFieldDeriveDescriptor`, `slug`) and
 * what a server that makes a slug of a name makes of it, so the two never disagree.
 *
 * Lower case; ä, ö, ü and ß -- capital or not -- written out as ae, oe, ue and ss, the way German spells
 * them without the marks; every other mark taken off its letter (NFKD), so é is e; every run of anything
 * but a-z and 0-9 one hyphen, and no hyphen at either end. A text of nothing but such characters is the
 * empty string. No length is cut here: how long a slug may be is the field's validation and the
 * column's, not the spelling's.
 */
export function toPhiSlug(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/ä/gu, "ae")
    .replace(/ö/gu, "oe")
    .replace(/ü/gu, "ue")
    .replace(/ß/gu, "ss")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    // A compatibility character may decompose into capitals (Ⅻ is XII).
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function readOptionFlags(value: unknown, path: string) {
  if (value == null) return undefined;
  const flags = readPhiControlOptionFlags(value);
  if (flags === undefined && value !== 0) {
    throw new Error(`${path} must be a whole number from 0 to ${PHI_CONTROL_OPTION_FLAGS_MAX}.`);
  }
  return flags;
}

/**
 * An `optionFlag` condition reads the option chosen in another field of the same Form, so it has to name
 * one that offers options -- written out or from an Options Provider. A key that names nothing, or a
 * field without options, would leave the condition unavailable for good, which hides a field silently.
 */
function assertOptionFlagConditionsNameChoiceFields(fields: readonly PhiFormFieldDescriptor[]) {
  fields.forEach((field, index) => {
    for (const [name, expression] of [["visibleWhen", field.visibleWhen], ["disabledWhen", field.disabledWhen]] as const) {
      for (const condition of collectPhiRuntimeValueConditions(expression)) {
        if (condition.operator !== "optionFlag") continue;
        const chosenIn = fields.find((other) => other.key === condition.valuePath);
        if (!chosenIn || chosenIn === field || (!chosenIn.options && !chosenIn.optionsProvider)) {
          throw new Error(
            `fields[${index}].${name} reads the option chosen in "${condition.valuePath}", which is no other field of this Form that offers options.`,
          );
        }
      }
    }
  });
}

function assertUniqueKeys(items: readonly { key: string }[], path: string) {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.key)) {
      throw new Error(`${path} contains duplicate key "${item.key}".`);
    }
    seen.add(item.key);
  }
}

/**
 * One part of a field's placement, which, once written, names a range for at least one mode.
 *
 * An empty part would read as "stated" and still say nothing, and a stated part decides that the field
 * has no column for the other one -- that is too much to hang on an object with nothing in it.
 */
function readPlacementPart(value: unknown, path: string) {
  const range = readResponsiveGridRange(value, path);
  if (range && !range.compact && !range.medium && !range.wide && !range.spacious) {
    throw new Error(`${path} must state a range for at least one of compact, medium, wide, or spacious.`);
  }
  return range;
}

/**
 * A field's own placement: both parts, one part, or none.
 *
 * One part is a statement of its own and not half of two: a field that names only its control has no
 * label column and draws its label above the control inside that range, and one that names only its
 * label has no control column. Nothing is taken from the layout for the part left out -- a control moved
 * to 7-19 beside a layout label at 1-9 would overlap it and stack without anyone having asked for it.
 */
function readFieldPlacement(
  value: unknown,
  path: string,
): PhiFormFieldPlacementDescriptor | undefined {
  if (value == null) {
    return undefined;
  }
  if (!isPhiRecord(value)) {
    throw new Error(`${path} must be an object.`);
  }
  const label = readPlacementPart(value.label, `${path}.label`);
  const control = readPlacementPart(value.control, `${path}.control`);
  if (!label && !control) {
    return undefined;
  }
  return { ...(label ? { label } : {}), ...(control ? { control } : {}) };
}

function readField(value: unknown, path: string): PhiFormFieldDescriptor {
  if (!isPhiRecord(value)) {
    throw new Error(`${path} must be a field object.`);
  }
  const options = Array.isArray(value.options)
    ? value.options.map((option, index) => readOption(option, `${path}.options[${index}]`))
    : undefined;
  if (options) {
    const optionKeys = options.map((option) => ({ key: option.value }));
    assertUniqueKeys(optionKeys, `${path}.options`);
  }
  const optionsProvider = value.optionsProvider == null
    ? undefined
    : parsePhiControlOptionsProviderConfig(value.optionsProvider);
  if (value.optionsProvider != null && !optionsProvider) {
    throw new Error(`${path}.optionsProvider is invalid.`);
  }
  const emptyOption = readEmptyOption(value.emptyOption, `${path}.emptyOption`);
  if (emptyOption && !options && !optionsProvider) {
    // "None of these" beside nothing would be the field's only choice, and a field that can only be empty.
    throw new Error(`${path}.emptyOption needs options or an optionsProvider to stand beside.`);
  }
  const derive = readDerive(value.derive, `${path}.derive`);
  if (value.config != null && !isPhiRecord(value.config)) {
    throw new Error(`${path}.config must be an object.`);
  }
  const placement = readFieldPlacement(value.placement, `${path}.placement`);

  return {
    key: readRequiredString(value.key, `${path}.key`),
    fieldProviderKey: readProviderKey(value.fieldProviderKey, `${path}.fieldProviderKey`),
    label: value.label == null ? undefined : readTextDescriptor(value.label, `${path}.label`),
    controlLabel: value.controlLabel == null
      ? undefined
      : readTextDescriptor(value.controlLabel, `${path}.controlLabel`),
    description: value.description == null
      ? undefined
      : readTextDescriptor(value.description, `${path}.description`),
    placeholder: value.placeholder == null
      ? undefined
      : readTextDescriptor(value.placeholder, `${path}.placeholder`),
    autoComplete: readOptionalString(value.autoComplete, `${path}.autoComplete`),
    initialValue: value.initialValue,
    options,
    optionsProvider,
    ...(emptyOption ? { emptyOption } : {}),
    ...(derive ? { derive } : {}),
    validation: Array.isArray(value.validation)
      ? value.validation.map((rule, index) => readValidationRule(rule, `${path}.validation[${index}]`))
      : undefined,
    visibleWhen: readFormConditionExpression(value.visibleWhen, `${path}.visibleWhen`),
    disabledWhen: readFormConditionExpression(value.disabledWhen, `${path}.disabledWhen`),
    placement,
    config: value.config as Record<string, unknown> | undefined,
  };
}

function readLayoutSize(value: unknown): PhiFormLayoutSize {
  if (value !== "small" && value !== "medium") {
    throw new Error(`layout.size must be "small" or "medium".`);
  }
  return value;
}

function readSubmit(value: unknown): PhiFormSubmitDescriptor | undefined {
  if (value == null) return undefined;
  if (!isPhiRecord(value)) throw new Error("submit must be an object.");
  const align = value.align;
  if (align != null && align !== "start" && align !== "center" && align !== "end") {
    throw new Error("submit.align must be start, center or end.");
  }
  const label = value.label == null ? undefined : readTextDescriptor(value.label, "submit.label");
  const control = readPlacementPart(value.control, "submit.control");
  return {
    ...(label ? { label } : {}),
    ...(align ? { align } : {}),
    ...(control ? { control } : {}),
  };
}

export function parsePhiFormDescriptor(value: unknown): PhiFormDescriptor {
  if (!isPhiRecord(value)) {
    throw new Error("Form descriptor must be an object.");
  }
  if (value.schemaVersion !== PHI_FORM_DESCRIPTOR_SCHEMA_VERSION) {
    throw new Error(`Form descriptor schemaVersion must be ${PHI_FORM_DESCRIPTOR_SCHEMA_VERSION}.`);
  }
  if (!Array.isArray(value.fields)) {
    throw new Error("Form descriptor fields must be an array.");
  }
  if ("actions" in value) {
    /*
     * A form has one submit and it is described under `submit`; whether it is drawn is the Form
     * Widget's placement. A list of actions would be a second vocabulary for the same thing.
     */
    throw new Error("Form descriptor actions are forbidden; describe the submit under submit.");
  }
  if ("presentation" in value) {
    throw new Error("Form descriptor presentation is forbidden; use the owning Layout or Overlay.");
  }
  const fields = value.fields.map((field, index) => readField(field, `fields[${index}]`));
  assertUniqueKeys(fields, "fields");
  assertOptionFlagConditionsNameChoiceFields(fields);
  assertDerivedFieldsReadOtherFields(fields);
  const labelSetKey = value.labelSetKey == null
    ? undefined
    : readProviderKey(value.labelSetKey, "labelSetKey") as PhiFormLabelSetKey;
  const layout: PhiFormLayoutDescriptor | undefined = value.layout == null
    ? undefined
    : isPhiRecord(value.layout)
      ? {
          ...(value.layout.size == null ? {} : { size: readLayoutSize(value.layout.size) }),
          gap: readResponsiveGap(value.layout.gap, "layout.gap"),
          columnGap: readResponsiveGap(value.layout.columnGap, "layout.columnGap"),
          labelAlign: value.layout.labelAlign == null
            ? undefined
            : value.layout.labelAlign === "start" || value.layout.labelAlign === "end"
              ? value.layout.labelAlign
              : (() => { throw new Error("layout.labelAlign must be start or end."); })(),
          label: readResponsiveGridRange(value.layout.label, "layout.label"),
          control: readResponsiveGridRange(value.layout.control, "layout.control"),
        }
      : (() => { throw new Error("layout must be an object."); })();
  if (layout) {
    resolvePhiFormLayout(layout);
  }
  const success: PhiFormSuccessDescriptor | undefined = value.success == null
    ? undefined
    : isPhiRecord(value.success)
      ? {
          title: readTextDescriptor(value.success.title, "success.title"),
          text: value.success.text == null
            ? undefined
            : readTextDescriptor(value.success.text, "success.text"),
          reset: value.success.reset == null ? undefined : value.success.reset === true,
          complete: value.success.complete == null ? undefined : value.success.complete === true,
        }
      : (() => { throw new Error("success must be an object."); })();
  const errors: PhiFormDescriptor["errors"] | undefined = value.errors == null
    ? undefined
    : isPhiRecord(value.errors)
      ? Object.fromEntries(
          Object.entries(value.errors).map(([code, text]) => [
            code,
            readErrorTextDescriptor(text, `errors.${code}`),
          ]),
        )
      : (() => { throw new Error("errors must be an object."); })();
  return {
    schemaVersion: PHI_FORM_DESCRIPTOR_SCHEMA_VERSION,
    key: readRequiredString(value.key, "key"),
    labelSetKey,
    fields,
    layout,
    success,
    errors,
    persistDraft: value.persistDraft == null ? undefined : value.persistDraft === true,
    guard: value.guard == null ? undefined : value.guard === true,
    submit: readSubmit(value.submit),
  };
}

/**
 * What a form looks like when it says nothing: labels beside their controls, and stacked once the form
 * is measured narrow, which is the one place a label beside a short input leaves the input no room.
 *
 * Wide, the label takes a third: line 9 of 24, the house column the Login states for itself in
 * `PHI_LOGIN_FORM_LAYOUT_CONFIG`. Eight tracks hold a two-word label there without wrapping it, and
 * sixteen still read as the wider half.
 *
 * Medium -- a form 377 to 609px wide, where a one-column dialog's Form stands -- gives the label ten
 * tracks and the control fourteen (line 11; owner, 2026-11-25, on trial). A third of 377px is about
 * 110px, and there a label of two words like "Installation key" or "Callback origin" broke in two.
 *
 * Spacious -- from 987px -- draws what wide draws until a Form says otherwise; the step is there so one
 * can (owner, 2026-11-26).
 */
export const PHI_FORM_DEFAULT_LAYOUT = {
  gap: {
    compact: "sm",
    medium: "base",
    wide: "base",
    spacious: "base",
  },
  labelAlign: "start",
  label: {
    compact: { start: 1, end: PHI_FORM_GRID_LAST_LINE },
    medium: { start: 1, end: 11 },
    wide: { start: 1, end: 9 },
    spacious: { start: 1, end: 9 },
  },
  control: {
    compact: { start: 1, end: PHI_FORM_GRID_LAST_LINE },
    medium: { start: 11, end: PHI_FORM_GRID_LAST_LINE },
    wide: { start: 9, end: PHI_FORM_GRID_LAST_LINE },
    spacious: { start: 9, end: PHI_FORM_GRID_LAST_LINE },
  },
} as const satisfies PhiFormLayoutDescriptor;

/**
 * The ranges a form reaches for again and again, named once.
 *
 * A field written as the same range for its label and its control is a stacked field, because the two
 * cannot share a row; the half-width pairs are how a two-column form is said now that `columns` is
 * gone. All three collapse to the full width when the form is measured narrow, which is the only
 * width at which two columns of anything are worse than one.
 */
export const PHI_FORM_ROW_FULL = {
  compact: { start: 1, end: PHI_FORM_GRID_LAST_LINE },
  medium: { start: 1, end: PHI_FORM_GRID_LAST_LINE },
  wide: { start: 1, end: PHI_FORM_GRID_LAST_LINE },
  spacious: { start: 1, end: PHI_FORM_GRID_LAST_LINE },
} as const satisfies PhiFormResponsiveGridRange;

export const PHI_FORM_ROW_END_HALF = {
  compact: { start: 1, end: PHI_FORM_GRID_LAST_LINE },
  medium: { start: 13, end: PHI_FORM_GRID_LAST_LINE },
  wide: { start: 13, end: PHI_FORM_GRID_LAST_LINE },
  spacious: { start: 13, end: PHI_FORM_GRID_LAST_LINE },
} as const satisfies PhiFormResponsiveGridRange;

/** Labels above their controls at every width: one range for both parts of every field. */
export const PHI_FORM_STACKED_LAYOUT = {
  label: PHI_FORM_ROW_FULL,
  control: PHI_FORM_ROW_FULL,
} as const satisfies PhiFormLayoutDescriptor;

export const PHI_FORM_STACKED_END_HALF = {
  label: PHI_FORM_ROW_END_HALF,
  control: PHI_FORM_ROW_END_HALF,
} as const satisfies PhiFormFieldPlacementDescriptor;

/** One field of a two-column form whose labels stand beside their controls. */
export const PHI_FORM_SIDE_START_HALF = {
  label: {
    compact: { start: 1, end: 7 },
    medium: { start: 1, end: 5 },
    wide: { start: 1, end: 5 },
    spacious: { start: 1, end: 5 },
  },
  control: {
    compact: { start: 7, end: PHI_FORM_GRID_LAST_LINE },
    medium: { start: 5, end: 13 },
    wide: { start: 5, end: 13 },
    spacious: { start: 5, end: 13 },
  },
} as const satisfies PhiFormFieldPlacementDescriptor;

export const PHI_FORM_SIDE_END_HALF = {
  label: {
    compact: { start: 1, end: 7 },
    medium: { start: 13, end: 17 },
    wide: { start: 13, end: 17 },
    spacious: { start: 13, end: 17 },
  },
  control: {
    compact: { start: 7, end: PHI_FORM_GRID_LAST_LINE },
    medium: { start: 17, end: PHI_FORM_GRID_LAST_LINE },
    wide: { start: 17, end: PHI_FORM_GRID_LAST_LINE },
    spacious: { start: 17, end: PHI_FORM_GRID_LAST_LINE },
  },
} as const satisfies PhiFormFieldPlacementDescriptor;

/**
 * Two columns filled the way a grid fills them, for a form long enough that saying it per field would
 * be a list of alternations nobody can read or keep correct.
 *
 * A field that brings its own placement keeps it and, where it takes the whole width, starts the next
 * field on a fresh row -- which is what the grid did when the column count decided this and not the
 * field. Authoring sugar over the contract, never a second contract: what it produces is ordinary
 * per-field placement.
 */
export function phiFormFlowHalfColumns(
  fields: readonly PhiFormFieldDescriptor[],
): PhiFormFieldDescriptor[] {
  let atRowStart = true;
  return fields.map((field) => {
    const stated = [
      statedPhiFormGridRange(field.placement?.label, "medium"),
      statedPhiFormGridRange(field.placement?.control, "medium"),
    ].filter((range) => range != null);
    if (stated.length > 0) {
      const claimsWholeRow =
        Math.min(...stated.map((range) => range.start)) === 1 &&
        Math.max(...stated.map((range) => range.end)) === PHI_FORM_GRID_LAST_LINE;
      atRowStart = claimsWholeRow ? true : !atRowStart;
      return field;
    }
    const placement = atRowStart ? PHI_FORM_SIDE_START_HALF : PHI_FORM_SIDE_END_HALF;
    atRowStart = !atRowStart;
    return { ...field, placement };
  });
}

/** A field that takes the whole row in a form that is otherwise two columns. */
export const PHI_FORM_STACKED_FULL = {
  label: PHI_FORM_ROW_FULL,
  control: PHI_FORM_ROW_FULL,
} as const satisfies PhiFormFieldPlacementDescriptor;

export type PhiResolvedFormResponsiveGridRange = PhiResolvedFormResponsiveValue<PhiFormGridRange>;

/** The measured Form widths, narrowest first (`PhiFormResponsiveValue`). */
export const PHI_FORM_RESPONSIVE_MODES = ["compact", "medium", "wide", "spacious"] as const;

export type PhiFormResponsiveMode = (typeof PHI_FORM_RESPONSIVE_MODES)[number];

export type PhiResolvedFormLayout = {
  gap: PhiResolvedFormResponsiveValue<PhiSpacingToken>;
  columnGap: PhiResolvedFormResponsiveValue<PhiSpacingToken>;
  labelAlign: "start" | "end";
  label: PhiResolvedFormResponsiveGridRange;
  control: PhiResolvedFormResponsiveGridRange;
};

export function assertPhiFormGridRange(range: PhiFormGridRange, path: string): PhiFormGridRange {
  const { start, end } = range;
  if (!Number.isInteger(start) || start < 1 || start > PHI_FORM_GRID_TRACKS) {
    throw new Error(`${path}.start must be an integer from 1 to ${PHI_FORM_GRID_TRACKS}.`);
  }
  if (!Number.isInteger(end) || end < 2 || end > PHI_FORM_GRID_LAST_LINE) {
    throw new Error(`${path}.end must be an integer from 2 to ${PHI_FORM_GRID_LAST_LINE}.`);
  }
  if (end <= start) {
    throw new Error(`${path}.end must be greater than ${path}.start.`);
  }
  return { start, end };
}

export function createPhiFormLiteralText(value: string): PhiFormTextDescriptor {
  return { kind: "literal", value };
}

export function createPhiFormLabelText(
  key: string,
  fallback: string,
): PhiFormTextDescriptor {
  return { kind: "label", key, fallback };
}

export function resolvePhiFormText(
  text: PhiFormTextDescriptor,
  labels?: Readonly<Record<string, string>>,
  formConfig?: Readonly<Record<string, unknown>>,
) {
  if (text.kind === "literal") {
    return text.value;
  }
  if (text.kind === "config") {
    const value = formConfig?.[text.key];
    return typeof value === "string" && value.trim() ? value : text.fallback;
  }
  return labels?.[text.key] ?? text.fallback;
}

/**
 * What the form says for a refusal whose `code` maps to `text`, `body` being the refusal's answer.
 *
 * A template is read in the visitor's language first and filled after, in one pass so that a value with
 * `%2` in it is not filled again. A value the body lacks, leaves empty, or holds as anything but a
 * string or a finite number makes it `otherwise` -- never the template with a gap or a `%1` in it.
 */
export function resolvePhiFormErrorText(
  text: PhiFormErrorTextDescriptor,
  body: Readonly<Record<string, unknown>> | null | undefined,
  labels?: Readonly<Record<string, string>>,
  formConfig?: Readonly<Record<string, unknown>>,
) {
  if (!("template" in text)) {
    return resolvePhiFormText(text, labels, formConfig);
  }
  const values: string[] = [];
  for (const param of text.params) {
    const raw = body && Object.hasOwn(body, param) ? body[param] : undefined;
    const value = typeof raw === "string" ? raw.trim() : typeof raw === "number" && Number.isFinite(raw) ? String(raw) : "";
    if (!value) {
      return resolvePhiFormText(text.otherwise, labels, formConfig);
    }
    values.push(value);
  }
  return resolvePhiFormText(text.template, labels, formConfig)
    .replace(PHI_FORM_TEXT_PLACEHOLDER_PATTERN, (token, number: string) => values[Number(number) - 1] ?? token);
}

export function assertPhiFormLabelSetKey(
  value: string,
): asserts value is PhiFormLabelSetKey {
  const normalized = value.trim();
  if (!normalized || !normalized.includes("/")) {
    throw new Error(
      `Form label-set key "${value}" must use a namespaced package/key form.`,
    );
  }
}

export function resolvePhiFormResponsiveGridRange(
  value: PhiFormResponsiveGridRange | undefined,
  fallback: PhiResolvedFormResponsiveGridRange,
  path: string,
): PhiResolvedFormResponsiveGridRange {
  const resolved = resolvePhiFormResponsiveValue(value, fallback);
  return {
    compact: assertPhiFormGridRange(resolved.compact, `${path}.compact`),
    medium: assertPhiFormGridRange(resolved.medium, `${path}.medium`),
    wide: assertPhiFormGridRange(resolved.wide, `${path}.wide`),
    spacious: assertPhiFormGridRange(resolved.spacious, `${path}.spacious`),
  };
}

export function resolvePhiFormLayout(
  layout?: PhiFormLayoutDescriptor,
): PhiResolvedFormLayout {
  const gap = resolvePhiFormResponsiveValue(layout?.gap, PHI_FORM_DEFAULT_LAYOUT.gap);
  return {
    gap,
    /*
     * The row gap answers for the column gap where nobody stated one, so the default is the number the
     * form already carries rather than a second constant that could drift away from it.
     */
    columnGap: resolvePhiFormResponsiveValue(layout?.columnGap, gap),
    labelAlign: layout?.labelAlign ?? PHI_FORM_DEFAULT_LAYOUT.labelAlign,
    label: resolvePhiFormResponsiveGridRange(
      layout?.label,
      PHI_FORM_DEFAULT_LAYOUT.label,
      "layout.label",
    ),
    control: resolvePhiFormResponsiveGridRange(
      layout?.control,
      PHI_FORM_DEFAULT_LAYOUT.control,
      "layout.control",
    ),
  };
}

/**
 * The range one part of a placement states for one mode, cascading only from the smaller modes of that
 * same part -- never from the layout, which is the other part's business to decide.
 */
export function statedPhiFormGridRange(
  value: PhiFormResponsiveGridRange | undefined,
  mode: PhiFormResponsiveMode,
): PhiFormGridRange | undefined {
  if (!value) return undefined;
  if (mode === "compact") return value.compact;
  if (mode === "medium") return value.medium ?? value.compact;
  if (mode === "wide") return value.wide ?? value.medium ?? value.compact;
  return value.spacious ?? value.wide ?? value.medium ?? value.compact;
}
