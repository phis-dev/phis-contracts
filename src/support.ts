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
  /**
   * A requester may choose this type when they open a ticket.
   *
   * `External` and `CodeChange` describe what happens to the work; this one describes who may ask for
   * it, and neither of the others answers that. A listing filtered by them would offer a person a type
   * whose conversation is mirrored into a repository, chosen by someone with no way to know so.
   *
   * Off by default, so a type a Site adds is Staff-only until the Site says otherwise -- the same
   * default-deny that `site_media_config.flags` uses, for the same reason. Where a requestable type also
   * carries `External`, the route that offers it says so before the person writes rather than after.
   */
  Requestable: 1 << 2,
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

/**
 * A queue a Module needs the Site to have, named rather than created.
 *
 * `groupKey` names a group from the same `seed`, not a group id: what a Module declares cannot contain
 * an id, because the row it refers to does not exist until the same publish makes it. The materialization
 * resolves the two in order, which is why the order is not the Module's to script.
 *
 * A Site that runs Support needs exactly one of these marked `Entry`, and the declaration is where that
 * comes from: a Site with no Entry queue refuses a ticket that names no queue rather than dropping it
 * somewhere, and nobody should have to know that before they can answer anybody.
 */
export type PhisDeclaredSupportQueue = {
  readonly key: string;
  readonly name: string;
  readonly groupKey: string;
  /** `PhisSupportQueueFlag`. Absent is none. */
  readonly flags?: number;
};

/**
 * A ticket type a Module needs the Site to have, named rather than created.
 *
 * What a Site opens with before anybody has administered anything. It is declared without
 * `Requestable`, because a type that arrives with the Module has not been looked at by the Site yet, and
 * offering it to the public is a decision the Site takes rather than one it inherits.
 */
export type PhisDeclaredSupportTicketType = {
  readonly key: string;
  readonly name: string;
  /** `PhisSupportTicketTypeFlag`. Absent is none. */
  readonly flags?: number;
  /** Absent is `Confirm`, the only policy available without a code change. */
  readonly closePolicy?: PhisSupportClosePolicyValue;
};

/**
 * One ticket, as an Add-on that is linked to it may see it.
 *
 * Without its conversation, which is the thread and is read through `threads:v1` with the reader's own
 * visibility applied -- internal notes withheld, confidential bodies withheld. Reproducing that rule
 * here would be a second answer to a question that already has one.
 *
 * The type is carried whole rather than as an id, because what an integration has to decide it decides
 * from the type: whether anything may leave the Site at all, and what ends the ticket. An Add-on asking
 * for the id and then for the type would be two calls to learn one thing.
 */
export type PhisSupportTicket = {
  id: number;
  /** Its conversation, to be read and appended to through `threads:v1`. */
  threadId: number;
  subject: string;
  /** `SUPPORT_TICKET_STATUS_*`: new, triaged, assigned, in progress, waiting, escalated, resolved, closed. */
  status: number;
  /** The queue it was taken into, or none while it is still in triage. */
  queueId: number | null;
  type: {
    id: number;
    key: string;
    /** `PhisSupportTicketTypeFlag`. */
    flags: number;
    closePolicy: PhisSupportClosePolicyValue;
  };
  createdAt: string;
  updatedAt: string;
};

/**
 * One piece of work on a ticket.
 *
 * An issue or a pull request hangs on a task rather than on the ticket, because one ticket may need
 * several and because resolving an issue does not resolve the Support work. A task is completed by
 * whoever did it; the ticket decides for itself when it is done.
 */
export type PhisSupportTicketTask = {
  id: number;
  ticketId: number;
  /** `SUPPORT_TICKET_TASK_TYPE_*`; `2` is engineering. */
  type: number;
  /** `SUPPORT_TICKET_TASK_STATUS_*`: open, in progress, blocked, done, canceled. */
  status: number;
  title: string;
  description: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * The Support capability: `@phis/server/support:v1`.
 *
 * The workflow record around a conversation -- the type, the queue, the status, the work -- for an
 * integration that mirrors that conversation somewhere else. It exists so that a package in its own
 * repository can reach a Site's tickets without depending on `@phis/support`, which is only the
 * Module: the tables and the rules are Core's.
 *
 * **Reach is the thread's answer, never a second one.** A ticket is readable when its thread is, which
 * for an Add-on with nobody behind it means one of the two ways in `threads:v1` has: it opened the
 * thread itself, or a person who could see the thread linked it to something of this Add-on's and
 * marked that link synced. There is no listing, and no search. An Add-on finds a ticket it was given
 * and never walks a Site's.
 *
 * **What it may not do.** It does not move a ticket's status. Closing is the ticket's own rule -- an
 * issue completes its task, and whether that resolves the Support work depends on the type's close
 * policy and on the other tasks -- so an integration that could set the status directly would be
 * deciding something it cannot see all of.
 */
export type PhisSupportCapabilityV1 = {
  /** One ticket, or null where it is out of reach or absent. */
  get(ticketId: number): Promise<PhisSupportTicket | null>;
  /** The ticket a thread belongs to, for an event that arrived naming the conversation. */
  findByThread(threadId: number): Promise<PhisSupportTicket | null>;
  /**
   * Opens a ticket, its thread owned by this Add-on.
   *
   * For work that arrived from the other side -- an issue opened in a watched repository. The type and
   * the queue are the Site's own rows and are named by key, because an id means nothing in an Add-on's
   * configuration and would not survive the Site being rebuilt.
   */
  create(input: {
    typeKey: string;
    queueKey?: string;
    subject: string;
    message: string;
    externalRef?: string;
  }): Promise<PhisSupportTicket>;
  /** The work on one ticket, in the order the Site keeps it. */
  listTasks(ticketId: number): Promise<PhisSupportTicketTask[]>;
  /** Records a piece of work, which is what a linked issue hangs on. */
  addTask(input: {
    ticketId: number;
    type: number;
    title: string;
    description?: string;
  }): Promise<PhisSupportTicketTask>;
  /** Moves one task, and only the task. */
  setTaskStatus(input: { taskId: number; status: number }): Promise<PhisSupportTicketTask>;
};
