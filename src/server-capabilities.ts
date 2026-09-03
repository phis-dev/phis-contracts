/**
 * What phis says about a capability, in the words the site UI reads it with.
 *
 * `/api/v1/site/capabilities` reports, per provider, whether what a Site's Modules require is actually
 * being offered. phis decides the verdict; the UI acts on it, deactivating a Module whose provider is
 * not `available` and naming the reason in its diagnostics. A verdict one side can produce and the
 * other cannot recognise is not an error anywhere -- it is a Module that quietly stays off.
 *
 * The state was declared twice, once on each side, in the same six words. That is the arrangement that
 * let the log services drift while both files still compiled, so it lives here now.
 *
 * The surrounding snapshot shape is still described only by the reader: phis builds it as a return
 * value rather than against a declared type. Bringing that here too would be the next step.
 */

export type PhiServerCapabilityState =
  | "available"
  | "missing"
  | "disabled"
  | "incompatible"
  | "misconfigured"
  | "unavailable";
