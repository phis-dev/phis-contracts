# @phis/contracts

The agreements phis (`@phis/server`) keeps with what surrounds it: the site UI (`@phis/ui`), Sites, and
separately shipped Add-ons. Each lives under its own subpath, because they hold between different parties
and change at different moments.

```
@phis/contracts/addon                what phis and a separately shipped Add-on promise each other
@phis/contracts/access               the authorization vocabulary phis and @phis/ui both evaluate
@phis/contracts/signals              the signal vocabulary and address grammar the UI declares in and phis validates
@phis/contracts/catalog              the Module categories an Add-on declares, the UI groups by and a market filters on
@phis/contracts/cms                  the CMS node identity both sides derive, and must derive alike
@phis/contracts/media                the Asset vocabularies both sides store, filter on and judge
@phis/contracts/http                 the request headers phis and the site UI must spell the same way
@phis/contracts/locale               the locale this software is authored in
@phis/contracts/logging              the structured log vocabulary a Site writes and phis reads back
@phis/contracts/server-capabilities  the capability snapshot phis reports and the UI acts on
@phis/contracts/site-groups          the membership levels of a Site group, as both ends count them
```

There is deliberately no root export. A package you can import from the top invites everything two of
our packages happen to share; a subpath makes you say which agreement you mean.

```sh
npm install @phis/contracts
```

## `/addon`

The types and constants an Add-on declares or implements. Types and constants only: no runtime code, no
`server-only`, no React, no Next.

An Add-on is compiled to a single ESM artifact and installed into a running phis through the `phis` CLI;
it is never built into the server. This subpath is the only thing an Add-on compiles against, and it must
not depend on phis itself. For an Add-on author it is a build-time dependency: everything it exports is
erased at compile time apart from a handful of constants.

What it covers:

- **Manifest** -- `PhisAddonManifestV1`: identity, version, required Core capabilities, the routes an
  Add-on claims, the services it provides.
- **Runtime** -- `PhisAddonRuntimeV1`, `PhisAddonHandler`, `PhisAddonRequestContext`. The artifact
  exports it under the name `phisAddon` (`PhisAddonRuntimeModuleV1`).
- **Schema** -- `PhisAddonSchemaDescriptor` and its column, index and constraint descriptors. Tables are
  declared, not migrated by hand; phis applies them.
- **Service kinds** -- the Core-owned kinds an Add-on may supply an implementation of: Media Storage
  (`PhisMediaStorageAdapter`, upload plans, object I/O) and Directory. `PHIS_SERVICE_KINDS` names them
  and `PHIS_SERVICE_INTERFACE_DIGESTS` holds the digest of each kind's current interface; Core refuses an
  Add-on built against a different digest at install.
- **Core capabilities** -- `PHIS_CORE_CAPABILITIES`, the capability ids an Add-on may require. Declare
  against these constants rather than spelling the ids out. The list is the vocabulary and may reserve a
  name before Core delivers it (`resource-links`, `support`); an Add-on that requires a capability this
  release does not deliver is refused rather than handed a missing object.

`PHIS_ADDON_ABI_VERSION` is the single number phis checks an Add-on against.

How an Add-on is laid out, compiled, installed, activated and upgraded is described in phis's
[`ADDON_HOWTO.md`](https://github.com/phis-dev/phis-server/blob/main/ADDON_HOWTO.md); the rules behind it
are in [`SERVER_ADDONS.md`](https://github.com/phis-dev/phis-server/blob/main/SERVER_ADDONS.md).

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

## `/http`

The request header names phis reads and the site UI writes: `PHIS_TOKEN_HEADER` (`x-phis-token`),
`PHIS_SITE_KEY_HEADER`, `PHIS_AREA_HEADER`, `PHIS_REQUEST_PATH_HEADER` and `PHIS_REQUEST_SEARCH_HEADER`.
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

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
