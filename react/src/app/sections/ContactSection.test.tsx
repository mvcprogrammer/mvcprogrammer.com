import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpStatusError } from '../exceptions/http-status-error';
import type { ContactTopicState } from '../interfaces/contact-topic-state';
import { REPLY_BY_PHONE } from '../validators/contact-form-validation';
import {
  createSiteTestServices,
  renderWithSite,
  type SiteTestServices,
} from '../../testing/site-testing';
import {
  ContactSection,
  FAILURE_MESSAGE,
  INVALID_MESSAGE,
  messageFor,
  RATE_LIMIT_MESSAGE,
  SENT_BY_EMAIL_MESSAGE,
  SENT_BY_PHONE_MESSAGE,
  TIMEOUT_MESSAGE,
} from './ContactSection';

describe('ContactSection', () => {
  describe('rendering', () => {
    it('should hide the phone field and not require it by default', () => {
      // Arrange, Act
      renderWithSite(<ContactSection />);

      // Assert
      const phone = screen.getByLabelText('Phone number') as HTMLInputElement;
      expect(phone.closest('label')?.hidden).toBe(true);
      expect(phone.required).toBe(false);
      expect((screen.getByLabelText('What is this about?') as HTMLSelectElement).value).toBe(
        'Job opportunity',
      );
      expect((screen.getByLabelText('Preferred reply') as HTMLSelectElement).value).toBe('Email');
      expect(document.querySelector('.form-status')?.textContent).toBe('');
    });

    it('should reveal and require the phone field when a call is requested, and hide it again for email', () => {
      // Arrange
      renderWithSite(<ContactSection />);
      const reply = screen.getByLabelText('Preferred reply') as HTMLSelectElement;
      const phone = screen.getByLabelText('Phone number') as HTMLInputElement;

      // Act, Assert: call
      fireEvent.change(reply, { target: { value: REPLY_BY_PHONE } });
      expect(phone.closest('label')?.hidden).toBe(false);
      expect(phone.required).toBe(true);

      // Act, Assert: email again
      fireEvent.change(reply, { target: { value: 'Email' } });
      expect(phone.closest('label')?.hidden).toBe(true);
      expect(phone.required).toBe(false);
    });
  });

  describe('topic preselection', () => {
    it('should select the topic a call to action chose', () => {
      // Arrange
      const services = createSiteTestServices();
      renderWithSite(<ContactSection />, services);

      // Act
      act(() => services.topics.select('Freelance'));

      // Assert
      expect((screen.getByLabelText('What is this about?') as HTMLSelectElement).value).toBe(
        'Freelance',
      );
    });

    it('should unsubscribe from the topic state on unmount', () => {
      // Arrange
      const unsubscribe = vi.fn();
      const topics: ContactTopicState = { subscribe: vi.fn(() => unsubscribe), select: vi.fn() };
      const services = { ...createSiteTestServices(), topics };
      const { unmount } = renderWithSite(<ContactSection />, services);
      expect(topics.subscribe).toHaveBeenCalledTimes(1);

      // Act
      unmount();

      // Assert
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('send', () => {
    it('should post the message and confirm an email reply, then reset the form', async () => {
      // Arrange
      const services = createSiteTestServices();
      renderWithSite(<ContactSection />, services);
      await fillValidForm();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

      // Assert
      await screen.findByText(SENT_BY_EMAIL_MESSAGE);
      expect(services.contact.sent.length).toBe(1);
      const request = services.contact.sent[0]!;
      expect(request).toMatchObject({
        name: 'Ada Lovelace',
        email: 'ada@example.test',
        topic: 'Contract or consulting',
        reply: 'Email',
        phone: '',
        message: 'I would like to talk about a role.',
        website: '',
      });
      expect(request.elapsed).toBeGreaterThanOrEqual(0);
      expect(document.querySelector('.form-status')?.className).toBe('form-status is-ok');
      expect(document.querySelector('form')?.classList.contains('is-sent')).toBe(true);
      expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText('What is this about?') as HTMLSelectElement).value).toBe(
        'Job opportunity',
      );
    });

    it('should post the phone number and confirm a call when a call is requested', async () => {
      // Arrange
      const services = createSiteTestServices();
      renderWithSite(<ContactSection />, services);
      await fillValidForm();
      fireEvent.change(screen.getByLabelText('Preferred reply'), {
        target: { value: REPLY_BY_PHONE },
      });
      await userEvent.type(screen.getByLabelText('Phone number'), '727-555-0100');

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

      // Assert
      await screen.findByText(SENT_BY_PHONE_MESSAGE);
      expect(services.contact.sent[0]).toMatchObject({
        reply: REPLY_BY_PHONE,
        phone: '727-555-0100',
      });
    });

    it('should forward the honeypot value so the Lambda can drop the message', async () => {
      // Arrange
      const services = createSiteTestServices();
      renderWithSite(<ContactSection />, services);
      await fillValidForm();
      fireEvent.change(document.querySelector('input[name="website"]')!, {
        target: { value: 'https://spam.example' },
      });

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

      // Assert
      await waitFor(() => expect(services.contact.sent.length).toBe(1));
      expect(services.contact.sent[0]!.website).toBe('https://spam.example');
    });

    it('should disable the button and show Sending while the request is in flight', async () => {
      // Arrange
      const services = createSiteTestServices();
      let resolve: () => void = () => undefined;
      services.contact.onSend = () => new Promise<void>((r) => (resolve = r));
      renderWithSite(<ContactSection />, services);
      await fillValidForm();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

      // Assert
      await screen.findByText('Sending…');
      expect(
        (screen.getByRole('button', { name: 'Send message' }) as HTMLButtonElement).disabled,
      ).toBe(true);
      resolve();
      await screen.findByText(SENT_BY_EMAIL_MESSAGE);
      expect(
        (screen.getByRole('button', { name: 'Send message' }) as HTMLButtonElement).disabled,
      ).toBe(false);
    });

    it('should explain a rate limit when the Lambda answers 429', async () => {
      // Arrange
      const services = arrangeFailure(new HttpStatusError(429, 'https://contact.example.test/'));
      renderWithSite(<ContactSection />, services);
      await fillValidForm();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

      // Assert
      await screen.findByText(RATE_LIMIT_MESSAGE);
      expect(document.querySelector('.form-status')?.className).toBe('form-status is-error');
      expect(document.querySelector('form')?.classList.contains('is-sent')).toBe(false);
    });

    it('should show the generic failure for another status', async () => {
      // Arrange
      const services = arrangeFailure(new HttpStatusError(500, 'https://contact.example.test/'));
      renderWithSite(<ContactSection />, services);
      await fillValidForm();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

      // Assert
      await screen.findByText(FAILURE_MESSAGE);
    });

    it('should show the timeout message when the request times out', async () => {
      // Arrange
      const services = arrangeFailure(new DOMException('The operation timed out.', 'TimeoutError'));
      renderWithSite(<ContactSection />, services);
      await fillValidForm();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

      // Assert
      await screen.findByText(TIMEOUT_MESSAGE);
    });

    it('should show the generic failure for a non-HTTP error', async () => {
      // Arrange
      const services = arrangeFailure(new TypeError('Failed to fetch'));
      renderWithSite(<ContactSection />, services);
      await fillValidForm();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

      // Assert
      await screen.findByText(FAILURE_MESSAGE);
    });

    it('should keep the typed values after a failure so the visitor can retry', async () => {
      // Arrange
      const services = arrangeFailure(new TypeError('Failed to fetch'));
      renderWithSite(<ContactSection />, services);
      await fillValidForm();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
      await screen.findByText(FAILURE_MESSAGE);

      // Assert
      expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Ada Lovelace');
    });
  });

  describe('validation', () => {
    it('should not post an empty form and should highlight every failed field', () => {
      // Arrange
      const services = createSiteTestServices();
      renderWithSite(<ContactSection />, services);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

      // Assert
      expect(services.contact.sent.length).toBe(0);
      expect(document.querySelector('.form-status')?.textContent).toBe(INVALID_MESSAGE);
      expect(document.querySelector('.form-status')?.className).toBe('form-status is-error');
      const invalid = Array.from(document.querySelectorAll('[aria-invalid="true"]')).map(
        (element) => element.getAttribute('name'),
      );
      expect(invalid).toEqual(['name', 'email', 'message']);
    });

    it('should not post when a call is requested without a phone number', async () => {
      // Arrange
      const services = createSiteTestServices();
      renderWithSite(<ContactSection />, services);
      await fillValidForm();
      fireEvent.change(screen.getByLabelText('Preferred reply'), {
        target: { value: REPLY_BY_PHONE },
      });

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

      // Assert
      expect(services.contact.sent.length).toBe(0);
      expect(screen.getByLabelText('Phone number').getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByLabelText('Name').getAttribute('aria-invalid')).toBe('false');
    });

    it('should not post when the message is too short', async () => {
      // Arrange
      const services = createSiteTestServices();
      renderWithSite(<ContactSection />, services);
      await fillValidForm();
      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'too short' } });

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

      // Assert
      expect(services.contact.sent.length).toBe(0);
      expect(screen.getByLabelText('Message').getAttribute('aria-invalid')).toBe('true');
    });

    it('should mark a field invalid once the visitor leaves it empty, before any submit', () => {
      // Arrange
      renderWithSite(<ContactSection />);
      const name = screen.getByLabelText('Name');
      expect(name.getAttribute('aria-invalid')).toBe('false');

      // Act
      fireEvent.blur(name);

      // Assert
      expect(name.getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('false');
    });

    it('should clear the highlight as soon as the field is fixed', async () => {
      // Arrange
      renderWithSite(<ContactSection />);
      const name = screen.getByLabelText('Name');
      fireEvent.blur(name);

      // Act
      await userEvent.type(name, 'Ada');

      // Assert
      expect(name.getAttribute('aria-invalid')).toBe('false');
    });
  });

  describe('messageFor', () => {
    it.each([
      [new HttpStatusError(429, 'x'), RATE_LIMIT_MESSAGE],
      [new HttpStatusError(400, 'x'), FAILURE_MESSAGE],
      [new DOMException('slow', 'TimeoutError'), TIMEOUT_MESSAGE],
      [new DOMException('aborted', 'AbortError'), FAILURE_MESSAGE],
      [new TypeError('offline'), FAILURE_MESSAGE],
      [null, FAILURE_MESSAGE],
      ['text', FAILURE_MESSAGE],
    ])('should pick the message for %o', (error, expected) => {
      // Arrange, Act
      const message = messageFor(error);

      // Assert
      expect(message).toBe(expected);
    });
  });

  /** Types a complete, valid message asking for an email reply. */
  async function fillValidForm(): Promise<void> {
    await userEvent.type(screen.getByLabelText('Name'), 'Ada Lovelace');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.test');
    fireEvent.change(screen.getByLabelText('What is this about?'), {
      target: { value: 'Contract or consulting' },
    });
    await userEvent.type(screen.getByLabelText('Message'), 'I would like to talk about a role.');
  }

  /** Services whose contact client rejects with the given error. */
  function arrangeFailure(error: unknown): SiteTestServices {
    const services = createSiteTestServices();
    services.contact.onSend = () => Promise.reject(error);
    return services;
  }
});
