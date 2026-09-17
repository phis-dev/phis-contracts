/**
 * Threads, in the words both ends read them with.
 *
 * A thread is a conversation between people on one Site: two colleagues, a group, two groups, or a
 * customer and a Support queue. Core stores it, the site UI renders it, and an Add-on may be handed a
 * bounded view of one -- three readers of one shape, which is why the shape lives here rather than in
 * any of them.
 *
 * It was two shapes before this file existed. The Site routes answered with database records carrying
 * addresses, `threads:v1` answered with a projection that deliberately carried none, and the Support
 * Module typed itself against the first. The same thread therefore had two descriptions, and the one a
 * reader got depended on which door they came through.
 *
 * Who may see what is not in this file and cannot be: visibility is decided in Core, per reader, and a
 * vocabulary shared with a browser is the last place to state a rule. What is here is what a visible
 * thread looks like once Core has decided it is one.
 */

import type { PhisUserProjection } from "./capabilities.js";

/**
 * Who a thread is between.
 *
 * The kind is fixed when the thread is opened and is not a filter over its participants: it says which
 * conversation this is, and each one is offered, or not, by the Modules a Site runs.
 */
export const PhisThreadKind = {
  /** Staff to Staff, between people who share a group. */
  Direct: 0,
  /** Inside one group, its members among themselves. */
  Group: 1,
  /** Between groups, each participating as a whole. */
  CrossGroup: 2,
  /** A requester and a Support queue's group. */
  Support: 3,
} as const;

export type PhisThreadKindValue =
  (typeof PhisThreadKind)[keyof typeof PhisThreadKind];

/**
 * Where a thread stands.
 *
 * One row carries it, so archiving is the thread being closed for everyone in it rather than one reader
 * hiding it from themselves.
 */
export const PhisThreadStatus = {
  Open: 0,
  Archived: 1,
} as const;

export type PhisThreadStatusValue =
  (typeof PhisThreadStatus)[keyof typeof PhisThreadStatus];

/** What is true of a thread, as bit flags. */
export const PhisThreadFlag = {
  /** No new messages are accepted; what is there stays readable. */
  Locked: 1 << 0,
} as const;

/**
 * What a participant is to the thread, as bit flags.
 *
 * `Requester` is the one that changes what a reader sees rather than what they may do: it marks the
 * person a Support thread is *about*, and internal messages are written past them.
 */
export const PhisThreadParticipantFlag = {
  /** The person this Support thread belongs to. At most one participant carries it. */
  Requester: 1 << 0,
  /**
   * This requester has acknowledged that the conversation is mirrored outside.
   *
   * Their messages are exported only once it is set. A customer's words are their own, and handing them
   * to a third party is not a decision Staff may take for them.
   */
  ExternalConsent: 1 << 1,
  /** Left the thread; their messages stay, and nothing new reaches them. */
  Left: 1 << 2,
  /** Still in it, without being notified. */
  Muted: 1 << 3,
} as const;

/**
 * What is true of one message, as bit flags.
 *
 * `Internal` and `Confidential` answer different questions and are deliberately independent. `Internal`
 * is *who may read it* -- Staff participants, and not the requester the note is about. `Confidential`
 * is *where it may go* -- nowhere outside Core: not to an integration, not into the body of a
 * notification, and not to an Add-on, which is handed the message with its text withheld and this flag
 * set. A customer may set it themselves, which is the case that matters: a password pasted into a
 * Support thread must be readable by the people helping and must never be mirrored anywhere.
 */
export const PhisThreadMessageFlag = {
  Internal: 1 << 0,
  Confidential: 1 << 1,
  /** Edited after it was written, at its source where it came from one. */
  Edited: 1 << 2,
  /** Withdrawn: the text is gone, the message stays so the conversation still reads. */
  Redacted: 1 << 3,
  /** Written by an integration from something outside, and therefore never exported back to it. */
  Imported: 1 << 4,
} as const;

/**
 * Which kinds of thread a Site offers at all, as bit flags.
 *
 * Not a switch anybody flips. It is the union of what the Site's active Modules declare, materialized
 * the way declared Media Space kinds are, so a Site gains a kind by running a Module that needs it. A
 * kind that stops being declared hides its threads and deletes nothing.
 */
export const PhisSiteThreadKindFlag = {
  Direct: 1 << 0,
  Group: 1 << 1,
  CrossGroup: 1 << 2,
  Support: 1 << 3,
} as const;

/** One thread, as a list shows it. */
export type PhisThreadSummary = {
  id: number;
  kind: PhisThreadKindValue;
  status: PhisThreadStatusValue;
  flags: number;
  subject: string | null;
  createdAt: string;
  updatedAt: string;
  latestMessageAt: string | null;
  /** Whether this reader has messages they have not seen. */
  unread: boolean;
};

/**
 * Who is in a thread.
 *
 * A group participates as a group: its members are resolved when the thread is read, so somebody who
 * joins the group afterwards is in the conversation and somebody who leaves it is not. Expanding a
 * group into people at the moment it was named would have frozen a membership that keeps moving.
 */
