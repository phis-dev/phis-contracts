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

/** Which bytes of an object somebody wants: the first one, and how many. */
export type PhisMediaObjectRange = {
  /** The first byte, counted from zero and inside the object. */
  offset: number;
  /** How many bytes are wanted. An implementation may serve fewer, and then says so. */
  length: number;
};

export type PhisMediaObjectRangeStream = {
  body: ReadableStream<Uint8Array>;
  /** What was served, which is what a `Content-Range` may claim -- never merely what was asked for. */
  range: PhisMediaObjectRange;
  /** The object's whole size, so a `Content-Range` can name the total it is a part of. */
  byteSize: number;
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
    }
  | {
      /**
       * The body in several requests, assembled by the Provider.
       *
       * What this buys is not a larger ceiling but a resumable one. A single request that fails at ninety
       * per cent has to be sent again from the first byte, and above a few hundred megabytes on an
       * ordinary connection that is the usual outcome rather than the unlucky one. Each part here fails
       * and repeats on its own.
       *
       * The parts are in order and each covers `partSizeBytes`, except the last, which covers what is
       * left. That is the whole addressing scheme: part *n* is the bytes from `(n - 1) * partSizeBytes`,
       * and a Client that can slice a file needs nothing else.
       *
       * `uploadId` travels out and comes back. The Client returns it, with each part's entity tag, as the
       * `completion` that `completeUpload` assembles from -- and Core keeps its own copy, because the one
       * thing a Client cannot be asked to do is report an upload it has stopped existing to report.
       */
      kind: "multipart-put";
      method: "PUT";
      uploadId: string;
      partSizeBytes: number;
      parts: readonly {
        /** One-based and contiguous, the way every part API counts. */
        partNumber: number;
        url: string;
        headers?: Record<string, string>;
      }[];
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
   * receives it must sign it into the request, so a body that does not match is refused there and never
   * becomes an object. That refusal is what makes the figure trustworthy -- Core records the client's
   * number because a wrong one would not have got this far, not because the client is believed.
   *
   * Signed, and not also named as a header for the Client to repeat. Signing a request that has no body
   * yet puts the digest in the query string, where the signature covers it; a checksum header outside the
   * signed set is refused by a strict endpoint, so naming it costs the upload instead of securing it.
   *
   * The algorithm travels with the value because the adapter does not get to pick one. It was settled
   * for this Profile when it was probed, and a plan that quietly used another would produce a digest
   * that is correct and yet incomparable with every digest recorded before it.
   *
   * Absent means the digest will be established some other way, which is Core hashing the body as it
   * streams through. An adapter must never invent one.
   */
  checksum?: { algorithm: PhisMediaChecksumAlgorithm; value: string };
  /**
   * One digest per part, in part order, as lowercase hex, for a body that is to arrive in parts.
   *
   * The same bargain as `checksum` and for the same reason, one level down: each part's digest is signed
   * into that part's request, so a part whose bytes do not match is refused and never joins the object.
   * Present only together with `mayAssembleFromParts`, and only where the Profile's base algorithm is
   * SHA-256 -- these are SHA-256 digests and an adapter must not offer them under another name.
   *
   * The divisions are `resolvePhiMediaUploadPartSizeBytes` over the same `sizeBytes`, which is how the
   * Client could compute them before this plan existed. An adapter that receives a count not matching that
   * rule must refuse the plan rather than address the parts it was given: the mismatch means the two sides
   * divided the body differently, and every digest after the first would be signed against other bytes.
   *
   * `checksum` alongside this carries the composite these add up to, which is what Core records. The
   * adapter does not need it and must not recompute it.
   */
  partChecksums?: readonly string[];
  /**
   * Whether this Profile may answer with an object assembled from parts.
   *
   * Core's decision and not the Provider's, for the same reason `checksum` above is: a Provider does not
   * get to grade its own endpoint. What Core weighs is the size -- a single request that fails at ninety
   * per cent is sent again from the first byte, and above a few hundred megabytes that is the usual
   * outcome -- against what the object will be able to attest afterwards.
   *
   * It is a permission and not a capability: the Provider may be perfectly able and still not be asked.
   *
   * Absent means no. A Provider that cannot assemble parts ignores it either way.
   */
  mayAssembleFromParts?: boolean;
};

