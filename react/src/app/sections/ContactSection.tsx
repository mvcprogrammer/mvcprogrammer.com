import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { HttpStatusError } from '../exceptions/http-status-error';
import { useSite } from '../providers/SiteProvider';
import type { ContactRequest } from '../requests/contact-request';
import {
  EMAIL_MAX_LENGTH,
  MESSAGE_MAX_LENGTH,
  MESSAGE_MIN_LENGTH,
  NAME_MAX_LENGTH,
  PHONE_MAX_LENGTH,
  PHONE_MIN_LENGTH,
  REPLY_BY_PHONE,
  validateContactForm,
  type ContactField,
  type ContactFormValues,
} from '../validators/contact-form-validation';

/** Shown when submit finds an invalid field. */
export const INVALID_MESSAGE = 'Please check the highlighted fields.';

/** Shown when the Lambda answers 429. */
export const RATE_LIMIT_MESSAGE = 'That is a few messages in a row. Please try again in an hour.';

/** Shown when the request times out. */
export const TIMEOUT_MESSAGE =
  'That took too long to send. Please try again in a moment, or reach me on LinkedIn.';

/** Shown for any other failure. */
export const FAILURE_MESSAGE =
  'Something went wrong sending that. Please try again in a moment, or reach me on LinkedIn.';

/** Shown after a successful send when the sender asked for an email. */
export const SENT_BY_EMAIL_MESSAGE = 'Thanks, your message is on its way. I will reply by email.';

/** Shown after a successful send when the sender asked for a call. */
export const SENT_BY_PHONE_MESSAGE =
  'Thanks, your message is on its way. I will call you at the number you gave.';

/** The form as it opens: the first topic and an email reply, everything else blank. */
const INITIAL_VALUES: ContactFormValues = {
  name: '',
  email: '',
  topic: 'Job opportunity',
  reply: 'Email',
  phone: '',
  message: '',
  website: '',
};

const ALL_FIELDS: readonly ContactField[] = ['name', 'email', 'topic', 'reply', 'phone', 'message'];

type StatusKind = 'is-ok' | 'is-error' | null;

/**
 * Picks the message for a failed send.
 * @param error Whatever the client rejected with.
 */
export function messageFor(error: unknown): string {
  if (error instanceof HttpStatusError && error.status === 429) {
    return RATE_LIMIT_MESSAGE;
  }

  // fetch aborts a slow request with a DOMException named TimeoutError.
  if (
    error !== null &&
    typeof error === 'object' &&
    (error as { name?: unknown }).name === 'TimeoutError'
  ) {
    return TIMEOUT_MESSAGE;
  }

  return FAILURE_MESSAGE;
}

/**
 * Contact form: topic preselection, the conditional phone field, submission, and status messages.
 * Controlled fields validated on submit (the same required and length rules as the static edition's
 * HTML attributes, plus the phone rule), then the JSON goes to the contact Lambda.
 */
