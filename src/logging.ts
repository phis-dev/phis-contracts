/**
 * The log vocabulary phis and the site UI must both know.
 *
 * Two processes write these records and one of them reads all of them: a Site runtime and this server
 * both emit structured lines to journald, and the admin log surface in phis parses them back --
 * filtering by service, splitting by level, and projecting exactly the fields named below. The writer
 * and the reader are therefore two ends of one format, and neither can defer to the other.
 *
 * They did not agree before this file existed. `service` was a closed list in both places, and the two
 * lists drifted: phis admitted "phi-ui" while the UI wrote "phi-shared". Nothing failed. The records
 * simply carried a name the reader never offered as a filter, so the events were there and not
 * findable -- the same failure mode, and the same cure, as the role flags in `access.ts`.
 *
 * Only the vocabulary lives here. How a line is serialized is not shared: phis guards against cycles
 * and BigInt because an Add-on hands it arbitrary values, and that is its own concern.
 */

/** Which process wrote the record. The reader offers exactly these as filters. */
export type PhiLogService = "phis" | "ui" | "site" | "cli";

export type PhiLogLevel = "debug" | "info" | "warn" | "error";

/** What a logger carries across every record it writes. */
export type PhiLoggerContext = {
  service: PhiLogService;
  siteKey?: string | null;
  area?: string | null;
  requestId?: string | null;
  userId?: number | string | null;
  actorRole?: string | null;
  pluginKey?: string | null;
  method?: string | null;
  path?: string | null;
  targetType?: string | null;
  targetId?: number | string | null;
};

/** What one record adds to that context. */
export type PhiLogEvent = {
  message?: string;
  status?: number | null;
  durationMs?: number | null;
  error?: unknown;
  meta?: Record<string, unknown>;
};

export interface PhiLogger {
  readonly context: Readonly<PhiLoggerContext>;
  child(context: Partial<PhiLoggerContext>): PhiLogger;
  debug(event: string, data?: PhiLogEvent): void;
  info(event: string, data?: PhiLogEvent): void;
  warn(event: string, data?: PhiLogEvent): void;
  error(event: string, data?: PhiLogEvent): void;
}
