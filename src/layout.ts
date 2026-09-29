/**
 * The layout vocabulary stored descriptors are written in: a value per measured width, and the named
 * spacing steps.
 *
 * Here rather than in the site UI because a Form descriptor is stored by phis-server and states its
 * gaps and ranges in these terms, so the server has to read them the way the renderer does.
 */

export type PhiResponsiveValue<TValue> = {
  compact?: TValue;
  medium?: TValue;
  wide?: TValue;
};

export type PhiResolvedResponsiveValue<TValue> = {
  compact: TValue;
  medium: TValue;
  wide: TValue;
};

/** A stated value cascades upwards to the wider modes; the fallback answers only where nothing is. */
export function resolvePhiResponsiveValue<TValue>(
  value: PhiResponsiveValue<TValue> | undefined,
  fallback: PhiResolvedResponsiveValue<TValue>,
): PhiResolvedResponsiveValue<TValue> {
  if (!value) return fallback;
  const compact = value.compact ?? fallback.compact;
  const medium = value.medium ?? (value.compact === undefined ? fallback.medium : compact);
  const wide = value.wide ?? (
    value.medium === undefined && value.compact === undefined ? fallback.wide : medium
  );
  return { compact, medium, wide };
}

export const PHI_SPACING_TOKENS = [
  "none",
  "xxs",
  "xs",
  "sm",
  "base",
  "md",
  "lg",
  "xl",
  "xxl",
] as const;

export type PhiSpacingToken = (typeof PHI_SPACING_TOKENS)[number];

export function isPhiSpacingToken(value: unknown): value is PhiSpacingToken {
  return typeof value === "string" && (PHI_SPACING_TOKENS as readonly string[]).includes(value);
}