/**
 * What a storage is asked to clean up on its own, and how long it must wait first.
 *
 * Both figures follow from how long an upload session may live, which is Core's to know. They are days
 * because that is the only unit an object lifecycle rule takes, and they are more than one day because such
 * a rule is evaluated asynchronously -- a rule of "one day" can fire on an upload that still has hours to
 * run, and aborting a body somebody is in the middle of sending is worse than paying for it a while longer.
 *
 * `stagingKeyPrefixes` are Core's key space, without whatever prefix a Provider adds of its own; the
 * Provider prepends that the same way it does for an object key.
 *
 * **An empty prefix list means no expiry rule at all, and an implementation must treat it that way.** An
 * expiry rule matching everything would delete every object in the storage after two days, which is the one
 * mistake in this area that cannot be undone -- so "expire nothing" and "expire everything" must never be
 * the same argument.
 */
export type PhisMediaLifecyclePolicy = {
  /**
   * Days after an upload was started before the storage may abort what was never completed.
   *
   * This is the whole reason the rule exists. A Client that reports its own failure is handled without any
   * of this, and one that crashes, loses its connection or has its tab killed reports nothing -- and what it
   * leaves behind is parts that are paid for and cannot be listed.
   */
  abortIncompleteMultipartUploadAfterDays: number;
  /** Key prefixes, in Core's key space, under which a body is staged before it becomes an Asset. */
  stagingKeyPrefixes: readonly string[];
  /** Days a staged object may sit under those prefixes before the storage removes it. */
  expireStagedObjectsAfterDays: number;
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
  "sha256", "sha512", "sha256-composite", "xxhash128", "crc64nvme", "crc32c", "crc32", "md5",
] as const;

export type PhisMediaChecksumAlgorithm = (typeof PHIS_MEDIA_CHECKSUM_ALGORITHMS)[number];

/*
 * The division and the composite's recorded form live in `./media.ts`, and are re-exported here.
 *
 * They are the one part of this contract a browser has to compute as well: the Client hashes the parts
 * before a plan exists, because a part digest can only be signed into a part request if it is known when
 * that request is signed. So the rule cannot sit behind the Add-on surface, and it must not be written
 * twice -- two copies of a division are two divisions the day one of them is edited.
 */
export {
  PHIS_MEDIA_UPLOAD_MAX_PART_COUNT,
  PHIS_MEDIA_UPLOAD_PART_SIZE_BYTES,
  formatPhiMediaCompositeChecksum,
  parsePhiMediaCompositeChecksum,
  resolvePhiMediaUploadPartCount,
  resolvePhiMediaUploadPartSizeBytes,
} from "./media.js";

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
  ["sha256", "sha512", "sha256-composite"];

/**
 * Why `sha256-composite` is identity-grade although it hashes digests rather than bytes.
 *
 * It is `SHA256` over the concatenated part digests of a body divided by a fixed rule. For the question
 * duplicate detection asks -- are these the same bytes -- it is as hard to forge as SHA-256 itself: a
 * second file matching one requires a SHA-256 collision in some part. What it cannot do is compare across
 * divisions, which is why the division is written into the value and why the rule above is frozen.
 *
 * It exists because a browser cannot produce the other kind for a large file. Web Crypto has no
 * incremental digest, so a whole-object SHA-256 means holding the entire body in memory; a part digest is
 * one part, and the composite over those is a few kilobytes. The choice is not between this and a
 * whole-object digest, it is between this and no digest at all.
 */

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
 *
 * `sha256-composite` is not eligible either, for a different reason: it is not something an endpoint
 * verifies, it is the form a SHA-256 takes when a body arrived in parts. A Profile records a base
 * algorithm, and an object assembled from parts under a `sha256` Profile carries the composite of it.
 */
