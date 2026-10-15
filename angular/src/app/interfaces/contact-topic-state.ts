import { Observable } from 'rxjs';

/**
 * Lets a call-to-action elsewhere on the page ("Talk about a role", "Start a conversation")
 * preselect the contact form's topic before the page scrolls to it.
 */
export abstract class ContactTopicState {
  /** Emits each topic as it is selected. The contact form subscribes for the life of the page. */
  abstract readonly topics: Observable<string>;

  /**
   * Preselects a topic.
   * @param topic One of the topics the form offers.
   */
  abstract select(topic: string): void;
}
