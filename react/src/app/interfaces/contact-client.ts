import type { ContactRequest } from '../requests/contact-request';

/** Sends the contact form to the contact Lambda. */
export interface ContactClient {
  /**
   * Posts the message. Rejects with an HttpStatusError carrying the status code when the Lambda
   * refuses it, or a DOMException named TimeoutError when the request takes too long.
   * @param request The message.
   */
  send(request: ContactRequest): Promise<void>;
}
