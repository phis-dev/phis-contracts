/**
 * The Support vocabulary Core and the Support Module must spell the same way.
 *
 * A ticket type used to be a number out of a fixed list compiled into phi-server, which settled for
 * every Site what kinds of work exist and left no room for a Site to say that one of its kinds is
 * handled in the open and another is not. The list becomes a per-Site catalogue; what stays Core's --
 * and therefore belongs here -- is what the entries in that catalogue may say about themselves.
 *
 * Two ends read these: Core, which decides what a closing issue does to a ticket and what may leave the
 * Site, and the Support Module, which shows a person the notice that goes with it before they write.
 */

/**
 * What is true of a ticket type, as bit flags.
 *
 * `External` is a flag rather than a type of its own because it cuts across every type: a bug may be
 * handled internally or in a public repository, and a type list carrying both would have to name each
 * kind twice.
 */
export const PhisSupportTicketTypeFlag = {
  /**
   * The conversation of a ticket of this type is mirrored to a linked external system.
   *
   * What still never leaves, whatever this says: internal notes, confidential messages, system messages,
   * and anything that arrived from the integration in the first place.
   */
  External: 1 << 0,
  /**
   * The work is a code change.
   *
   * It is what makes `CodeAccepted` meaningful: a type without it has no merge to wait for, so its
   * tickets are closed by a person.
   */
  CodeChange: 1 << 1,
} as const;

/**
 * What is true of a Support queue, as bit flags.
 *
 * `Entry` is where work arrives when nobody named a queue. It is a mark a Site sets rather than a
 * default Core picks, because an unrouted ticket is a ticket nobody is looking at: without one, opening
 * a ticket without naming a queue is refused instead of landing wherever the first row happens to be.
 */
export const PhisSupportQueueFlag = {
  Entry: 1 << 0,
} as const;

/**
 * What ends a ticket of this type.
 *
 * `Resolved` and `Closed` stay distinct throughout: resolved is technically done, closed is confirmed.
 * Neither policy ever resolves a ticket because an issue was closed as not planned -- that is a decision
 * somebody took about the external work, not about the Support work, and a repository's own stale
 * automation must not be able to close a customer's ticket.
 */
export const PhisSupportClosePolicy = {
  /** A Supporter confirms. The default, and the only one available without a code change. */
  Confirm: 0,
  /**
   * The merge is acceptance.
   *
   * A merged pull request completes its task; when every engineering task is done the ticket is
   * resolved, and the requester window or a Supporter closes it. Waiting for a release instead would
   * leave a ticket open for work nobody is doing any more -- what a release adds is what is said, not
   * when the state moves.
   */
  CodeAccepted: 1,
} as const;

export type PhisSupportClosePolicyValue =
  (typeof PhisSupportClosePolicy)[keyof typeof PhisSupportClosePolicy];

/**
 * How long a resolved ticket waits for its requester before it closes itself, in days.
 *
 * The Site default, which a ticket type may narrow or widen, and `0` means the type's tickets wait for a
 * Supporter instead. The window starts when the requester could actually have the fix -- at the release
 * message where releases are tracked, at the merge otherwise -- so it is a chance to object rather than
 * a deadline for reading email.
 */
export const PHIS_SUPPORT_REQUESTER_WINDOW_DEFAULT_DAYS = 14 as const;
