/**
 * The Media Storage service kind, as a Provider implements it.
 *
 * Core owns the upload lifecycle -- `init` and `finalize` stay Core routes for every Provider -- and a
 * Provider states how a body is to be delivered and settles the staged object once it lands. Nothing
 * here reaches a database, a request, or a secret store: the Provider gets configuration and a context,
 * and answers about objects.
 */

export const PHI_LOCAL_MEDIA_STORAGE_PROVIDER_ID = "@phis/server/storage-local" as const;
export type PhisMediaStorageProviderId = `@${string}/${string}`;

export type PhisMediaStorageConfig = {
  storageKeyPrefix: string;
  rootDir: string;
};

export type PhisMediaObjectInput = {
  storageKey: string;
  body: Buffer | Uint8Array;
  contentType: string;
  metadata?: Record<string, string>;
};

export type PhisMediaObjectStreamInput = {
  storageKey: string;
  body: ReadableStream<Uint8Array>;
  contentType: string;
  metadata?: Record<string, string>;
};

export type PhisMediaObjectHead = {
  storageKey: string;
  byteSize: number;
  contentType: string;
  etag: string;
  metadata: Record<string, string>;
  lastModifiedAt: string;
};

/**
 * How a Client is to deliver one upload body.
 *
 * This is the Provider-neutral half of the upload contract: init answers with a plan, and a generic
 * executor carries it out without knowing which Provider issued it. Before the plan existed the rule
 * "one PUT, to our own route, with the file's content type" lived only in the Client, which is exactly
 * what a Provider that takes the body directly cannot satisfy.
 *
 * The union is meant to grow. A Provider that needs several requests for one body -- S3 multipart --
 * adds a variant here rather than a second upload lifecycle, and the executor refuses a `kind` it does
 * not know instead of falling back to a PUT that would go to the wrong place. What a Provider needs
 * reported back once the body has landed travels through `completion`, opaque to Core.
 */
export type PhiMediaUploadPlan =
  | {
      kind: "proxy-stream";
      /** A Core route on this origin: the body streams through the Server, with the session cookie. */
      url: string;
      method: "PUT";
      headers?: Record<string, string>;
    }
  | {
      kind: "presigned-put";
      /** The Provider's own endpoint. Site credentials must never be attached to it. */
      url: string;
      method: "PUT";
      headers: Record<string, string>;
      expiresAt: string;
    };

export type PhiMediaUploadPlanKindKey = PhiMediaUploadPlan["kind"];

export type PhiMediaUploadPlanInput = {
  token: string;
  storageKey: string;
  contentType: string;
  sizeBytes: number;
  expiresAt: string;
  /**
   * Where Core itself receives a body, for a Provider that cannot take one directly.
   *
   * Core owns its route table, so the address is handed to the adapter rather than assembled by it.
   */
  proxyUploadUrl: string;
};

export type PhiMediaUploadCompletionInput = {
  storageKey: string;
  /** Whatever the plan's issuer asked the Client to bring back. Core passes it through unread. */
  completion?: unknown;
};

export interface PhisMediaStorageAdapter {
  putObject(input: PhisMediaObjectInput): Promise<PhisMediaObjectHead>;
  putObjectStream(input: PhisMediaObjectStreamInput): Promise<PhisMediaObjectHead>;
  getObject(storageKey: string): Promise<Buffer | null>;
  /**
   * The first bytes of an object, for deciding what it actually is without moving it.
   *
   * Separate from `getObject` because the answer needs a few kilobytes and an object may be gigabytes:
   * a Provider that stores remotely reads a range rather than the body, so identifying an upload costs
   * one small request whatever was uploaded.
   */
  readObjectHead(storageKey: string, byteLength: number): Promise<Buffer | null>;
  /**
   * Settles a staged object onto its final key without moving it through Core.
   *
   * `finalize` used to read the whole staged body and write it back, which is a download plus an upload
   * of every byte for a Provider that stores remotely -- impossible for a multipart object and wasteful
   * for anything large. A Provider that can copy in place does; the Local adapter copies on disk.
   */
  copyObject(input: {
    sourceKey: string;
    targetKey: string;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<PhisMediaObjectHead | null>;
  headObject(storageKey: string): Promise<PhisMediaObjectHead | null>;
  deleteObject(storageKey: string): Promise<boolean>;
  listPrefix(prefix: string): Promise<PhisMediaObjectHead[]>;
  /** States how the Client is to deliver this body. */
  createUploadPlan(input: PhiMediaUploadPlanInput): Promise<PhiMediaUploadPlan>;
  /**
   * Settles the staged object once the Client says it is done, and answers what actually landed.
   *
   * `null` means nothing is there, which is how Core tells an unfinished upload from a finished one.
   * A Provider that assembles parts does it here; one that received the whole body simply looks.
   */
  completeUpload(input: PhiMediaUploadCompletionInput): Promise<PhisMediaObjectHead | null>;
  /**
   * States which browser origins may deliver a body straight to this Provider.
   *
   * A presigned plan is a cross-origin request, so without this the browser refuses to send it and no
   * server ever learns why. The origins are Core's to know -- they are the Sites the Provider serves --
   * and applying them is the Provider's, because only it knows how its storage expresses the rule.
   *
   * An empty list withdraws the permission rather than widening it. A Provider a browser never
   * addresses directly, such as the Local one, implements this as a no-op; there is no capability flag
   * to check, because a Provider that cannot say no to a body it never receives has nothing to say.
   */
  applyCorsPolicy(origins: readonly string[]): Promise<void>;
  /**
   * What makes two Storage Profiles the same physical storage.
   *
   * A CORS rule belongs to the storage, not to the Site, so two Sites sharing one bucket need one rule
   * carrying both origins -- and applying each Site's rule in turn would leave whichever went last.
   * Core cannot work this out: which configuration fields identify a storage and which merely divide
   * it is the Provider's own business, and a prefix separates Sites inside one storage rather than
   * making two.
   *
   * The value is opaque to Core and is only ever compared, so it must be stable across releases and
   * must never contain a credential.
   */
  storageIdentity(): string;
}

/**
 * What a Provider factory is handed besides its configuration.
 *
 * A Provider needs credentials and must not be able to reach anything else. The context therefore
 * carries no database handle and no general secret accessor: `readSecret` resolves the one reference
 * its own Storage Profile names, and there is no argument that could make it resolve another.
 *
 * It is asynchronous because a secret is fetched, and lazy because a Provider that never uploads
 * anything should never need one. The Local Provider ignores the context entirely.
 */
export type PhisMediaStorageServiceContext = {
  providerId: PhisMediaStorageProviderId;
  /** The Site whose profile this is, for diagnostics; not an authorization input. */
  siteKey: string | null;
  /** The profile's own secret, or null when the profile names none. */
  readSecret: () => Promise<string | null>;
};
