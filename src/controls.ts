/**
 * What a choice control offers, and where it asks for its choices when they are not written out.
 *
 * Here because stored descriptors carry both: a Form field lists its options or names the provider
 * that answers for them, and phis-server reads that field as it is stored.
 */

export type PhiRuntimeDataProviderKey = `${string}/${string}`;

/**
 * `<namespace>/<name>`: an identifier that says whose it is.
 *
 * Provider keys, item renderer keys and everything else a Module may contribute to a shared registry
 * share this shape, so they share one check. A second spelling of it is the one that drifts.
 */
export function isPhiNamespacedRuntimeKey(value: unknown): value is `${string}/${string}` {
  if (typeof value !== "string") {
    return false;
  }

  const separatorIndex = value.lastIndexOf("/");
  return separatorIndex > 0 && separatorIndex < value.length - 1;
}

export function isPhiRuntimeDataProviderKey(value: unknown): value is PhiRuntimeDataProviderKey {
  return isPhiNamespacedRuntimeKey(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export type PhiControlOption<TValue extends string | number = string> = {
  value: TValue;
  label: string;
  disabled?: boolean;
  description?: string;
  icon?: string;
  preview?: PhiControlOptionPreview;
  /**
   * The heading this option is listed under, where the Control can group -- a Select shows consecutive
   * options with the same group under one heading. A Control that cannot group lists the options as they
   * come, so the order has to make sense without the headings.
   */
  group?: string;
};

export type PhiControlOptionPreview = PhiControlOptionBackgroundPreview | PhiControlOptionFontPreview;

/**
 * The option's label set in the typeface it names, so a list of fonts shows the fonts.
 *
 * `fontFamily` is a complete `font-family` value -- a family, its fallback, a generic -- because the
 * option is drawn in a popup outside the page's root, where a variable that names a font is not in
 * scope. Whoever builds the option resolves the variable first.
 */
export type PhiControlOptionFontPreview = {
  kind: "font";
  fontFamily: string;
};

export type PhiControlOptionBackgroundPreview = {
  kind: "background";
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
};

export type PhiControlOptionsProviderLoadMode = "client" | "server" | "hybrid";

export type PhiControlOptionsProviderSearchConfig = {
  enabled?: boolean;
  minChars?: number;
};

/**
 * A value this provider needs that another field holds.
 *
 * `source` and `valuePath` are the vocabulary conditions already use, so "the value of a sibling field"
 * is said the same way everywhere. `form` reads the live form values; `config` reads the field or Widget
 * configuration the control was built from, which is what an Inspector has instead of a form.
 *
 * `required` is the difference between narrowing a list and having no list: a provider whose answer is
 * meaningless without the parent value is not asked at all until it has one, rather than answering with
 * everything and looking as if the dependency were ignored.
 */
export type PhiControlOptionsProviderDependency = {
  /** The name the provider reads this value under. */
  param: string;
  source: "form" | "config";
  valuePath: string;
  required?: boolean;
};

export type PhiControlOptionsProviderConfig = {
  providerKey: PhiRuntimeDataProviderKey;
  scopeKey?: string;
  area?: string;
  params?: Record<string, unknown>;
  loadMode?: PhiControlOptionsProviderLoadMode;
  search?: PhiControlOptionsProviderSearchConfig;
  dependencies?: readonly PhiControlOptionsProviderDependency[];
};

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function readLoadMode(value: unknown): PhiControlOptionsProviderLoadMode | undefined {
  return value === "client" || value === "server" || value === "hybrid" ? value : undefined;
}

function readSearchConfig(value: unknown): PhiControlOptionsProviderSearchConfig | undefined {
  const record = readRecord(value);
  if (!record) {
    return undefined;
  }

  const enabled = typeof record.enabled === "boolean" ? record.enabled : undefined;
  const minChars = typeof record.minChars === "number" && Number.isFinite(record.minChars)
    ? Math.max(0, Math.trunc(record.minChars))
    : undefined;

  if (enabled === undefined && minChars === undefined) {
    return undefined;
  }

  return {
    enabled,
    minChars,
  };
}

function readDependencies(value: unknown): readonly PhiControlOptionsProviderDependency[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const dependencies = value.flatMap((entry): PhiControlOptionsProviderDependency[] => {
    const record = readRecord(entry);
    const param = readString(record?.param);
    const valuePath = readString(record?.valuePath);
    const source = record?.source === "form" || record?.source === "config" ? record.source : undefined;
    if (!param || !valuePath || !source) {
      return [];
    }
    return [{
      param,
      source,
      valuePath,
      required: record?.required === true ? true : undefined,
    }];
  });
  return dependencies.length > 0 ? dependencies : undefined;
}

function readOptionPreview(value: unknown): PhiControlOptionPreview | undefined {
  const record = readRecord(value);
  if (record?.kind === "font") {
    const fontFamily = readString(record.fontFamily);
    return fontFamily ? { kind: "font", fontFamily } : undefined;
  }
  if (record?.kind !== "background") return undefined;
  return {
    kind: "background",
    backgroundColor: readString(record.backgroundColor),
    backgroundImage: readString(record.backgroundImage),
    backgroundSize: readString(record.backgroundSize),
    backgroundPosition: readString(record.backgroundPosition),
    backgroundRepeat: readString(record.backgroundRepeat),
  };
}

export function parsePhiControlOptionsProviderConfig(value: unknown): PhiControlOptionsProviderConfig | null {
  const record = readRecord(value);
  if (!record) {
    return null;
  }

  const providerKey = readString(record.providerKey);
  if (!isPhiRuntimeDataProviderKey(providerKey)) {
    return null;
  }

  return {
    providerKey,
    scopeKey: readString(record.scopeKey),
    area: readString(record.area),
    params: readRecord(record.params),
    loadMode: readLoadMode(record.loadMode),
    search: readSearchConfig(record.search),
    dependencies: readDependencies(record.dependencies),
  };
}

export function readPhiControlOptions(value: unknown): PhiControlOption[] {
  if (Array.isArray(value)) {
    return value
      .map((item): PhiControlOption | null => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return null;
        }
        const record = item as Record<string, unknown>;
        const optionValue = readString(record.value);
        if (!optionValue) {
          return null;
        }
        return {
          value: optionValue,
          label: readString(record.label) ?? optionValue,
          disabled: typeof record.disabled === "boolean" ? record.disabled : undefined,
          description: readString(record.description),
          icon: readString(record.icon),
          preview: readOptionPreview(record.preview),
          group: readString(record.group),
        };
      })
      .filter((item): item is PhiControlOption => item != null);
  }

  return [];
}
