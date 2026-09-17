/**
 * References from a Phi record to something in another system: `@phis/server/resource-links:v1`.
 *
 * A ticket that is also a GitHub issue, a task that is also a pull request, a thread that is also a
 * conversation somewhere else. The reference is a row of its own rather than a column on the record,
 * because a record may have several at once, across several systems, and a column per system is a
 * schema change per integration.
 *
 * The provider is the Add-on that wrote the link, and it is the whole of the ownership rule: an Add-on
 * reads and writes its own links and sees no others. Two integrations pointing at one ticket therefore
 * do not have to know about each other, and removing one takes its references with it.
 *
 * The link is also what an Add-on's actorless access is made of. A person who can see a record writes
 * the link; from then on the Add-on may read and append to the conversation that record carries, and
 * nothing beyond it. Unlinking ends that -- which is why `Synced` is stated per link rather than
 * assumed: a reference that is only a pointer should not become a standing permission.
 */

/** What a link points away from. */
export type PhisResourceLinkSubject =
  | { kind: "thread"; id: number }
  | { kind: "ticket"; id: number }
  | { kind: "ticketTask"; id: number };

/** What is true of a link, as bit flags. */
export const PhisResourceLinkFlag = {
  /**
   * The two sides are kept in step, and this Add-on may reach the subject's thread without an actor.
   *
   * A link without it is a reference someone recorded: it is shown, it is followed, and it grants
   * nothing.
   */
  Synced: 1 << 0,
} as const;

/**
 * One reference, as Core stores it.
 *
 * `type` and `state` are the provider's own vocabulary -- an issue, a pull request, open, merged -- and
 * Core never interprets either. It stores them, indexes the external id against them, and hands them
 * back; what `21` means is the Add-on's business, exactly as a role name is.
 */
export type PhisResourceLink = {
  id: number;
  subject: PhisResourceLinkSubject;
  type: number;
  externalId: string;
  url: string | null;
  state: number | null;
  flags: number;
  createdAt: string;
  updatedAt: string;
};

/**
 * The resource links capability: `@phis/server/resource-links:v1`.
 *
 * Bounded twice: to this Add-on's own links, and to subjects the acting user may reach. Writing needs
 * an actor -- a link is a person saying these two things belong together, and it is what later lets the
 * Add-on act with no person there. A hook or a job may read the links it wrote and may not make new
 * ones.
 */
export type PhisResourceLinksCapabilityV1 = {
  /** This Add-on's links on one subject, or none where the subject is out of reach. */
  list(subject: PhisResourceLinkSubject): Promise<PhisResourceLink[]>;
  /**
   * Records a reference, or hands back the one that is already there.
   *
   * Asking twice is how an id is learned, the way a declared group is: `(type, externalId)` is unique
   * within this Add-on and this Site, so a second call answers with the first link instead of failing.
   */
  link(input: {
    subject: PhisResourceLinkSubject;
    type: number;
    externalId: string;
    url?: string | null;
    state?: number | null;
    flags?: number;
  }): Promise<PhisResourceLink>;
  /** Moves a link's provider-local state. */
  setState(input: { linkId: number; state: number | null }): Promise<boolean>;
  /** Removes a link, and with it whatever actorless reach it granted. */
  unlink(linkId: number): Promise<boolean>;
  /** One link of this Add-on by the external id it recorded, or null. */
  findByExternalId(input: {
    type: number;
    externalId: string;
  }): Promise<PhisResourceLink | null>;
};
