/**
 * What a Timeline shows, the same for a Widget's own entries and for a Timeline Provider's answer.
 *
 * A Provider may run in a Module of ours, in an outside Module, or answer from an Add-on behind a Site
 * route, so the entry is spelled here rather than in the UI package: every end that hands entries over
 * reads and writes this shape.
 */

/** What an entry's mark says about it: a word about meaning, so the Theme decides the colour. */
export const PHI_TIMELINE_TONES = ["secondary", "success", "warning", "danger"] as const;

export type PhiTimelineTone = (typeof PHI_TIMELINE_TONES)[number];

export type PhiTimelineEntry = {
  /** Stable within the list; the entry's identity when the list is drawn again. */
  key: string;
  title?: string;
  content: string;
  /**
   * When it happened, as an ISO 8601 date or date-time. The Widget formats it for the reader's locale.
   * An entry that states `time` as well shows `time`.
   */
  at?: string;
  /**
   * When it happened, already in words: "Spring 2026", "v1.2", "Yesterday". Shown as written, and
   * preferred over `at` where an entry states both.
   */
  time?: string;
  /** A Phi icon name, drawn in place of the mark. */
  icon?: string;
  tone?: PhiTimelineTone;
  /** Still under way: the mark spins. */
  pending?: boolean;
};

/** A Timeline Provider's answer. */
export type PhiTimelineProviderResult = {
  entries: PhiTimelineEntry[];
};

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function isPhiTimelineTone(value: unknown): value is PhiTimelineTone {
  return typeof value === "string" && (PHI_TIMELINE_TONES as readonly string[]).includes(value);
}

/**
 * The `at` of an entry, when it is a date this reader can place. A string that is not one is dropped
 * rather than shown: an unreadable instant would print as "Invalid Date" in the reader's language.
 */
function readInstant(value: unknown): string | undefined {
  const text = readString(value);
  return text && !Number.isNaN(Date.parse(text)) ? text : undefined;
}

/** One entry, or `null` for anything that is not one. An entry without a key or text is not one. */
export function readPhiTimelineEntry(value: unknown): PhiTimelineEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const key = readString(record.key);
  if (!key) {
    return null;
  }
  const title = readString(record.title);
  const at = readInstant(record.at);
  const time = readString(record.time);
  const icon = readString(record.icon);
  return {
    key,
    content: typeof record.content === "string" ? record.content : "",
    ...(title ? { title } : {}),
    ...(at ? { at } : {}),
    ...(time ? { time } : {}),
    ...(icon ? { icon } : {}),
    ...(isPhiTimelineTone(record.tone) ? { tone: record.tone } : {}),
    ...(record.pending === true ? { pending: true } : {}),
  };
}

export function readPhiTimelineEntries(value: unknown): PhiTimelineEntry[] {
  return Array.isArray(value)
    ? value.map(readPhiTimelineEntry).filter((entry): entry is PhiTimelineEntry => entry != null)
    : [];
}
