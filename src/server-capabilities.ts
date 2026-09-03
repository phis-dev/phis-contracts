/**
 * What phis says about a capability provider, in the words the site UI reads it with.
 *
 * `/api/v1/site/capabilities` reports, per provider, whether what a Site's Modules require is actually
 * being offered. phis decides the verdict; the UI acts on it, deactivating a Module whose provider is
 * not `available` and naming the reason in its diagnostics. A verdict one side can produce and the
 * other cannot recognise is not an error anywhere -- it is a Module that quietly stays off.
 *
 * The state was declared twice, once on each side, in the same six words. That is the arrangement that
 * let the log services drift while both files still compiled, so it lives here now -- and the shape
 * around it followed, because a snapshot phis only built and the UI only read was the same arrangement
 * one level up.
 *
 * A provider is Core or an Add-on. Core is one itself, and the one most Modules depend on, which is
 * why nothing here is named for Add-ons.
 */

/** `@scope/name` -- Core is `@phis/server/core`. */
export type PhiCapabilityProviderId = `@${string}/${string}`;

/** `@scope/name:v<major>` -- a capability at the interface version it is offered under. */
export type PhiCapabilityId = `@${string}/${string}:v${number}`;

export type PhiCapabilityState =
  | "available"
  | "missing"
  | "disabled"
  | "incompatible"
  | "misconfigured"
  | "unavailable";

export type PhiCapabilityDescriptor = {
  id: PhiCapabilityId;
  interfaceDigest: string;
};

export type PhiCapabilityProvider = {
  providerId: PhiCapabilityProviderId;
  state: PhiCapabilityState;
  diagnosticCode: string | null;
  capabilities: readonly PhiCapabilityDescriptor[];
};

export type PhiCapabilitySnapshot = {
  siteKey: string;
  releaseBuildId: string | null;
  buildManifestDigest: string;
  providers: readonly PhiCapabilityProvider[];
};
