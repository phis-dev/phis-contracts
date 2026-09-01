# @phis/contracts

The agreements phi-server keeps with what surrounds it. Two of them, under two subpaths, because
they hold between different parties and freeze at different moments.

```
@phis/contracts/addon     what phi-server and a separately shipped Add-on promise each other
@phis/contracts/access    the authorization vocabulary phi-server and @phis/ui both evaluate
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

## What `/addon` covers

- **Manifest** — `PhiServerAddonManifestV1`: identity, version, required core capabilities,
  the routes an Add-on claims, the services it provides.
- **Runtime** — `PhiServerAddonRuntimeV1`, `PhiServerAddonHandler`,
  `PhiServerAddonRequestContext`: the shape the artifact's default export must have.
- **Schema** — `PhiServerAddonSchemaDescriptor` and its column, index, and constraint
  descriptors. Tables are declared, not migrated by hand; phi-server applies them.
- **Service kinds** — the interfaces an Add-on may provide or consume, currently the media
  storage adapter (`PhisMediaStorageAdapter`, upload plans, object I/O).
- **What Core offers** — `PHI_SERVER_CORE_CAPABILITIES`, the capability ids an Add-on may
  require; `PHI_SERVER_SERVICE_KINDS`, the service kinds Core owns; and
  `PHI_SERVER_SERVICE_INTERFACE_DIGESTS`, the digest of each kind's current interface. Declare
  against these names rather than spelling them out: Core refuses an Add-on whose digest is not
  the one this release offers, and a literal cannot be checked before you ship it.

This list is a promise, not a plan. A capability appears here when Core delivers it, never
before.

`PHI_SERVER_ADDON_ABI_VERSION` is the single number a server checks an Add-on against.

## Admission rule

Per subpath, and both halves are narrow on purpose.

Into `/addon`: only what **phi-server and a separately shipped Add-on must agree on**. Declarations,
never implementations.

Into `/access`: only what **phi-server and `@phis/ui` must both evaluate**, because each decides it
in its own process. Not what both happen to use — a date formatter used on both sides is shared
convenience, not a contract, and belongs to neither.

The test for either is the same: name the two parties and the sentence they are promising each
other. If that sentence cannot be written down, it does not go in here.

## Documentation

The full walkthrough — how an Add-on is laid out, compiled, installed, activated, and
upgraded — lives in phi-server's `ADDON_HOWTO.md`, with the design rationale in
`SERVER_ADDONS.md`.
