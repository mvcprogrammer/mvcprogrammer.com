import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, PendingTasks, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { Icon } from '../../components/icon/icon';
import { ContactClient } from '../../interfaces/contact-client';
import { ContactTopicState } from '../../interfaces/contact-topic-state';
import { ContactRequest } from '../../requests/contact-request';
import { PHONE_MIN_LENGTH, REPLY_BY_PHONE, phoneRequiredForCall } from '../../validators/phone-required-for-call';

/** Contact form: topic preselection, the conditional phone field, submission, and status messages. */
@Component({
  selector: 'app-contact-section',
  imports: [ReactiveFormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact-section.html',
})
export class ContactSection {
  /** Shown when submit finds an invalid field. */
  static readonly INVALID_MESSAGE = 'Please check the highlighted fields.';

  /** Shown when the Lambda answers 429. */
  static readonly RATE_LIMIT_MESSAGE = 'That is a few messages in a row. Please try again in an hour.';

  /** Shown when the request times out. */
  static readonly TIMEOUT_MESSAGE = 'That took too long to send. Please try again in a moment, or reach me on LinkedIn.';

  /** Shown for any other failure. */
  static readonly FAILURE_MESSAGE = 'Something went wrong sending that. Please try again in a moment, or reach me on LinkedIn.';

  /** Shown after a successful send when the sender asked for an email. */
  static readonly SENT_BY_EMAIL_MESSAGE = 'Thanks, your message is on its way. I will reply by email.';

  /** Shown after a successful send when the sender asked for a call. */
  static readonly SENT_BY_PHONE_MESSAGE = 'Thanks, your message is on its way. I will call you at the number you gave.';

  protected readonly replyByPhone = REPLY_BY_PHONE;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(200)]],
    topic: ['Job opportunity', [Validators.required]],
    reply: ['Email', [Validators.required]],
    phone: [{ value: '', disabled: true }, [Validators.minLength(PHONE_MIN_LENGTH), Validators.maxLength(30), phoneRequiredForCall]],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]],
    website: [''],
  });

  /** True when the sender asked for a phone call. */
  protected readonly wantsCall = toSignal(this.form.controls.reply.valueChanges.pipe(map((reply) => reply === REPLY_BY_PHONE)), {
    initialValue: false,
  });

  protected readonly status = signal('');
  protected readonly statusKind = signal<'is-ok' | 'is-error' | null>(null);
  protected readonly statusClass = computed(() => (this.statusKind() === null ? 'form-status' : `form-status ${this.statusKind()}`));
  protected readonly sending = signal(false);
  protected readonly sent = signal(false);

  private readonly client = inject(ContactClient);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly opened = Date.now();

  constructor() {
    inject(ContactTopicState)
      .topics.pipe(takeUntilDestroyed())
      .subscribe((topic) => this.form.controls.topic.setValue(topic));

    // A disabled control is left out of the value and the validation, which is what a hidden field needs.
    this.form.controls.reply.valueChanges.pipe(takeUntilDestroyed()).subscribe((reply) => {
      if (reply === REPLY_BY_PHONE) {
        this.form.controls.phone.enable();
      } else {
        this.form.controls.phone.disable();
      }
    });
  }

  /** Validates, then posts the message. An invalid form never reaches the client. */
  protected send(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.setStatus(ContactSection.INVALID_MESSAGE, 'is-error');
      return;
    }

    void this.pendingTasks.run(() => this.submit());
  }

  /** Builds the JSON payload for the contact Lambda. */
  private toRequest(): ContactRequest {
    const value = this.form.getRawValue();
    return {
      name: value.name,
      email: value.email,
      topic: value.topic,
      reply: value.reply,
      phone: this.wantsCall() ? value.phone : '',
      message: value.message,
      website: value.website,
      elapsed: Date.now() - this.opened,
    };
  }

  private async submit(): Promise<void> {
    const byPhone = this.wantsCall();
    this.sending.set(true);
    this.setStatus('Sending…', null);

    try {
      await this.client.send(this.toRequest());
      this.form.reset();
      this.sent.set(true);
      this.setStatus(byPhone ? ContactSection.SENT_BY_PHONE_MESSAGE : ContactSection.SENT_BY_EMAIL_MESSAGE, 'is-ok');
    } catch (error: unknown) {
      this.setStatus(ContactSection.messageFor(error), 'is-error');
    } finally {
      this.sending.set(false);
    }
  }

  private setStatus(text: string, kind: 'is-ok' | 'is-error' | null): void {
    this.status.set(text);
    this.statusKind.set(kind);
  }

  private static messageFor(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 429) {
        return ContactSection.RATE_LIMIT_MESSAGE;
      }

      // The fetch backend aborts a slow request with a DOMException named TimeoutError.
      const cause = error.error as { name?: unknown } | null;
      if (cause !== null && typeof cause === 'object' && cause.name === 'TimeoutError') {
        return ContactSection.TIMEOUT_MESSAGE;
      }
    }

    return ContactSection.FAILURE_MESSAGE;
  }
}
