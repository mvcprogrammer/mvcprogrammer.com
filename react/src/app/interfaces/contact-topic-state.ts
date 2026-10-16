/**
 * Lets a call-to-action elsewhere on the page ("Talk about a role", "Start a conversation")
 * preselect the contact form's topic before the page scrolls to it.
 */
export interface ContactTopicState {
  /**
   * Registers a listener for each topic as it is selected. The contact form subscribes for the life of the page.
   * @param listener Receives the selected topic.
   * @returns A function that removes the listener.
   */
  subscribe(listener: (topic: string) => void): () => void;

  /**
   * Preselects a topic.
   * @param topic One of the topics the form offers.
   */
  select(topic: string): void;
}