export function choosePhisMediaChecksumAlgorithm(
  probe: { verifiedAlgorithms: readonly PhisMediaChecksumAlgorithm[] } | null | undefined,
): PhisMediaChecksumAlgorithm | null {
  if (!probe) return null;
  for (const candidate of PHIS_MEDIA_IDENTITY_CHECKSUM_ALGORITHMS) {
    if (candidate === "sha256-composite") continue;
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
  /** What did not answer, in an operator's terms. Empty when everything did. */
  findings: string[];
};

/*
 * There is deliberately no "does a whole-object digest survive multipart" answer here, and adding one
 * back would measure something the API forbids: `ChecksumType: FULL_OBJECT` is accepted only for the CRC
 * algorithms, while `SHA1` and `SHA256` take `COMPOSITE` alone. A probe asking for a whole-object SHA-256
 * over an assembled object therefore always fails, on every compliant endpoint, and a permission built on
 * that answer can never open. What an object assembled from parts carries is `sha256-composite`, which is
 * why that is an algorithm rather than a missing digest, and whether to assemble at all is a question
 * about size -- `mayAssembleFromParts`.
 */

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
  /**
   * The whole object at once, for code that has to look at every byte.
   *
   * Image processing, font subsetting and content sniffing are what this is for: they hold the bytes
   * because they read them, and no stream would change that. Serving an object to somebody is not one
   * of those cases -- see `getObjectStream`.
   */
  getObject(storageKey: string): Promise<Buffer | null>;
  /**
   * The object as it arrives, for code that only passes it on.
   *
   * Delivery reads nothing: it copies bytes from the Provider to whoever asked, and holding the whole
   * object to do that makes the largest object a Site accepts the amount of memory one download costs.
   * A Provider that stores remotely hands back its own response body, and the Local adapter a file read
   * stream, so nothing between the two ever holds more than what is in flight.
   *
   * `null` means the object is not there, the same answer `getObject` gives.
   */
  getObjectStream(storageKey: string): Promise<ReadableStream<Uint8Array> | null>;
  /**
   * Part of an object as it arrives, for serving a `Range` request.
   *
   * What this is for is seeking. A browser asked for a video cannot start in the middle without it, and
   * Safari commonly declines to play at all where a server answers `200` to a `Range` -- so delivery
   * without this is delivery of files people download, not of media people scrub through.
   *
   * It reports the range it **actually** produced rather than echoing the one it was given, and that is
   * the point of the shape. A `Content-Range` is a claim about bytes; a Provider that quietly ignored the
   * request and returned the whole object would otherwise turn that claim into a lie, and the caller
   * would frame a complete body as a partial one. Comparing what was asked with what came back is what
   * lets delivery answer `200` in that case instead.
   *
   * `offset` is the first byte, `length` is how many are wanted. An implementation clamps `length` to the
   * end of the object and says so in what it returns; the caller has already established that the offset
   * is inside the object, because it knows the size and a range beyond it is a `416` rather than a read.
   * A `length` of zero -- asked for, or left after clamping -- is an empty body and not an error.
   *
   * `null` means the object is not there, the same answer `getObjectStream` gives.
   */
  getObjectRangeStream(
    storageKey: string,
    range: PhisMediaObjectRange,
  ): Promise<PhisMediaObjectRangeStream | null>;
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
   * States what the storage is to clean up by itself, because Core cannot see it and never will.
   *
   * The reason this is not a sweeper is that the two things it names are invisible to the side that would
   * have to sweep them. An unfinished multipart upload is billed from the moment it opens and appears in no
   * object listing at all: only the storage knows it exists, and only the Client that has gone away could
   * have named it. A staged object whose session expired is findable, but reaching it means opening
   * Providers on behalf of sessions a request has no business touching -- which is why expiry deliberately
   * releases the reservation and leaves storage alone.
   *
   * So the rule is written once, when a Profile is written, exactly as the CORS rule is. What Core knows is
   * how long an upload may take and which keys are staging; what the storage knows is how to express "stop
   * paying for this".
   *
   * Replaced whole, never merged, for the same reason CORS is: a rule has to state what is true now rather
   * than accumulate what once was. A Provider with no such notion, such as the Local one, implements it as
   * a no-op -- its files are Core's own and an operator command is what removes them.
   */
  applyLifecyclePolicy(policy: PhisMediaLifecyclePolicy): Promise<void>;
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
