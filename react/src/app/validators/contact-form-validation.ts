/** The reply option that reveals and requires the phone field. */
export const REPLY_BY_PHONE = 'Phone call';

/** The shortest phone number the form accepts. */
export const PHONE_MIN_LENGTH = 7;

/** The shortest message the form accepts. */
export const MESSAGE_MIN_LENGTH = 10;

/** Upper bounds matching the input attributes and the Lambda's limits. */
export const NAME_MAX_LENGTH = 120;
export const EMAIL_MAX_LENGTH = 200;
export const PHONE_MAX_LENGTH = 30;
export const MESSAGE_MAX_LENGTH = 5000;

/** The fields the visitor fills in, as the form holds them. */
export interface ContactFormValues {
  readonly name: string;
  readonly email: string;
  readonly topic: string;
  readonly reply: string;
  readonly phone: string;
  readonly message: string;
  readonly website: string;
}

/** A validated field: the ones a failed submit highlights. */
export type ContactField = 'name' | 'email' | 'topic' | 'reply' | 'phone' | 'message';

/** The first problem found per field; a field with no entry is valid. */
export type ContactFormErrors = Partial<Record<ContactField, string>>;

/** The same shape the HTML5 email check accepts: something, an at sign, something with no spaces. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

/**
 * Applies the rules of the static edition's HTML attributes (required, minlength, maxlength, email)
 * plus the one cross-field rule: a phone number is required only when a call is requested.
 * @param values The form as the visitor filled it.
 * @returns The problems per field, empty when the form may be sent.
 */
export function validateContactForm(values: ContactFormValues): ContactFormErrors {
  const errors: ContactFormErrors = {};

  const name = values.name.trim();
  if (name === '') {
    errors.name = 'Please enter your name.';
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `Please keep your name under ${NAME_MAX_LENGTH} characters.`;
  }

  const email = values.email.trim();
  if (email === '') {
    errors.email = 'Please enter your email address.';
  } else if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (values.topic.trim() === '') {
    errors.topic = 'Please pick a topic.';
  }

  if (values.reply.trim() === '') {
    errors.reply = 'Please pick how you would like to hear back.';
  }

  if (values.reply === REPLY_BY_PHONE) {
    const phone = values.phone.trim();
    if (phone.length < PHONE_MIN_LENGTH) {
      errors.phone = 'Please enter a phone number so I can call you.';
    } else if (phone.length > PHONE_MAX_LENGTH) {
      errors.phone = `Please keep the phone number under ${PHONE_MAX_LENGTH} characters.`;
    }
  }

  const message = values.message.trim();
  if (message.length < MESSAGE_MIN_LENGTH) {
    errors.message = `Please write at least ${MESSAGE_MIN_LENGTH} characters.`;
  } else if (message.length > MESSAGE_MAX_LENGTH) {
    errors.message = `Please keep the message under ${MESSAGE_MAX_LENGTH} characters.`;
  }

  return errors;
}
