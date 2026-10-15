import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactTopicState } from '../../interfaces/contact-topic-state';
import { REPLY_BY_PHONE } from '../../validators/phone-required-for-call';
import { ContactSection } from './contact-section';
import { FakeContactClient } from '../../../testing/fake-contact-client';
import { choose, createSiteTestServices, type } from '../../../testing/site-testing';

describe('ContactSection', () => {
  let contact: FakeContactClient;
  let topics: ContactTopicState;
  let fixture: ComponentFixture<ContactSection>;
  let host: HTMLElement;

  beforeEach(async () => {
    const services = createSiteTestServices();
    contact = services.contact;
    topics = services.topics;
    await TestBed.configureTestingModule({ imports: [ContactSection], providers: services.providers }).compileComponents();
    fixture = TestBed.createComponent(ContactSection);
    host = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  describe('render', () => {
    it('should render the form with the honeypot, the phone field hidden, and no status', () => {
      // Assert
      expect(host.querySelector('form#contact-form')).not.toBeNull();
      expect(phoneLabel().hidden).toBe(true);
      expect(phone().disabled).toBe(true);
      expect(phone().hasAttribute('required')).toBe(false);
      expect(host.querySelector('.field-trap input')).not.toBeNull();
      expect(status().textContent).toBe('');
      expect(submit().disabled).toBe(false);
      expect(host.querySelector('form')?.getAttribute('novalidate')).not.toBeNull();
    });
  });

  describe('topic hand-off', () => {
    it('should preselect the topic selected through the shared state', async () => {
      // Act
      topics.select('Freelance');
      await fixture.whenStable();

      // Assert
      expect(topic().value).toBe('Freelance');
    });

    it('should stop listening once destroyed', () => {
      // Arrange
      fixture.destroy();

      // Act and Assert
      expect(() => topics.select('Freelance')).not.toThrow();
    });
  });

  describe('reply', () => {
    it('should reveal, enable, and require the phone field when a call is requested', async () => {
      // Act
      choose(reply(), REPLY_BY_PHONE);
      await fixture.whenStable();

      // Assert
      expect(phoneLabel().hidden).toBe(false);
      expect(phone().disabled).toBe(false);
      expect(phone().hasAttribute('required')).toBe(true);
    });

    it('should hide and disable the phone field again when email is chosen back', async () => {
      // Arrange
      choose(reply(), REPLY_BY_PHONE);
      await fixture.whenStable();

      // Act
      choose(reply(), 'Email');
      await fixture.whenStable();

      // Assert
      expect(phoneLabel().hidden).toBe(true);
      expect(phone().disabled).toBe(true);
    });
  });

  describe('send', () => {
    it('should post the request, clear the fields, and confirm by email', async () => {
      // Arrange
      fillForm();

      // Act
      await submitForm();

      // Assert
      expect(contact.sent.length).toBe(1);
      const request = contact.sent[0];
      expect(request.name).toBe('Neal Thomas');
      expect(request.email).toBe('neal@example.test');
      expect(request.topic).toBe('Job opportunity');
      expect(request.reply).toBe('Email');
      expect(request.phone).toBe('');
      expect(request.message).toBe('Hello, I have a role for you.');
      expect(request.website).toBe('');
      expect(request.elapsed).toBeGreaterThanOrEqual(0);
      expect(status().classList.contains('is-ok')).toBe(true);
      expect(status().textContent).toBe(ContactSection.SENT_BY_EMAIL_MESSAGE);
      expect(host.querySelector('form')?.classList.contains('is-sent')).toBe(true);
      expect(name().value).toBe('');
      expect(submit().disabled).toBe(false);
    });

    it('should include the phone number and confirm by call when a call is requested', async () => {
      // Arrange
      fillForm();
      choose(reply(), REPLY_BY_PHONE);
      await fixture.whenStable();
      type(phone(), '727-555-0100');

      // Act
      await submitForm();

      // Assert
      expect(contact.sent[0].reply).toBe(REPLY_BY_PHONE);
      expect(contact.sent[0].phone).toBe('727-555-0100');
      expect(status().textContent).toBe(ContactSection.SENT_BY_PHONE_MESSAGE);
      expect(phoneLabel().hidden).toBe(true);
    });

    it('should forward the honeypot value so the Lambda can drop it', async () => {
      // Arrange
      fillForm();
      type(host.querySelector<HTMLInputElement>('.field-trap input') as HTMLInputElement, 'https://spam.example.test');

      // Act
      await submitForm();

      // Assert
      expect(contact.sent[0].website).toBe('https://spam.example.test');
    });

    it('should show the rate-limit message on 429 and re-enable the button', async () => {
      // Arrange
      contact.onSend = () => Promise.reject(new HttpErrorResponse({ status: 429, statusText: 'Too Many Requests' }));
      fillForm();

      // Act
      await submitForm();

      // Assert
      expect(status().classList.contains('is-error')).toBe(true);
      expect(status().textContent).toBe(ContactSection.RATE_LIMIT_MESSAGE);
      expect(submit().disabled).toBe(false);
      expect(host.querySelector('form')?.classList.contains('is-sent')).toBe(false);
    });

    it('should show the generic message on another failure and keep the typed values', async () => {
      // Arrange
      contact.onSend = () => Promise.reject(new HttpErrorResponse({ status: 500, statusText: 'Internal Server Error' }));
      fillForm();

      // Act
      await submitForm();

      // Assert
      expect(status().textContent).toBe(ContactSection.FAILURE_MESSAGE);
      expect(name().value).toBe('Neal Thomas');
    });

    it('should show the timeout message when the request times out', async () => {
      // Arrange
      contact.onSend = () =>
        Promise.reject(new HttpErrorResponse({ error: new DOMException('signal timed out', 'TimeoutError'), status: 0, statusText: 'Unknown Error' }));
      fillForm();

      // Act
      await submitForm();

      // Assert
      expect(status().textContent).toBe(ContactSection.TIMEOUT_MESSAGE);
    });

    it('should show the generic message for an error that is not an HTTP response', async () => {
      // Arrange
      contact.onSend = () => Promise.reject(new Error('boom'));
      fillForm();

      // Act
      await submitForm();

      // Assert
      expect(status().textContent).toBe(ContactSection.FAILURE_MESSAGE);
    });

    it('should not post when the form is invalid and should ask for corrections', async () => {
      // Act
      await submitForm();

      // Assert
      expect(contact.sent.length).toBe(0);
      expect(status().textContent).toBe(ContactSection.INVALID_MESSAGE);
      expect(status().classList.contains('is-error')).toBe(true);
      expect(name().classList.contains('ng-touched')).toBe(true);
    });

    it('should not post when a call is requested without a phone number', async () => {
      // Arrange
      fillForm();
      choose(reply(), REPLY_BY_PHONE);
      await fixture.whenStable();

      // Act
      await submitForm();

      // Assert
      expect(contact.sent.length).toBe(0);
      expect(status().textContent).toBe(ContactSection.INVALID_MESSAGE);
    });

    it('should not post when the message is too short', async () => {
      // Arrange
      fillForm();
      type(host.querySelector('textarea') as HTMLTextAreaElement, 'Hi');

      // Act
      await submitForm();

      // Assert
      expect(contact.sent.length).toBe(0);
    });
  });

  function fillForm(): void {
    type(name(), 'Neal Thomas');
    type(host.querySelector<HTMLInputElement>('input[type=email]') as HTMLInputElement, 'neal@example.test');
    type(host.querySelector('textarea') as HTMLTextAreaElement, 'Hello, I have a role for you.');
  }

  async function submitForm(): Promise<void> {
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
  }

  function name(): HTMLInputElement {
    return host.querySelector<HTMLInputElement>('input[formControlName=name]') as HTMLInputElement;
  }

  function phone(): HTMLInputElement {
    return host.querySelector<HTMLInputElement>('input[type=tel]') as HTMLInputElement;
  }

  function phoneLabel(): HTMLElement {
    return phone().closest('label') as HTMLElement;
  }

  function topic(): HTMLSelectElement {
    return host.querySelector<HTMLSelectElement>('select[formControlName=topic]') as HTMLSelectElement;
  }

  function reply(): HTMLSelectElement {
    return host.querySelector<HTMLSelectElement>('select[formControlName=reply]') as HTMLSelectElement;
  }

  function status(): HTMLElement {
    return host.querySelector<HTMLElement>('.form-status') as HTMLElement;
  }

  function submit(): HTMLButtonElement {
    return host.querySelector<HTMLButtonElement>('button[type=submit]') as HTMLButtonElement;
  }
});
