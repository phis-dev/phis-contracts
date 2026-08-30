# @phis/addon-contract

The types and constants a phi-server Add-on declares or implements. Types and constants only —
no runtime code, no `server-only`, no React, no Next.

An Add-on is compiled to a single ESM artifact and installed into a running phi-server through
the `phis` CLI. It is never built into the server. This package is the only thing an Add-on
compiles against; it must not depend on phi-server itself.

## Install

```sh
npm install --save-dev @phis/addon-contract
```

It is a build-time dependency: everything it exports is erased at compile time, apart from a
handful of constants.

## What it covers

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

Nothing enters this package unless **phi-server and a separately shipped Add-on must agree on
it**. Declarations, never implementations. Rules shared between phi-server and `@phis/ui` are
a different contract and do not belong here.

## Documentation

The full walkthrough — how an Add-on is laid out, compiled, installed, activated, and
upgraded — lives in phi-server's `ADDON_HOWTO.md`, with the design rationale in
`SERVER_ADDONS.md`.
