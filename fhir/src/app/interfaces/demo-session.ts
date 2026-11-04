/**
 * The visitor's demo session: the token every write carries, and the idempotency keys creates are
 * made with. An abstract class rather than an interface so it can serve as the injection token.
 */
export abstract class DemoSession {
  /** The identifier system the function stamps the session token on a created patient with. */
  static readonly SESSION_SYSTEM = 'https://mvcprogrammer.com/fhir/demo-session';

  /** The session token, a UUID, the same in this browser from one visit to the next. */
  abstract readonly token: string;

  /** A fresh idempotency key, a UUID, for one create attempt. */
  abstract newKey(): string;
}