export function ContactSection() {
  const { contact, topics } = useSite();
  const [values, setValues] = useState<ContactFormValues>(INITIAL_VALUES);
  const [touched, setTouched] = useState<ReadonlySet<ContactField>>(new Set());
  const [status, setStatus] = useState('');
  const [statusKind, setStatusKind] = useState<StatusKind>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const opened = useRef(Date.now());

  // A call to action elsewhere on the page preselects the topic.
  useEffect(
    () => topics.subscribe((topic) => setValues((current) => ({ ...current, topic }))),
    [topics],
  );

  const errors = validateContactForm(values);
  const wantsCall = values.reply === REPLY_BY_PHONE;

  const update = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ): void => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };

  const touch = (event: { readonly target: { readonly name: string } }): void => {
    setTouched((current) => new Set(current).add(event.target.name as ContactField));
  };

  /** True once a field the visitor has left, or a submit, found it invalid. */
  const invalid = (field: ContactField): boolean =>
    touched.has(field) && errors[field] !== undefined;

  const showStatus = (text: string, kind: StatusKind): void => {
    setStatus(text);
    setStatusKind(kind);
  };

  /** Builds the JSON payload for the contact Lambda. */
  const toRequest = (): ContactRequest => ({
    name: values.name,
    email: values.email,
    topic: values.topic,
    reply: values.reply,
    phone: wantsCall ? values.phone : '',
    message: values.message,
    website: values.website,
    elapsed: Date.now() - opened.current,
  });

  /** Validates, then posts the message. An invalid form never reaches the client. */
  const send = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (Object.keys(errors).length > 0) {
      setTouched(new Set(ALL_FIELDS));
      showStatus(INVALID_MESSAGE, 'is-error');
      return;
    }

    const byPhone = wantsCall;
    setSending(true);
    showStatus('Sending…', null);
    try {
      await contact.send(toRequest());
      setValues(INITIAL_VALUES);
      setTouched(new Set());
      setSent(true);
      showStatus(byPhone ? SENT_BY_PHONE_MESSAGE : SENT_BY_EMAIL_MESSAGE, 'is-ok');
    } catch (error: unknown) {
      showStatus(messageFor(error), 'is-error');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="section section-alt" id="contact" aria-labelledby="contact-title">
      <div className="container">
        <p className="eyebrow">05 / Contact</p>
        <h2 id="contact-title">Let's Talk</h2>
        <p className="section-intro">
          Hiring, contract work, or a question about one of the projects above. Send a note, pick
          how you would like to hear back, and I will reply, usually within a day.
        </p>
        <form
          className={sent ? 'contact-form is-sent' : 'contact-form'}
          id="contact-form"
          noValidate
          onSubmit={(event) => void send(event)}
        >
          <div className="form-row">
            <label className="field">
              <span className="field-label">Name</span>
              <input
                type="text"
                name="name"
                value={values.name}
                onChange={update}
                onBlur={touch}
                aria-invalid={invalid('name')}
                autoComplete="name"
                required
                maxLength={NAME_MAX_LENGTH}
              />
            </label>
            <label className="field">
              <span className="field-label">Email</span>
              <input
                type="email"
                name="email"
                value={values.email}
                onChange={update}
                onBlur={touch}
                aria-invalid={invalid('email')}
                autoComplete="email"
                required
                maxLength={EMAIL_MAX_LENGTH}
              />
            </label>
          </div>
          <div className="form-row">
            <label className="field">
              <span className="field-label">What is this about?</span>
              <select
                name="topic"
                value={values.topic}
                onChange={update}
                onBlur={touch}
                aria-invalid={invalid('topic')}
              >
                <option value="Job opportunity">Job opportunity</option>
                <option value="Contract or consulting">Contract or consulting</option>
                <option value="Something else">Something else</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">Preferred reply</span>
              <select
                name="reply"
                value={values.reply}
                onChange={update}
                onBlur={touch}
                aria-invalid={invalid('reply')}
              >
                <option value="Email">Email</option>
                <option value={REPLY_BY_PHONE}>{REPLY_BY_PHONE}</option>
              </select>
            </label>
          </div>
          {/* The phone field only shows, and is only required, when a call is requested. */}
          <label className="field" hidden={!wantsCall}>
            <span className="field-label">Phone number</span>
            <input
              type="tel"
              name="phone"
              value={values.phone}
              onChange={update}
              onBlur={touch}
              aria-invalid={invalid('phone')}
              autoComplete="tel"
              minLength={PHONE_MIN_LENGTH}
              maxLength={PHONE_MAX_LENGTH}
              required={wantsCall}
            />
          </label>
          <label className="field">
            <span className="field-label">Message</span>
            <textarea
              name="message"
              value={values.message}
              onChange={update}
              onBlur={touch}
              aria-invalid={invalid('message')}
              rows={6}
              required
              minLength={MESSAGE_MIN_LENGTH}
              maxLength={MESSAGE_MAX_LENGTH}
            ></textarea>
          </label>
          {/* Honeypot: hidden from people, filled by bots. The Lambda drops any submission with a value here. */}
          <label className="field field-trap" aria-hidden="true">
            <span className="field-label">Website</span>
            <input
              type="text"
              name="website"
              value={values.website}
              onChange={update}
              tabIndex={-1}
              autoComplete="off"
            />
          </label>
          <p
            className={statusKind === null ? 'form-status' : `form-status ${statusKind}`}
            role="status"
            aria-live="polite"
          >
            {status}
          </p>
          <button className="button button-primary" type="submit" disabled={sending}>
            <Icon name="mail" />
            Send message
          </button>
        </form>
      </div>
    </section>
  );
}
