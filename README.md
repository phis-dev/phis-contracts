# @phis/contracts

The agreements phis (`@phis/server`) keeps with what surrounds it: the site UI (`@phis/ui`), Sites, and
separately shipped Add-ons. Each lives under its own subpath, because they hold between different parties
and change at different moments.

> **Part of phis.** This package is one piece of a larger whole and does nothing on its own. A Phi
> installation is the server [`@phis/server`](https://github.com/phis-dev/phis-server), installed as the
> Debian package `phis` from `apt.phisys.com` (not from npm), plus Sites built on
> [`@phis/ui`](https://github.com/phis-dev/phis-ui), which brings this package along. Installation and
> documentation: [phis.dev](https://phis.dev). Install it directly only to build an Add-on or a Module
> against these contracts.

```
@phis/contracts/addon                what phis and a separately shipped Add-on promise each other
@phis/contracts/payments             the approved Payment consumer, Provider and merchant-profile types
@phis/contracts/billing              the Site's billing documents: archived, issued and numbered by Core, read by their person and staff
@phis/contracts/access               the authorization vocabulary phis and @phis/ui both evaluate
@phis/contracts/signals              the signal vocabulary and address grammar the UI declares in and phis validates
@phis/contracts/catalog              the Module categories an Add-on declares, the UI groups by and a market filters on
@phis/contracts/cms                  the CMS node identity both sides derive, and must derive alike
@phis/contracts/media                the Asset vocabularies both sides store, filter on and judge
@phis/contracts/http                 the request headers phis and the site UI must spell the same way
@phis/contracts/locale               the locale this software is authored in
@phis/contracts/logging              the structured log vocabulary a Site writes and phis reads back
@phis/contracts/search               the documents a Site writes of its Pages and the hits phis answers a query with
@phis/contracts/server-capabilities  the capability snapshot phis reports and the UI acts on
@phis/contracts/site-groups          the membership levels of a Site group, as both ends count them
@phis/contracts/user-state           the shapes a Module may keep a person's decisions in, and the key grammar
@phis/contracts/references           the Page reference grammar both sides derive and compare
@phis/contracts/resource-links       the links from a Phi record into an Add-on's own system
@phis/contracts/support              the Support ticket vocabulary
@phis/contracts/entitlements         who holds which product: subjects, entries, their standing and the capability; a bundle's holder holds its parts
@phis/contracts/products             the Site's product directory: products, states, the capability and the event
@phis/contracts/users                a person of the Site for Add-ons: fields by role, the Site's address book, the user events
@phis/contracts/identity-provider    a login provider an Add-on supplies (service kind, no Core delivery yet)
@phis/contracts/threads              the thread vocabulary
@phis/contracts/conditions           the runtime condition descriptors and the sources they read, the Page's record among them
@phis/contracts/controls             the Control descriptors
@phis/contracts/forms                the Form descriptors and their parsers
@phis/contracts/layout               the layout vocabulary
@phis/contracts/timeline             the timeline entries
```

## Before the v1 release, interface versions stay at 1

`PHIS_SERVICE_INTERFACE_VERSIONS` and `PHIS_SERVICE_INTERFACE_DIGESTS` in `@phis/contracts/addon` are not
raised while phis is pre-v1, however much an interface changes. The mechanism they drive is real and
deliberate -- Core refuses an Add-on whose recorded manifest names a digest this release does not offer --
and that is exactly why raising a version now is the wrong move: there is no released Add-on to protect, so
it buys no compatibility, and it takes the installation down. The recorded manifest in
`config/phis-addons.json` stops matching, the capability snapshot refuses the desired state, and every
request that resolves a viewer answers 500 until each installed Add-on has been rebundled and upgraded.

An interface that changes before v1 is simply the interface. Both sides are rebuilt from one tree, and the
version is raised once, when there is something in the field that a wrong assumption would break.

There is deliberately no root export. A package you can import from the top invites everything two of
our packages happen to share; a subpath makes you say which agreement you mean.

```sh
npm install @phis/contracts
```

## `/addon`

The types and constants an Add-on declares or implements. Types and constants only: no runtime code, no
`server-only`, no React, no Next.

An Add-on is compiled to a single ESM artifact and installed into a running phis through the `phis` CLI;
it is never built into the server. This subpath is the shared Add-on entrypoint it compiles against, and it must
not depend on phis itself. For an Add-on author it is a build-time dependency: everything it exports is
erased at compile time apart from a handful of constants.

What it covers:

- **Manifest** -- `PhisAddonManifestV1`: identity, version, required Core capabilities, the routes an
  Add-on claims, the services it provides, the jobs it runs and the events it listens to or emits.
- **Jobs and events** -- a job carries a `PhisAddonJobSchedule` (`every` one of
  `PHIS_ADDON_JOB_INTERVALS`, five minutes at the shortest, with `at` and `weekday` for the daily and
  weekly steps) that Core keeps: each moment of a schedule is run by exactly one instance. An event an
  Add-on emits is a `PhisAddonEmittedEventId`, its own id in front (`@scope/name:what.happened`),
  declared under `emits` and sent through the `events` capability (`PhisEventsCapabilityV1`); a listener
  receives a `PhisAddonEmittedEventSubject` with emitter, time, hop count, dedupe key and facts. Core's
  own events keep their bare names. `PHIS_ADDON_EVENT_MAX_HOPS` bounds a chain of handlers emitting.
- **Runtime** -- `PhisAddonRuntimeV1`, `PhisAddonHandler`, `PhisAddonRequestContext`. The artifact
  exports it under the name `phisAddon` (`PhisAddonRuntimeModuleV1`).
- **Schema** -- `PhisAddonSchemaDescriptor` and its column, index and constraint descriptors. Tables are
  declared, not migrated by hand; phis applies them. A column points at Core through
  `PHIS_ADDON_CORE_REFERENCES` (`core.site`, `core.user`, `core.group`, `core.mediaAsset`); a `core.group`
  or `core.mediaAsset` column needs a `siteScoped` table and keeps either delete rule, `setNull` clearing
  that column alone.
- **Service kinds** -- the Core-owned kinds an Add-on may supply an implementation of: Media Storage
  (`PhisMediaStorageAdapter`, upload plans, object I/O), Directory, Payments, Translation, Support
  Forwarding and Media Source (`/media-source`: `PhisMediaSourceAdapterV1` lists what an archive offers
  and hands over the bytes of what somebody chose; Core imports them into the Site's library, and the
  same list contract is what a Module's source answers in the browser), and Identity Provider
  (`/identity-provider`: `PhisIdentityProviderAdapterV1` builds the address a browser is sent to and turns
  the callback into an issuer, subject and e-mail; Core keeps the transaction, accounts and sessions, and
  namespaces the issuer as `addon:<provider key>:<issuer>`). The Identity Provider kind is a contract
  without a Core delivery yet: an installed implementation signs nobody in until the server builds it. `PHIS_SERVICE_KINDS` names them
  and `PHIS_SERVICE_INTERFACE_DIGESTS` holds the digest of each kind's current interface; Core refuses an
  Add-on built against a different digest at install.
- **Files on a row** -- `PhisAssetsCapabilityV1` (`assets:v1`). A client's file goes through `begin` and
  `finalize`; bytes the Add-on holds itself (a package's pictures, a job's output) go through `put` in one
  call, under the Add-on's own authority with or without an actor, into a slot of its own row, at most
  `PHIS_ASSET_PUT_MAX_BYTES` and within the slot's and the Site's ceilings. The same bytes in the same slot
  of the same row answer with the file already there; the same bytes anywhere else in the Add-on's Space
  are refused, as `finalize` refuses them.
- **CDN** -- `cdn:v1` (`PhisCdnCapabilityV1`) reads the Site's CDN catalogue: every file offered under
  the Site's name as `PhisCdnFileV1`, with `storage` (`cdn`, copied into the bucket, or `link`, kept at
  its source), `os` and `arch` (`PhisCdnFileOs`, `PhisCdnFileArch` bits, 0 for not stated).
  `cdn-publish:v1` (`PhisCdnPublishCapabilityV1`, a grant of its own) puts a file in: `import` hands Core
  an https address, a size and a SHA-256, and Core fetches, checks and uploads the bytes itself; `link`
  records the same fields without bytes moving. Both are idempotent per key and SHA-256 and answer a
  refusal rather than throwing for what the caller could not know (`PhisCdnImportRefusalV1`, among them
  `name-not-yours`, `key-taken`, `host-not-allowed`, `too-large` past the Site's largest object and
  `quota-exceeded` past its Space's quota). A key is `<name>/<version>/<file>`: name and file name hold
  `PHIS_CDN_KEY_SEGMENT_PATTERN` (a `~` anywhere but first), the version `PHIS_CDN_KEY_VERSION_PATTERN`
  (also a `:`, for an epoch), and no segment a `/`. The CDN page's routes answer the `PhisCdnAdmin*`,
  `PhisCdnUpload*`, `PhisCdnCheckReportV1` and `PhisCdnAdopt*` types.
- **Media library** -- `PhisMediaCapabilityV1` (`media:v1`) reads Assets of the Site's library by id, at
  most `PHIS_MEDIA_GET_MAX_IDS`, with `flags` (`PhisMediaAssetV1Flag.Servable`) and `path` and what a media tile draws (`name`, `title`,
  `alt`, `thumbnailPath`, `previewPath`, `blurDataUrl`); `PhisMediaReleaseCapabilityV1`
  (`media-release:v1`, a grant of its own) gives them up, at most `PHIS_MEDIA_RELEASE_MAX_IDS`, and Core
  deletes each one nothing references any more -- for good, there is no trash. An Asset id an Add-on keeps
  sits in a `core.mediaAsset` column, one row per picture; one in JSON is not counted by the Media
  library's delete guard. A slot of `assets:v1` or such a column: phis's
  [`ADDON_HOWTO.md`](https://github.com/phis-dev/phis-server/blob/main/ADDON_HOWTO.md#a-picture-for-an-add-on-row-slot-or-media-library-reference).
- **Products** -- `/products`: a product's `imageAssetId` (its picture) and `iconAssetId` (a small
  picture beside its title, a logo or an app icon) are accepted only where a visitor is served the Asset
  (ready, public, in the Site's Space or the supplier's own Add-on Space), and a manifest sync of the
  declared products leaves a picture or an icon that is set alone. Its `title`, `summary` and
  `description` are source texts of the Site's translation store, each under the product's own context
  (`product <n> title`), recorded by Core on every `register`; `list` and `get` answer them in a reader's
  language with `locale` (`PhisAddonRequestContext.locale`) and as written without it, and say per text
  whether it answers a translation (`translated`, `PhisProductText` bits; a description only where a person
  translated it). A product's texts are written in its own `sourceLocale` -- several suppliers may sell
  through one Site, each in their language -- decided by one rule, stated at the top of `src/products.ts`:
  (1) the language a hand-over states always wins (`PhisProductDraft.sourceLocale`, `product.add`'s and
  `@phis/products`' Form field, a proposal's); (2) otherwise, for texts the Add-on ships itself (its
  manifest's products, its `translations:v1` texts named without a language), the manifest's
  `sourceLocale`, required where a manifest declares products or requires `translations:v1`; (3)
  otherwise the text was typed on the Site and is in the Site's source language
  (`PhisAddonRequestContext.site.sourceLocale`). Core reads a product written in another language than the
  Site's as an external source, as the TR route does. A product also
  carries a `description` (Markdown, at most `PHIS_PRODUCT_DESCRIPTION_MAX`) and a `gallery`: further pictures in order, at most
  `PHIS_PRODUCT_GALLERY_MAX`, written as Asset ids (`PhisProductDraft.gallery`) under the picture's rules
  and read as `PhisProductGalleryPicture` (`assetId`, the public `path`, `listPath`); a change of either
  owes `product.changed`, and a manifest names no gallery. Every Add-on reads them through `products:v1`;
  a seller keeps no gallery or description of its own. A product may carry a `link`
  (`PhisProductLink`): a `target`, a Page reference or an https address (`PhiLinkTarget`), and a `label`
  in the product's language, translated like the title (`PhisProductText.LinkLabel`); no target, no
  button, and a label without a target is refused (`readPhisProductLink`). A draft, a manifest's product
  and a Site package proposal state it the same way. A Site package (Module) proposes
  products of its own under `phis.products` in its `package.json`: `PhisSitePackageProductProposal`
  (`key`, `sourceLocale` -- the package's `phis.sourceLocale`, `en` where it states none, stated by the
  reader and never per product --, `title`, `summary?`, `description?`, `kind?`, `state?` `draft`/`active`, `flags?` as
  `PhisSitePackageProductFlag` -- `Counted`, `AccountRequired` --, `link?`, `picture?` and `icon?` as keys of the
  package's `phis.media.files`, `gallery?` as a list of such keys in order),
  read by `readPhisSitePackageProductProposals` (a whole package block, strict) and
  `readPhisSitePackageProductProposal` (one, as Core is handed it). Core has the supplier
  `PHIS_SITE_PACKAGE_PRODUCT_SUPPLIER` (`@phis/products`, command `product.add`) make each one once per
  Site, under the key `phisSitePackageProductKey` derives: the package name's parts and the proposal's key
  joined by dots (`@phis/phisys` + `phivoice-ai` is `phis.phisys.phivoice-ai`) -- when a Site Admin
  activates the package in the Builder, as that admin, and once every picture it names is in the Site's
  Media library.
- **An Add-on's own words** -- `PhisTranslationsCapabilityV1` (`translations:v1`, `/translation`): texts an
  Add-on keeps in its tables (a listing's hint) are `record`ed as source texts of the Site's translation
  store under `<addonId>: <context>`, which Core builds, and `translate` answers them in a reader's
  language (`PhisAddonRequestContext.locale`), at most `PHIS_ADDON_TRANSLATION_TEXTS_MAX` texts of
  `PHIS_ADDON_TRANSLATION_TEXT_MAX` characters under a context of at most
  `PHIS_ADDON_TRANSLATION_CONTEXT_MAX`. Editor > Translations lists them beside a Page's words. Both take
  an optional `sourceLocale`, the texts' language: absent, the manifest's `sourceLocale`; what staff typed
  states the Site's (`PhisAddonRequestContext.site.sourceLocale`).
- **Billing documents** -- `PhisBillingCapabilityV1` (`billing:v1`, `/billing`): an Add-on reads the
  documents of its own sales (`list` by `references`), and an Add-on its manifest declares as an issuer
  (`billing: { issues }`) and the Site's operator allowed as a source issues the merchant's own into Core:
  `issue` allocates the number from a series and fixes the content, `attachFile` adds the PDF once. The
  manifest's `billing.issuedBy` names the Add-ons that may issue for this Add-on's sales. Core's event
  `billing-document.changed` reaches the source and the consumer Add-on.
- **Core capabilities** -- `PHIS_CORE_CAPABILITIES`, the catalogue ids an Add-on may require. Declare
  against these constants rather than spelling the ids out, and read the list before concluding that
  Core lacks something; phis's `SERVER_ADDONS.md` section 13 says what each one is for. Core separately validates delivery to
  Add-ons; a catalogue id such as `authentication` may serve Site Modules without a corresponding
  Add-on context field. Payment ids accompany the implemented Core capability/service/event catalogue.

`PHIS_ADDON_ABI_VERSION` is the single number phis checks an Add-on against.

How an Add-on is laid out, compiled, installed, activated and upgraded is described in phis's
[`ADDON_HOWTO.md`](https://github.com/phis-dev/phis-server/blob/main/ADDON_HOWTO.md); the rules behind it
are in [`SERVER_ADDONS.md`](https://github.com/phis-dev/phis-server/blob/main/SERVER_ADDONS.md).

## `/payments`

The approved v1 consumer capability, Provider adapter, checkout plans, normalized money,
payment/operation/refund records, merchant profile/grant types and owning-consumer event facts.
Apart from the money helpers below, all exports are types; there is no secret accessor
implementation, checkout SDK, exchange-rate conversion or Payment engine here. The same types are
re-exported by `/addon`.

`PhisPaymentMoney` keeps minor units as an integer string. `PHIS_PAYMENT_CURRENCY_EXPONENTS` says how
many of them make one major unit per currency; `phisMinorToMajorAmount` turns a `minor` into the
decimal it states, on the digits; and `formatPhisMoney(money, locale)` writes an amount as the reader's
language writes money, with the currency's own number of places. Everybody who shows a payment's money
uses that one function, so nobody divides by a hundred.

Consumers own their prices in CHF, EUR, USD or another supported currency. Every payment uses one
currency; capture and refunds inherit it. Core never infers conversion or settlement currency.

Core implements Payment execution separately. Its catalogue exports `payments`, `paymentNotifications`,
the Payment service kind/interface digest and `payment.changed`. Notification ingress is available
only in a bound hook context. The Add-on event context discriminates thread and Payment subjects;
thread producers remain explicitly typed as thread events. A checkout can be given an end (`create`
with `expiresAt`) within the method's `checkoutExpiry`.

Everything Provider-specific is declared by the Provider in its method features (`PhisPaymentFeatures`),
per pricing policy, since `probe` is asked per pricing selector: the collection modes a method can run
and for which intervals (`collection`), its currency behaviour (`currency`: conversion into the
customer's local currency, the conversion currencies, the account's settlement currencies, whether it
reports settlements), and the documents it issues and who issues them in law (`documents`). Core records
a profile's features per currency and per policy (`refreshProfileFeatures`, a merchant action) and
answers them from the recording with `profileFeatures` and `chooseCollection`, the two Payment
operations a hook may call; nothing reads a Provider's name.

A subscription is collected in one of three modes (`PhisPaymentCollection`): `automatic` (Core charges
the stored method, with a dunning policy), `payment-request` (Core asks the customer to pay each period
on a checkout, `leadDays` before the paid one ends) and `provider-managed` (the Provider runs the
schedule; prepared in the contract, refused until built). Every subscription has its own `graceDays`, 0
to 30: a bound entitlement counts that long after an unpaid period's end, and a period still unpaid then
ends the subscription -- there is no `unpaid` state. `payment.changed` names the `moment` of a requested
period (`requested`, `reminder`, `due`, `grace-ending`) and the `changeId` of a change. A subscription
changes terms with `previewSubscriptionChange` and `changeSubscription` (up at once, with the unused
share of the paid period credited and the rest paid on a checkout, starting a new term; down or sideways
at the period end), `cancelSubscriptionChange`, `listSubscriptionChanges` and `subscriptionCredit`.

After a capture or a refund Core archives the Provider's documents (`listDocuments`, `fetchDocument`) into
`billing:v1` and records what was settled (`observeSettlements`, read with `listSettlements` by Admin and
Accountant only); `totals.presentment` is what the customer saw in their own currency, informational and
never part of Core's arithmetic. Every yes/no fact is a bit of a `flags` number with its flag object
(`PhisPaymentFlag`, `PhisPaymentSubscriptionFlag`, `PhisPaymentFeatureFlag`, ...), never a boolean.
See the normative [Payment contract](https://github.com/phis-dev/phis-server/blob/main/PAYMENTS.md)
and [Stripe/profile contract](https://github.com/phis-dev/phis-server/blob/main/PAYMENTS_STRIPE.md).

## `/billing`

Every billing document of a Site in one model (`PhisBillingDocument`): the Provider's, fetched by Core
after a payment, and the merchant's own invoices, credit notes, reminders, receipts and confirmations,
issued by Add-ons through `billing:v1` (`PhisBillingCapabilityV1`). Core keeps them in its own private
storage for ten years after the year of issue, numbers the issued invoices, credit notes and reminders
gap-free from the Site's number series (`PhisBillingNumberSeries`, template `PHI-{YY}{xxxxx}`: the run of
`x` is the serial's minimum width, `{YYYY}`, `{YY}` and `{MM}` are shown only, reset `none` or `yearly`),
and shows a person all of theirs and Admin and Accountant all of them. A document never changes once
issued; a correction is a credit note. `PhisBillingDocumentFlag` (`Voided`, `Credited`, `Detached`) and
`PhisBillingNumberSeriesFlag` (`Closed`, `Used`) carry its yes/no facts. The manifest field `billing`
(`PhisAddonBillingDescriptor`) declares what an Add-on issues and who may issue for it. Also re-exported
by `/addon`.

## `/access`

Claim shapes, policy shapes, and the evaluator that decides them. Unlike `/addon`, this is runtime code
and a real dependency of both packages that use it.

Two processes decide the same question. phis decides it in its guards and API routes; a Site decides it
while rendering -- per navigation entry, per tree node, and in the browser, where phis is not reachable
without a round trip. Neither can defer to the other, so both evaluate, and one compiled source is the
only way both reach the same answer: a stored claim normalised on one side and not on the other admits
on one and refuses on the other, and neither copy looks wrong on its own.

Each side keeps its own viewer type and passes a projection onto `PhiAccessSubject`, so neither package
adopts the other's shape.

## `/cms`

The encoding of a CMS node's identity: how a Preset node's id is derived from the Module, the preset and
the node key, and how a draft node's id is derived from the revision it was made in.

It is arithmetic both sides must compute alike. A Preset id is derived rather than allocated, so the site
UI can address a node before any row exists and phis can check that stored wiring points at nodes that
really exist. A changed constant on one side produces ids that are still well formed and simply name
nothing. The Page-key convention and the map helper built on top stay with `@phis/ui`.

## `/signals`

The closed vocabularies a Widget's wiring is written in -- scopes, actions, value types -- the shape of a
value schema name, and the address families.

A Widget declares what it emits and listens for, the Builder stores that, phis validates it on the way
in, and the Site delivers it at runtime, so all of them parse the same strings. The rule that says which
receivers a scope admits, and the controller address the Site scope privileges, live here for the same
reason.

Which schemas exist stays with the UI. phis checks that a JSON signal names *a* schema, never which one:
`isPhiSignalValueSchemaShape` checks the shape, not membership. The UI asks the stricter question because
it holds the Module registry; phis must not, or it would refuse every third party's schema.

## `/catalog`

What a Module is for, as one closed list: `foundation`, `workspace`, `content`, `media`, `commerce`,
`identity`, `communication`, `events`, `analytics`, `integration`, `operations`, `other`
(`PHI_RUNTIME_MODULE_CATEGORIES`).

An Add-on declares it per Module, because a package may ship a shop and a report and neither answer would
be true of the other. The site UI groups the Modules page by it, and a marketplace Add-on -- which
compiles against this package and nothing else -- filters on it.

It is not in `/addon` on purpose: `/addon` is the ABI a third party compiles against, and this list grows
with the product. phis does not ask the membership question either; a manifest carries categories as
plain strings, Core checks the shape, and the strict question is asked where a registry is held. The
labels an operator reads are label-set keys owned by the UI; this subpath holds identifiers only.

Beside the vocabulary sits the shape a Module package declares itself in, under `phis` in its
`package.json`: which Modules it carries, each one's category, and the language their titles and
descriptions are written in. Reading that from `package.json` means nobody has to execute a stranger's
package to list it. The author writes it; `phis module` checks that the entries are present and well
formed, and a package that declares nothing is refused at intake.

## `/media`

The words and numbers a Site and phis must read the same way about an Asset: the Space kind's wire name,
the media kinds, the Folder flags, the presentation flags, the image variant keys, and the two closed
vocabularies that decide deliverability -- `lifecycle_status` and `delivery_policy`.

These values travel and are judged on the other side. The site UI sends a flag mask as a list filter and
flag values when metadata is saved, and phis filters with `presentation_flags & mask <> 0` and refuses a
value it does not know. An Asset payload carries `lifecycleStatus` and `deliveryPolicy` as stored, and
the UI decides from them whether `next/image` may be pointed at the original.

The resolvers come with their vocabulary: `normalizePhiMediaKind` and `resolvePhiMediaKindFromContentType`
map onto the kind list, so an upload is filed and listed as the same kind on both sides. How a delivery
URL is built stays with each side, and phis's numeric Space kind never reaches a Site.

`resolvePhiImageAssetVariantSpec` is what a variant is: its box, fit, quality, `format` (`webp`, or `jpeg`
for `Share`, the 1200 x 630 picture of a link preview) and `flags` (`PhiImageAssetVariantSpecFlags`).
`ExactSize` promises the variant is always exactly its box, a smaller original enlarged, so the site UI
may state the size in the document head without fetching the picture; phis renders it that way.

## `/http`

The request header names phis reads and the site UI writes: `PHIS_TOKEN_HEADER` (`x-phis-token`),
`PHIS_SITE_KEY_HEADER`, `PHIS_AREA_HEADER`, `PHIS_REQUEST_PATH_HEADER`, `PHIS_REQUEST_SEARCH_HEADER` and
`PHIS_FORM_RELAY_HEADER`.
A disagreement here is not a type error but a 403 or 400 at runtime.

## `/locale`

`PHI_CANONICAL_SOURCE_LOCALE`: the locale every label, email template and global message is authored in,
and therefore the one a translation starts from. It is not a Site's default locale, which is per-Site
configuration.

## `/logging`

The structured log vocabulary: `PhiLogService` (`phis`, `ui`, `site`, `cli`), `PhiLogLevel`,
`PhiLoggerContext`, `PhiLogEvent` and the `PhiLogger` interface. A Site and phis both write these records
to journald, and the log surface in phis parses them back, filtering by exactly these services and
fields. How a line is serialised is each writer's own concern.

## `/search`

Searching a Site's own Pages, split the only way it can be: the Site writes the documents, phis keeps and
searches them. A Page's words stand in Widget configs, in content phis stores without knowing which Page
shows it, and in documents fetched while the Page is drawn, so only the Site -- resolving a Page as a
visitor's request does -- sees the whole text. It sends one `PhiSearchIndexSet` per Area and language,
named by a `fingerprint` of what it was built from, so a set phis already holds is not written twice;
phis answers a query with `PhiSearchResponse`, each `PhiSearchHit` carrying its Page's path and a
snippet in pieces. `readPhiSearchQuery` and `tokenizePhiSearchQuery` are called on both ends, so a
query the Site calls too short is one phis would not have answered. Only the Public and App Areas are
indexed (`PHI_SEARCH_INDEXED_AREA_MASK`).

## `/server-capabilities`

The snapshot `/api/v1/site/capabilities` reports: per provider (Core or an Add-on), the capabilities it
offers and its state (`PhiCapabilitySnapshot`, `PhiCapabilityProvider`, `PhiCapabilityState`). phis
decides the verdict; the site UI acts on it, deactivating a Module whose provider is not `available` and
naming the reason in its diagnostics.

## `/site-groups`

The membership ladder of a Site group: `PhiGroupMembershipFlags` (`Member`, `Author`, `Editor`,
`Manager`, cumulative bits), `PHI_GROUP_MEMBERSHIP_LEVELS` and `readPhiGroupMembershipLevel`. The site UI
sends `membershipFlags` as an integer and offers the levels to choose from, so both ends must count the
same bits. The Add-on boundary names levels instead (`PHIS_GROUP_LEVELS` in `/addon`).

## `/user-state`

What a Module may keep per Site about a person who decided something: the closed shape set
(`PHIS_USER_STATE_SHAPES` -- `flag`, `marker`, `value`, `set`), the `<package>/<key>` grammar, the
declaration a Module makes (`PhisDeclarableUserStateKey`), and `readPhisUserStateWrite`, which both ends
call so a refused write is refused the same way in both. phis stores it and is the only party that
validates; the site UI declares the keys and reads them while rendering. Core's own account facts stay
bit flags on the membership and account rows and are not this.

## `/controls` and `/conditions`

What a choice control offers (`PhiControlOption`, `readPhiControlOptions`) and the condition grammar a
Form field's `visibleWhen` and `disabledWhen` and a Widget's visibility are written in
(`PhiRuntimeConditionExpression`, read and evaluated here so the server that accepts a condition and the
renderer that applies it use one set of rules). An option may carry `flags`, bits whose meaning whoever
answers for the options names (a whole number from 1 to `PHI_CONTROL_OPTION_FLAGS_MAX`; absent is none). The
leaf `{ source: "form", valuePath: "<field key>", operator: "optionFlag", flag: <bits> }` holds where the
option chosen in that field of the same Form carries every bit of `flag`; the renderer hands the chosen
options' flags in as `formOptionFlags`, and a field whose chosen option is not known yet answers
`unavailable`. `parsePhiFormDescriptor` refuses an `optionFlag` condition that names no other field of the
Form with options.

A Form field's written-out options may carry `separator` (`"before"` or `"after"`; anything else is
refused). A field that offers options -- written out or from an Options Provider -- may declare
`emptyOption: { label }`, its "none of these": the renderer lists it last, after a separator, and choosing
it leaves the field with no value, so the field is left out of what the Form submits and a handler reads
the key as absent. It has no value of its own (`value` beside it is refused), and a field without options
cannot declare it.

A Form's `layout.size` (`"small"` or `"medium"`, anything else refused; absent is `medium`) is the size
the descriptor is drawn at where its placement states none: a placement's own size wins over it.

## Admission rule

Per subpath, and narrow on purpose. Name the two parties and the sentence they promise each other; if that
sentence cannot be written down, it does not go in here.

- `/addon`: only what phis and a separately shipped Add-on must agree on. Declarations, never
  implementations.
- `/access`: only what phis and `@phis/ui` must both evaluate, each in its own process. A helper both
  happen to use is convenience, not a contract.
- `/catalog`: only vocabularies an Add-on declares a Module in and another party reads back -- closed
  lists of identifiers, never the words an operator sees.
- `/media`, `/http`, `/logging`, `/site-groups`, `/server-capabilities`: only what crosses the wire as a
  value and is judged on the other side. A copy is a contract when disagreeing about it changes what a
  request returns.
- `/user-state`: only the shapes and the key grammar both ends check a write against. What a Module keeps
  under its keys is the Module's business and never named here.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
