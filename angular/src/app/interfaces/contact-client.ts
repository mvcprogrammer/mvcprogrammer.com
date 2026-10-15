import { ContactRequest } from '../requests/contact-request';

/** Sends the contact form to the contact Lambda. Also the injection token for its implementation. */
export abstract class ContactClient {
  /**
   * Posts the message. Rejects with an HttpErrorResponse carrying the status code when the Lambda
   * refuses it, or a TimeoutError in its error when the request takes too long.
   * @param request The message.
   */
  abstract send(request: ContactRequest): Promise<void>;
}
