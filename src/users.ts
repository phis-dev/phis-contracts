import type { PhisEntitlementSubject } from "./entitlements.js";

/**
 * A person of a Site as an Add-on may learn of them: `@phis/server/users:v1`.
 *
 * Until this capability an Add-on knew a person by an opaque subject, a user id and at most a display
 * name; an e-mail address, a telephone number or an address never reached one. Support has to recognise
 * a caller, accounting has to see where an order goes, an invoice needs the address it is issued to, and
 * a bridge to another system has to carry a customer over. Each of those is a person acting on this Site
 * or an integration the Site's admin let in, and Core decides which of the two a request is.
 *
 * What is answered follows the acting person, field by field (`PhisUserField`):
 *
 * | Field     | Support (`support` access) | Accounting (`accounting` access), Site Admin | The person themself |
 * | --------- | -------------------------- | -------------------------------------------- | ------------------- |
 * | `name`    | yes                        | yes                                          | yes                 |
 * | `email`   | yes                        | yes                                          | yes                 |
 * | `phone`   | yes                        | yes                                          | yes                 |
 * | `address` | no                         | yes                                          | yes, their own      |
 *
 * A Maintainer holds both accesses. Everybody else is answered nothing. Without an acting person -- a job,
 * an event handler -- Core answers only an Add-on whose manifest asks for background access
 * (`PhisAddonUsersAccess.background`) and to which the Site's admin granted it for this Site; the grant is
 * per Site, can be withdrawn at any time, and a manifest asking for more fields than were granted keeps the
 * old grant until the admin grants again. A field the manifest does not list in `fields` is refused on
 * every road. Every answer that carries personal data is written to the Site's access log (who, which
 * Add-on, which road, which subjects, which fields), kept as long as the Site's setting says (90 days
 * unless changed).
 *
 * Fields the acting person may not read are absent from the answer, not an error: a list shown to a
 * Supporter and to an Accountant is the same request.
 *
 * An Add-on keeps the subject and the address ids, never copies of names, e-mail addresses or numbers,
 * unless a record of its own must hold them as they were (which is what an address id already gives).
 */

/** The groups of personal data a request names. */
export const PHIS_USER_FIELDS = ["name", "email", "phone", "address"] as const;
export type PhisUserField = (typeof PHIS_USER_FIELDS)[number];

/** How many people one `describe` names at most; more are refused. */
export const PHIS_USERS_DESCRIBE_MAX = 100;

/**
 * One person as `describe` answers them: the subject always, every other part only where it was asked
 * for and may be read. `name` holds the profile's names and company; `phone` the profile's business
 * telephone and mobile number, which apply on every Site as the rest of the profile does; `addresses` the
 * person's current addresses on this Site (`Removed` and `Superseded` ones are left out).
 */
export type PhisUserDescription = {
  subject: PhisEntitlementSubject;
  name?: {
    firstName: string;
    lastName: string;
    /** The name the person is shown under, or null where they chose none. */
    displayName: string | null;
    companyName: string | null;
  };
  /** The person's primary e-mail address. */
  email?: string | null;
  phone?: {
    /** Business telephone, as the person typed it. */
    phone: string | null;
    mobile: string | null;
  };
  addresses?: readonly PhisSiteAddress[];
};

/**
 * What an address is for and where it stands, as bit flags.
 *
 * An address may be both a billing and a shipping address. At most one address of a person on a Site
 * carries `DefaultBilling`, at most one `DefaultShipping`; a checkout proposes those and offers the rest.
 */
export const PhisSiteAddressFlags = {
  Billing: 1 << 0,
  Shipping: 1 << 1,
  DefaultBilling: 1 << 2,
  DefaultShipping: 1 << 3,
  /** A newer version replaced it; records that point at it keep it, nothing new points at it. */
  Superseded: 1 << 4,
  /** The person removed it while a record still points at it; it is gone from their account and every proposal. */
  Removed: 1 << 5,
} as const;

/**
 * One entry of a Site's address book.
 *
 * An address never changes: a change is a new entry with a new id, which becomes the current one, and
 * the old one is `Superseded`. An order or an invoice therefore points at the address it was made out
 * to, for as long as it is kept. A person removes an address at will: with nothing pointing at it, it is
 * deleted; otherwise it is `Removed` and stays for those records until their retention ends.
 *
 * The book is the Site's: a person who gives one Site another address than another sees each Site only
 * its own. A guest's address (an order without an account) is an entry without a subject.
 */
export type PhisSiteAddress = {
  id: number;
  /** The person it belongs to, or null for a guest's. */
  subject: PhisEntitlementSubject | null;
  flags: number;
  companyName: string | null;
  name: string;
  line1: string;
  line2: string | null;
  postalCode: string | null;
  city: string;
  region: string | null;
  /** ISO 3166-1 alpha-2. */
  country: string;
  /** The version it replaced, or null for a first one. */
  replacesId: number | null;
  createdAt: string;
};

/** The parts of an address a caller writes; Core keeps the rest. */
export type PhisSiteAddressInput = Pick<
  PhisSiteAddress,
  "companyName" | "name" | "line1" | "line2" | "postalCode" | "city" | "region" | "country"
>;

export type PhisUsersCapabilityV1 = {
  /**
   * Up to `PHIS_USERS_DESCRIBE_MAX` people, by subject, in the order asked; a subject that is no member
   * of this Site is answered as the subject alone. Only the fields asked for and readable are filled.
   */
  describe(input: {
    subjects: readonly PhisEntitlementSubject[];
    fields: readonly PhisUserField[];
  }): Promise<readonly PhisUserDescription[]>;
  /**
   * Addresses of this Site's book by id, whatever their flags: what an order or an invoice shows. Needs
   * `address` on one of the roads above; an id of another Site is answered as absent.
   */
  addresses(input: { ids: readonly number[] }): Promise<readonly PhisSiteAddress[]>;
  /**
   * Writes an address into this Site's book for a person (their own, or by accounting on their behalf)
   * or for a guest (`subject: null`, from a checkout without an account). An entry equal to the person's
   * current one of that kind is answered instead of a second; `replaces` names the address this one
   * follows, which becomes `Superseded`. The flags given are the address's; a default moves from the
   * address that held it.
   */
  createAddress(input: {
    subject: PhisEntitlementSubject | null;
    address: PhisSiteAddressInput;
    flags: number;
    replaces?: number | null;
  }): Promise<PhisSiteAddress>;
};

/**
 * What a manifest asks of `users:v1`: the fields the Add-on reads at all, and those it reads without an
 * acting person. `background` is a subset of `fields`; it takes effect only once the Site's admin granted
 * it for the Site, and an Add-on without it reads nothing in a job or an event handler.
 */
export type PhisAddonUsersAccess = {
  fields: PhisUserField[];
  background?: PhisUserField[];
};

/**
 * A person became a member of this Site. Facts only: the handler reads what it may through `users:v1`.
 * Delivered to Add-ons requiring `users:v1` that listen to it.
 */
export type PhisUserRegisteredEventFacts = {
  event: "user.registered";
  subject: { kind: "user"; subject: PhisEntitlementSubject };
};

/**
 * Something of a person changed: which groups of fields, never their values. An address change names
 * `address` once the person's current address on this Site moved to a new version or was removed.
 */
export type PhisUserChangedEventFacts = {
  event: "user.changed";
  subject: { kind: "user"; subject: PhisEntitlementSubject; fields: readonly PhisUserField[] };
};
