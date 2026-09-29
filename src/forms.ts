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
  parsePhiControlOptionsProviderConfig,
  type PhiControlOption,
  type PhiControlOptionsProviderConfig,
} from "./controls.js";
import {
  isPhiSpacingToken,
  resolvePhiResponsiveValue,
  type PhiResponsiveValue,
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

export type PhiFormResponsiveGridRange = PhiResponsiveValue<PhiFormGridRange>;

export type PhiFormLogicalAlignment = "start" | "center" | "end";

/**
 * What a form's rows look like where a field says nothing of its own.
 *
 * There is no `columns` and no `labelPlacement` here any more: a two-column form is fields whose
 * ranges lie in 1-13 and 13-25, and a stacked form is a label whose range is the full width. One
 * mechanism decides all of it, and the responsive sets decide it per measured width.
 */
export type PhiFormLayoutDescriptor = {
  gap?: PhiResponsiveValue<PhiSpacingToken>;
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
  columnGap?: PhiResponsiveValue<PhiSpacingToken>;
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
   */
  errors?: Readonly<Record<string, PhiFormTextDescriptor>>;
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

function readResponsiveGap(value: unknown, path: string): PhiResponsiveValue<PhiSpacingToken> | undefined {
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
  };
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
  if (range && !range.compact && !range.medium && !range.wide) {
    throw new Error(`${path} must state a range for at least one of compact, medium, or wide.`);
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
    validation: Array.isArray(value.validation)
      ? value.validation.map((rule, index) => readValidationRule(rule, `${path}.validation[${index}]`))
      : undefined,
    visibleWhen: readFormConditionExpression(value.visibleWhen, `${path}.visibleWhen`),
    disabledWhen: readFormConditionExpression(value.disabledWhen, `${path}.disabledWhen`),
    placement,
    config: value.config as Record<string, unknown> | undefined,
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
     * A descriptor describes a form's fields, never what is done with them. Where a form is submitted
     * from is a question about the surface it stands on: a Button Widget beside it, an Overlay footer,
     * a toolbar -- or the Form Widget's own `submit` option, which is config on the Widget and reaches
     * the same `submit` capability those do.
     */
    throw new Error(
      "Form descriptor actions are forbidden; use the Form Widget's submit option or an external Button Widget.",
    );
  }
  if ("presentation" in value) {
    throw new Error("Form descriptor presentation is forbidden; use the owning Layout or Overlay.");
  }
  const fields = value.fields.map((field, index) => readField(field, `fields[${index}]`));
  assertUniqueKeys(fields, "fields");
  const labelSetKey = value.labelSetKey == null
    ? undefined
    : readProviderKey(value.labelSetKey, "labelSetKey") as PhiFormLabelSetKey;
  const layout: PhiFormLayoutDescriptor | undefined = value.layout == null
    ? undefined
    : isPhiRecord(value.layout)
      ? {
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
            readTextDescriptor(text, `errors.${code}`),
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
  };
}

/**
 * What a form looks like when it says nothing: labels beside their controls at a third of the width,
 * and stacked once the form is measured narrow, which is the one place a label beside a short input
 * leaves the input no room. Line 9 of 24 is the third; the control takes everything after it.
 *
 * A third is the house column, the one the Login states for itself in `PHI_LOGIN_FORM_LAYOUT_CONFIG`:
 * eight tracks hold a two-word label without wrapping it, and sixteen still read as the wider half.
 */
export const PHI_FORM_DEFAULT_LAYOUT = {
  gap: {
    compact: "sm",
    medium: "base",
    wide: "base",
  },
  labelAlign: "start",
  label: {
    compact: { start: 1, end: PHI_FORM_GRID_LAST_LINE },
    medium: { start: 1, end: 9 },
    wide: { start: 1, end: 9 },
  },
  control: {
    compact: { start: 1, end: PHI_FORM_GRID_LAST_LINE },
    medium: { start: 9, end: PHI_FORM_GRID_LAST_LINE },
    wide: { start: 9, end: PHI_FORM_GRID_LAST_LINE },
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
} as const satisfies PhiFormResponsiveGridRange;

export const PHI_FORM_ROW_END_HALF = {
  compact: { start: 1, end: PHI_FORM_GRID_LAST_LINE },
  medium: { start: 13, end: PHI_FORM_GRID_LAST_LINE },
  wide: { start: 13, end: PHI_FORM_GRID_LAST_LINE },
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
  },
  control: {
    compact: { start: 7, end: PHI_FORM_GRID_LAST_LINE },
    medium: { start: 5, end: 13 },
    wide: { start: 5, end: 13 },
  },
} as const satisfies PhiFormFieldPlacementDescriptor;

export const PHI_FORM_SIDE_END_HALF = {
  label: {
    compact: { start: 1, end: 7 },
    medium: { start: 13, end: 17 },
    wide: { start: 13, end: 17 },
  },
  control: {
    compact: { start: 7, end: PHI_FORM_GRID_LAST_LINE },
    medium: { start: 17, end: PHI_FORM_GRID_LAST_LINE },
    wide: { start: 17, end: PHI_FORM_GRID_LAST_LINE },
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

export type PhiResolvedFormResponsiveGridRange = {
  compact: PhiFormGridRange;
  medium: PhiFormGridRange;
  wide: PhiFormGridRange;
};

export const PHI_FORM_RESPONSIVE_MODES = ["compact", "medium", "wide"] as const;

export type PhiFormResponsiveMode = (typeof PHI_FORM_RESPONSIVE_MODES)[number];

export type PhiResolvedFormLayout = {
  gap: {
    compact: PhiSpacingToken;
    medium: PhiSpacingToken;
    wide: PhiSpacingToken;
  };
  columnGap: {
    compact: PhiSpacingToken;
    medium: PhiSpacingToken;
    wide: PhiSpacingToken;
  };
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
  const resolved = resolvePhiResponsiveValue(value, fallback);
  return {
    compact: assertPhiFormGridRange(resolved.compact, `${path}.compact`),
    medium: assertPhiFormGridRange(resolved.medium, `${path}.medium`),
    wide: assertPhiFormGridRange(resolved.wide, `${path}.wide`),
  };
}

export function resolvePhiFormLayout(
  layout?: PhiFormLayoutDescriptor,
): PhiResolvedFormLayout {
  const gap = resolvePhiResponsiveValue(layout?.gap, PHI_FORM_DEFAULT_LAYOUT.gap);
  return {
    gap,
    /*
     * The row gap answers for the column gap where nobody stated one, so the default is the number the
     * form already carries rather than a second constant that could drift away from it.
     */
    columnGap: resolvePhiResponsiveValue(layout?.columnGap, gap),
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
  return value.wide ?? value.medium ?? value.compact;
}
