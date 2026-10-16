/** JSON body posted to the contact Lambda. Field names match what the function reads. */
export interface ContactRequest {
  /** Sender's name. */
  readonly name: string;

  /** Sender's email address. */
  readonly email: string;

  /** One of the topics offered in the form. */
  readonly topic: string;

  /** "Email" or "Phone call". */
  readonly reply: string;

  /** Phone number when a call was requested, otherwise empty. */
  readonly phone: string;

  /** The message body. */
  readonly message: string;

  /** Honeypot. People never see the field, so a value marks a bot. */
  readonly website: string;

  /** Milliseconds the form was open before submit; the Lambda drops instant submissions. */
  readonly elapsed: number;
}
