# @phis/contracts

The agreements phi-server keeps with what surrounds it. Each under its own subpath, because they hold
between different parties and freeze at different moments.

```
@phis/contracts/addon     what phi-server and a separately shipped Add-on promise each other
@phis/contracts/access    the authorization vocabulary phi-server and @phis/ui both evaluate
@phis/contracts/signals   the signal vocabulary the UI declares against and phi-server validates
@phis/contracts/catalog   the Module category an Add-on declares, the UI groups by, a market will filter on
```

There is deliberately no root export. A package you can import from the top invites everything that
two of our packages happen to share; a subpath makes you say which agreement you mean.

## `/addon`

The types and constants a phi-server Add-on declares or implements. Types and constants only — no
runtime code, no `server-only`, no React, no Next.

An Add-on is compiled to a single ESM artifact and installed into a running phi-server through the
`phis` CLI. It is never built into the server. This subpath is the only thing an Add-on compiles
against; it must not depend on phi-server itself.

```sh
npm install --save-dev @phis/contracts
```

For an Add-on author it is a build-time dependency: everything `/addon` exports is erased at compile
time, apart from a handful of constants.

## `/access`

Claim shapes, policy shapes, and the evaluator that decides them. Unlike `/addon`, this one **is**
runtime code, and it is a real dependency of both packages that use it.

Two processes decide the same question. phi-server decides it in its guards and API routes; the site
decides it while rendering — per navigation entry, per tree node, and in the browser, where
phi-server is not reachable without a round trip. Neither can defer to the other, so both evaluate,
and one compiled source is the only way both can agree.

They did not agree before this subpath existed. A stored claim with `flags: -1` admitted everything
on the server and nothing in the UI: one side normalised the value, the other did not. Neither copy
looked wrong on its own, which is why it went unnoticed.

Each side keeps its own viewer type and passes a projection onto `PhiAccessSubject`, so neither
package has to adopt the other's shape.

## `/signals`

The closed vocabularies a widget's wiring is written in -- scopes, actions, value types -- and the shape
of a value schema name.

A widget declares what it emits and listens for, the Builder stores that, and phi-server validates it on
the way in. Two lists, one meaning; and when they were two lists they drifted. `@phis/ui` had grown
`date`, `time` and `length`; phi-server had not. A length control's change signal -- from a widget the
same release shipped -- was refused on save with "valueType is invalid".

Which schemas exist stays with the UI. phi-server checks that a JSON signal names *a* schema, never
which one, and `isPhiSignalValueSchemaShape` is exactly that much: shape, not membership. The UI asks
the stricter question, because it holds the module registry; phi-server must not, or it would refuse
every third party's schema for never having heard of it.

## `/catalog`

What a Module is for, as one closed list: `foundation`, `workspace`, `content`, `commerce`, `people`,
`operations`, `other`.

An Add-on declares it per Module -- per Module, because a package may ship a shop and a report and
neither answer would be true of the other. The site UI groups the Modules page by it, and a Module may
read another's category and show it.

It is here rather than in the site UI package because of the reader that cannot follow it there. A
marketplace is a phi-server Add-on: it compiles against this package and nothing else, never against
React, and it is meant to let a shopper filter on category. That filter is not built yet -- an
offering's category is still free text -- but it is why this list is a contract.

It is not in `/addon` on purpose. `/addon` is the frozen ABI a third party compiles against, and this
list grows as the product does -- an eighth category would lift the package everybody builds against,
for a change that concerns none of them. Nor does phi-server ask the membership question: a package
manifest carries its Modules' categories as plain strings, Core checks the shape, and the strict
question is asked where a registry is actually held. The same split as `/signals`.

The labels an operator reads are not here. Those are label-set keys, translated per site, and they
belong to the UI; this subpath holds the identifiers the parties spell the same way.

Beside the vocabulary sits the shape a Module package declares itself in, under `phis` in its
package.json: which Modules it carries, each one's category, and the language their titles and
descriptions are written in. A Module is compiled UI code, so reading that out of it means executing a
stranger's package -- inside the `phis` CLI, or inside a marketplace taking a submission. Neither
should, and a registry serves package.json without anybody fetching a tarball.

It is not a second manifest. A package carries one product at one version: the Add-on manifest is what
phi-server is handed when an artifact is installed, this is what a catalogue reads about the half that
never reaches phi-server. Same package, same version, different readers. And it is derived from the
definitions, never composed by hand -- a package whose declaration disagrees with its own Modules has a
build problem, not two opinions.

## What `/addon` covers

- **Manifest** — `PhisAddonManifestV1`: identity, version, required core capabilities,
  the routes an Add-on claims, the services it provides.
- **Runtime** — `PhisAddonRuntimeV1`, `PhisAddonHandler`,
  `PhisAddonRequestContext`: the shape the artifact's default export must have.
- **Schema** — `PhisAddonSchemaDescriptor` and its column, index, and constraint
  descriptors. Tables are declared, not migrated by hand; phi-server applies them.
- **Service kinds** — the interfaces an Add-on may provide or consume, currently the media
  storage adapter (`PhisMediaStorageAdapter`, upload plans, object I/O).
- **What Core offers** — `PHIS_CORE_CAPABILITIES`, the capability ids an Add-on may
  require; `PHIS_SERVICE_KINDS`, the service kinds Core owns; and
  `PHIS_SERVICE_INTERFACE_DIGESTS`, the digest of each kind's current interface. Declare
  against these names rather than spelling them out: Core refuses an Add-on whose digest is not
  the one this release offers, and a literal cannot be checked before you ship it.

This list is a promise, not a plan. A capability appears here when Core delivers it, never
before.

`PHIS_ADDON_ABI_VERSION` is the single number a server checks an Add-on against.

## Admission rule

Per subpath, and both halves are narrow on purpose.

Into `/addon`: only what **phi-server and a separately shipped Add-on must agree on**. Declarations,
never implementations.

Into `/access`: only what **phi-server and `@phis/ui` must both evaluate**, because each decides it
in its own process. Not what both happen to use — a date formatter used on both sides is shared
convenience, not a contract, and belongs to neither.

Into `/catalog`: only the vocabularies an Add-on **declares a Module in** and another party then reads
back — closed lists, identifiers only, never the words an operator sees. A vocabulary only the UI ever
reads stays with the UI.

The test for either is the same: name the two parties and the sentence they are promising each
other. If that sentence cannot be written down, it does not go in here.

## Documentation

The full walkthrough — how an Add-on is laid out, compiled, installed, activated, and
upgraded — lives in phi-server's `ADDON_HOWTO.md`, with the design rationale in
`SERVER_ADDONS.md`.
