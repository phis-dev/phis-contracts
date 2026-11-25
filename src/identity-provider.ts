/**
 * Identity providers from Add-ons: `@phis/server/service/identity-provider`.
 *
 * **A contract without a Core delivery yet.** These types are stated so an Add-on can be built against
 * them; the server does not yet resolve an implementation, list it on the Login page or call it. That
 * arrives with a later server release (phis-server design/IDENTITY_PROVIDERS.md, build order step 2), and
 * until then an installed implementation signs nobody in. Google, Apple, GitHub, Microsoft and generic
 * OpenID Connect are Core's own providers and never go through this contract: it is for what Core does
 * not speak -- SAML, a national eID, a login outside OpenID Connect.
 *
 * **An implementation speaks one protocol and decides nothing.** It builds the address the browser is
 * sent to, and it turns what comes back into a validated identity. Core keeps the rest: the transaction
 * (state, nonce, PKCE verifier, where to go next, expiry, one use), the flow cookie and the check that
 * this browser started the flow, the start and callback routes, accounts, linking, registration policy,
 * membership, factors, sessions and audit. An implementation never sees a session, a user id, a cookie,
 * another installation's secret or the Site's policy. It can only answer "this provider says the person
 * is subject X"; what that means on the Site is Core's decision, as for Google.
 *
 * **One installation, one method.** A Site installs a provider under an installation key, a slug of the
 * Site's own (`PHIS_IDENTITY_PROVIDER_INSTALLATION_KEY_PATTERN`, never one of Core's method keys such as
 * `password` or `google`). It is the method key of that login and the segment of its callback address,
 * `/api/auth/providers/<installation key>/callback`, because a provider key holds `@` and `/`. Several
 * implementations may be installed at once, and one Add-on may supply several provider keys
 * (`PhisAddonServiceProviderDescriptor.providerKey`, package-qualified: `@acme/saml`).
 *
 * **Issuers are namespaced.** Core stores an identity an implementation answers as
 * `addon:<provider key>:<issuer>`, so an Add-on can never claim an identity of a Core provider or of
 * another Add-on, whatever it answers.
 */

/**
 * The stages a login method may serve, as Core's methods name them. `primary`: signing in. `step-up`:
 * confirming who somebody is before a sensitive action.
 */
export type PhisIdentityProviderStage = "primary" | "step-up";

/**
 * How the provider answers the callback. `query`: in the address of a GET. `form_post`: in the fields of
 * a POST (OpenID Connect's form post, SAML's POST binding); Core keeps the posted fields encrypted in the
 * transaction and hands them to `complete` as `parameters`, so an answer never travels in an address.
 */
export type PhisIdentityProviderResponseMode = "query" | "form_post";

/** An installation key: a lower-case slug, at most 64 characters, unique per Site. */
export const PHIS_IDENTITY_PROVIDER_INSTALLATION_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/u;

/** A setting's key, as an installation's `config` stores it under the implementation's own name. */
export const PHIS_IDENTITY_PROVIDER_SETTING_KEY_PATTERN = /^[a-z][A-Za-z0-9]{0,63}$/u;

/** The deadlines Core gives each call, passed as the call's `AbortSignal`. */
export const PHIS_IDENTITY_PROVIDER_PROBE_TIMEOUT_MS = 10_000;
export const PHIS_IDENTITY_PROVIDER_BEGIN_TIMEOUT_MS = 10_000;
export const PHIS_IDENTITY_PROVIDER_COMPLETE_TIMEOUT_MS = 20_000;

/**
 * One field an installation of this provider takes -- an entity id, a metadata address, a realm.
 *
 * Drawn on the Site's login provider page for this provider only, stored in the installation's `config`
 * under `key`, and checked by Core against `type` and `required` before the implementation is handed it.
 * A secret is never a setting: it is `PhisIdentityProviderDescriptionV1.secret`, written through Core's
 * write-only path. `url` takes an absolute `https:` address.
 */
export type PhisIdentityProviderSettingFieldV1 = {
  /** `PHIS_IDENTITY_PROVIDER_SETTING_KEY_PATTERN`. */
  key: string;
  label: string;
  type: "text" | "url" | "integer" | "boolean";
  /** Absent or false: may be left empty, and is then absent from `settings`. */
  required?: boolean;
  /** One line under the field. */
  hint?: string | null;
};

/** The fields an installation takes, in the order the page draws them. */
export type PhisIdentityProviderSettingsSchemaV1 = {
  fields: readonly PhisIdentityProviderSettingFieldV1[];
};

