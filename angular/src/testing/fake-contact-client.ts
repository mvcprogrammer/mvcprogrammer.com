import { ContactClient } from '../app/interfaces/contact-client';
import { ContactRequest } from '../app/requests/contact-request';

/** Scriptable ContactClient that records every request it receives. */
export class FakeContactClient extends ContactClient {
  /** Requests passed to send(), in call order. */
  readonly sent: ContactRequest[] = [];

  /** Behaviour of send(); the default succeeds. */
  onSend: (request: ContactRequest) => Promise<void> = () => Promise.resolve();

  override send(request: ContactRequest): Promise<void> {
    this.sent.push(request);
    return this.onSend(request);
  }
}
