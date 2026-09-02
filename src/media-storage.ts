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
  /**
   * Told that nobody is waiting for this write any more.
   *
   * A body that stops arriving does not, on its own, end the write: the Client is gone or silent while
   * the Provider sits waiting for a byte that will never come. Core aborts the read either way, so an
   * Adapter that ignores this still ends -- with a torn object it must clean up. Honouring it is how an
   * Adapter stops paying for the write, and for a remote Provider that is a request in flight.
   */
  signal?: AbortSignal;
};

export type PhisMediaObjectHead = {
  /**
   * What this Provider can attest about the object's content, if anything.
   *
   * Deliberately not `etag`. An ETag is an HTTP cache validator and each Provider fills it with what it
   * likes -- a real SHA-256 for Core's own storage, an MD5 for a single-request S3 PUT, and a digest of
   * part digests above that, which hashes no bytes anyone uploaded. Reading one as a content hash is
   * how an MD5 ends up recorded as a SHA-256.
   *
   * Null is the correct answer wherever the Provider cannot say. A missing digest is a fact Core can
   * record; a wrong one invites a comparison that quietly finds nothing.
   */
  checksum?: { algorithm: PhisMediaChecksumAlgorithm; value: string } | null;
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
  /**
   * What the client says it is about to send, and under which algorithm, as lowercase hex.
   *
   * Present only for a Profile whose probe found the endpoint verifies that algorithm: an adapter that
   * receives it must sign it into the request and name the header the client has to send, so a body
   * that does not match is refused there and never becomes an object. That refusal is what makes the
   * figure trustworthy -- Core records the client's number because a wrong one would not have got this
   * far, not because the client is believed.
   *
   * The algorithm travels with the value because the adapter does not get to pick one. It was settled
   * for this Profile when it was probed, and a plan that quietly used another would produce a digest
   * that is correct and yet incomparable with every digest recorded before it.
   *
   * Absent means the digest will be established some other way, which is Core hashing the body as it
   * streams through. An adapter must never invent one.
   */
  checksum?: { algorithm: PhisMediaChecksumAlgorithm; value: string };
};

export type PhiMediaUploadCompletionInput = {
  storageKey: string;
  /** Whatever the plan's issuer asked the Client to bring back. Core passes it through unread. */
  completion?: unknown;
};

/**
 * What one endpoint turned out to be able to do, established by trying rather than by asking.
 *
 * A Provider is one adapter over many backends: the S3 adapter speaks to AWS, to MinIO and to Garage,
 * and they do not agree on everything. So the capability belongs to the configured endpoint and not to
 * the code, and no field of the configuration would tell Core which one it is looking at.
 *
 * Establishing it once, when an operator sets a Profile up, also moves a whole class of failure
 * forward: today a wrong endpoint, a missing permission or a bucket that does not exist is discovered
 * by whoever uploads first, and reaches them as their error rather than as a misconfiguration.
 */
/**
 * The digests this system knows how to record, named so what is stored says what it is.
 *
 * One column holding "a checksum" is how an MD5 ends up in a field called SHA-256 and nobody notices:
 * an `ETag` is whatever a Provider decided to put there, and Providers disagree. Every recorded digest
 * therefore carries the algorithm that produced it.
 */
export const PHIS_MEDIA_CHECKSUM_ALGORITHMS = [
  "sha256", "sha512", "xxhash128", "crc64nvme", "crc32c", "crc32", "md5",
] as const;

export type PhisMediaChecksumAlgorithm = (typeof PHIS_MEDIA_CHECKSUM_ALGORITHMS)[number];

/**
 * The digests strong enough to answer "is this the same file", rather than only "did it arrive intact".
 *
 * The distinction is not fussiness. CRC is linear: given a stored object, a second file colliding with
 * it is algebra rather than computation, and MD5 collisions are a download. Both remain perfectly good
 * evidence that a transfer was not corrupted, which is the other thing a checksum is for.
 *
 * What rides on this is duplicate detection, and a collision there is a refused upload rather than a
 * substituted file -- so the cost of trusting a weak digest is that someone who may already write to a
 * Space can stop one file from entering it. Small, but not nothing, and free to avoid.
 */
export const PHIS_MEDIA_IDENTITY_CHECKSUM_ALGORITHMS: readonly PhisMediaChecksumAlgorithm[] =
  ["sha256", "sha512"];

export function isPhisMediaIdentityChecksum(algorithm: string | null | undefined) {
  return PHIS_MEDIA_IDENTITY_CHECKSUM_ALGORITHMS.includes(algorithm as PhisMediaChecksumAlgorithm);
}

/**
 * Which of the digests an endpoint verifies a Profile will record.
 *
 * Chosen once, when the Profile is probed, and never per upload: duplicate detection compares digests,
 * and two are only comparable under the same algorithm. Deterministic on purpose -- the same measured
 * endpoint always yields the same answer, so re-probing an unchanged endpoint does not silently start a
 * second cohort of objects that can never be told to match the first.
 *
 * Only identity-grade digests are eligible. A CRC an endpoint also verifies still proves a transfer
 * intact, and Core records it when that is what arrived; it is simply not what a Profile asks for.
 */
export function choosePhisMediaChecksumAlgorithm(
  probe: { verifiedAlgorithms: readonly PhisMediaChecksumAlgorithm[] } | null | undefined,
): PhisMediaChecksumAlgorithm | null {
  if (!probe) return null;
  for (const candidate of PHIS_MEDIA_IDENTITY_CHECKSUM_ALGORITHMS) {
    if (probe.verifiedAlgorithms.includes(candidate)) return candidate;
  }
  return null;
}

export type PhisMediaStorageProbe = {
  /** Whether a small object could be written, read back, and removed again. */
  writable: boolean;
  /**
   * Which digests the endpoint was found to check against the bytes it is given.
   *
   * An algorithm is listed only when a correct digest was accepted *and* a deliberately wrong one was
   * refused. Accepting alone proves nothing: an endpoint that ignores the header accepts everything,
   * and a checksum nobody verifies is a claim by the uploader wearing the shape of proof.
   *
   * What it buys is a direct upload that still yields a trustworthy digest -- the bytes go from the
   * client to the storage without passing through Core, and the storage refuses them if they are not
   * what the client said they were. Which of the listed algorithms is used is settled once, per
   * Profile, rather than per upload: what is recorded has to stay comparable with what was recorded
   * before it, and an algorithm that changes underneath splits one set of objects into two that can
   * never be told to be the same.
   */
  verifiedAlgorithms: PhisMediaChecksumAlgorithm[];
  /**
   * Whether a digest survives an object arriving in parts.
   *
   * A checksum signed into one PUT covers that PUT. Above the single-request limit an object is
   * assembled from parts, and the usual answer is a digest of the part digests -- a number that hashes
   * no bytes anyone uploaded. An endpoint that computes over the whole assembled object instead keeps
   * the guarantee at any size; one that does not confines it to what fits in one request.
   */
  verifiesWholeMultipartObject: boolean;
  /** What did not answer, in an operator's terms. Empty when everything did. */
  findings: string[];
};

export interface PhisMediaStorageAdapter {
  /**
   * Tries what this endpoint can do, and leaves nothing behind.
   *
   * Runs when a Profile is configured, not per upload. It writes a small object under a key of its own
   * and removes it again; a Provider that cannot be probed answers with `writable: false` and a finding
   * rather than throwing, because a Profile that cannot be reached is an answer too.
   */
  probeCapabilities(): Promise<PhisMediaStorageProbe>;
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