/** What the provider page and the Login page show, and how Core runs the flow. */
export type PhisIdentityProviderDescriptionV1 = {
  /** Shown in the provider select and on the login button: "Keycloak", "eID". */
  label: string;
  /** A sign of the Site's icon set (`antd:safety`), never an address; null: none. */
  icon: string | null;
  stages: readonly PhisIdentityProviderStage[];
  responseMode: PhisIdentityProviderResponseMode;
  /** Whether Core makes a PKCE pair for this provider. */
  pkce: boolean;
  settings: PhisIdentityProviderSettingsSchemaV1;
  /** The secret an installation needs, as the page asks for it; null: the provider needs none. */
  secret: { label: string; hint: string } | null;
  /** Whether `probe` can tell more than that the settings are filled in. */
  testable: boolean;
};

/**
 * What Core hands an implementation when it builds one: one installation of one Site, and nothing else.
 *
 * Built per request. `settings` holds the installation's values, already checked against the schema the
 * implementation declared; `readSecret` resolves this installation's secret and no other, and there is
 * no argument that could make it resolve another.
 */
export type PhisIdentityProviderContextV1 = {
  /** The provider key this implementation was resolved under. */
  providerKey: string;
  siteKey: string;
  /** The installation's key: the login method's key and its callback segment. */
  installationKey: string;
  /** The client id the installation states, as the provider knows the Site. */
  clientId: string;
  settings: Readonly<Record<string, unknown>>;
  readSecret(): Promise<string | null>;
};

/** What `probe` answers: whether this installation can sign anybody in, and why not in an operator's words. */
export type PhisIdentityProviderProbeV1 = {
  status: "ok" | "failed";
  detail: string | null;
};

/**
 * What `begin` is asked, after Core wrote the transaction. Every value is Core's and goes into the
 * provider's request as it is; the implementation keeps none of them.
 */
export type PhisIdentityProviderBeginInputV1 = {
  /** `<Site origin>/api/auth/providers/<installation key>/callback`. */
  callbackUrl: string;
  state: string;
  nonce: string;
  /** The S256 challenge where the description asks for PKCE; null otherwise. */
  pkceChallenge: string | null;
  signal: AbortSignal;
};

/** Where Core sends the browser: the provider's authorization address for this transaction. */
export type PhisIdentityProviderBeginResultV1 = {
  redirectUrl: string;
};

/**
 * The callback, as `complete` is handed it -- after Core consumed the transaction and checked its state
 * against the flow cookie, so an implementation is never asked about a callback Core would refuse.
 */
export type PhisIdentityProviderCallbackV1 = {
  callbackUrl: string;
  /** The provider's answer: the query of a `query` callback, the posted fields of a `form_post` one. */
  parameters: Readonly<Record<string, string>>;
  nonce: string;
  pkceVerifier: string | null;
  signal: AbortSignal;
};

/**
 * The identity Core receives: who the provider says the person is.
 *
 * `issuer` is stable for one provider instance (a realm's address, a SAML entity id) and is stored under
 * Core's namespace (`addon:<provider key>:<issuer>`); changing it orphans every linked identity. `subject`
 * is stable and never reassigned by the provider.
 */
export type PhisIdentityProviderIdentityV1 = {
  issuer: string;
  subject: string;
  email: string | null;
  /**
   * Only what the provider asserted. Core applies the Site's linking rules to it and never takes it as its
   * own verification of the address; trusting an Add-on provider's e-mail to link an existing account is
   * the operator's choice per installation, off unless chosen, and never applies to privileged accounts.
   */
  emailVerified: boolean;
  /** Names a newly created account and nothing else; an existing account keeps its name. */
  displayName: string | null;
};

/**
 * The interface of `@phis/server/service/identity-provider`, version 1.
 *
 * A throw, a missed deadline or an answer that does not hold this contract ends the login as
 * `provider_failed`, is logged with the provider key, and touches no account.
 */
export interface PhisIdentityProviderAdapterV1 {
  describe(): PhisIdentityProviderDescriptionV1;
  probe(input: { signal: AbortSignal }): Promise<PhisIdentityProviderProbeV1>;
  begin(input: PhisIdentityProviderBeginInputV1): Promise<PhisIdentityProviderBeginResultV1>;
  complete(input: PhisIdentityProviderCallbackV1): Promise<PhisIdentityProviderIdentityV1>;
}