export type PhisThreadParticipant =
  | { kind: "user"; user: PhisUserProjection; flags: number }
  | { kind: "group"; groupId: number; name: string; flags: number };

/**
 * Who wrote a message.
 *
 * A person is projected as a group member sees one: a display name, a company where the group discloses
 * it, never an address. An integration is not dressed up as a person -- it says which provider it is and
 * carries the outside name it is relaying, so "octocat on GitHub" reads as what it is.
 */
export type PhisThreadMessageAuthor =
  | { kind: "user"; user: PhisUserProjection }
  | {
      kind: "integration";
      providerId: string;
      externalName: string | null;
      externalUrl: string | null;
    }
  | { kind: "system" };

export type PhisThreadMessage = {
  id: number;
  author: PhisThreadMessageAuthor;
  /** Null where the text is withheld from this reader: redacted, or confidential to an Add-on. */
  bodyText: string | null;
  bodyMarkdown: string | null;
  flags: number;
  createdAt: string;
  updatedAt: string;
};

export type PhisThreadDetail = {
  thread: PhisThreadSummary;
  participants: PhisThreadParticipant[];
  /** A window of the conversation, oldest first. */
  messages: PhisThreadMessage[];
  /** Whether older messages remain beyond the window `messages` carries. */
  hasMoreMessages: boolean;
};

/**
 * The threads capability: `@phis/server/threads:v1`.
 *
 * **With an actor, an Add-on sees what its actor sees.** Every read goes through the predicate Core
 * applies to its own thread routes, so there is no listing here a person could not have obtained
 * themselves, and no way to turn a Site's threads into something an Add-on can walk.
 *
 * **Without an actor -- a job, a verified hook, an event -- it reaches a thread it owns or one it is
 * linked to**, and nothing else. It owns the threads it opened with no actor behind it. It is linked to
 * a thread when a `resource-links:v1` row of its own carries `Synced` and points at that thread, at a
 * ticket, or at a ticket task whose thread it is -- and that row was written by a person who could see
 * the thread. The link is therefore that person's consent, for one integration and one conversation,
 * and removing it withdraws the access. There is still no listing: an actorless Add-on finds a thread by
 * the reference it recorded, never by walking.
 *
 * `Internal` messages are never handed to an actorless Add-on. `Confidential` ones arrive with their
 * text withheld, whatever the Add-on's actor could read.
 */
export type PhisThreadsCapabilityV1 = {
  /** The threads the acting user is in, newest activity first. Needs an actor. */
  list(options?: {
    page?: number;
    pageSize?: number;
    unreadOnly?: boolean;
  }): Promise<PhisThreadSummary[]>;
  /** One thread with a window of its messages, or null where it is not reachable. */
  get(
    threadId: number,
    options?: { messageLimit?: number; beforeMessageId?: number | null },
  ): Promise<PhisThreadDetail | null>;
  /**
   * Opens a thread.
   *
   * With no actor the thread is opened as this Add-on's own, which is what an integration reporting an
   * outside event needs and what makes the conversation reachable afterwards. Participants are named as
   * user ids, group ids, or both, and every one is checked against this Site before anything is written.
   *
   * `messageFlags` is normalized rather than trusted: `Internal` requires an actor who is Staff, and
   * `Imported` is Core's to set on what arrives through an integration.
   */
  create(input: {
    kind: PhisThreadKindValue;
    subject?: string | null;
    message: string;
    messageMarkdown?: string | null;
    messageFlags?: number;
    participantUserIds?: number[];
    participantGroupIds?: number[];
    /** This Add-on's own reference for the message, unique within this Add-on. */
    externalRef?: string;
    externalAuthor?: { name: string; url?: string };
  }): Promise<PhisThreadDetail>;
  /**
   * Adds a message to a reachable thread.
   *
   * Idempotent on `externalRef` where one is given: the same reference answers with the thread as it
   * stands instead of writing a second message, which is what a webhook delivered twice needs.
   */
  reply(input: {
    threadId: number;
    message: string;
    messageMarkdown?: string | null;
    messageFlags?: number;
    externalRef?: string;
    externalAuthor?: { name: string; url?: string };
  }): Promise<PhisThreadDetail | null>;
  /** Brings more people into a reachable thread. Adds only; it never removes. */
  addParticipants(input: {
    threadId: number;
    participantUserIds?: number[];
    participantGroupIds?: number[];
  }): Promise<PhisThreadDetail | null>;
  /** Moves a reachable thread between open and archived, for everyone in it. */
  setStatus(input: {
    threadId: number;
    status: PhisThreadStatusValue;
  }): Promise<boolean>;
  /** Marks the thread read for the acting user, up to its newest message or to one named. */
  markRead(input: { threadId: number; messageId?: number | null }): Promise<boolean>;
  /**
   * The thread carrying one of this Add-on's own message references, or null.
   *
   * How an actorless Add-on arrives at a thread at all. The reference is the one it passed to `create`
   * or `reply`, so it finds its way back to a conversation it already knows about and to no other.
   */
  findByExternalRef(externalRef: string): Promise<PhisThreadDetail | null>;
};
