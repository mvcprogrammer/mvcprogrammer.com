import type { ContactTopicState } from '../interfaces/contact-topic-state';

/** In-memory topic hand-off between the call-to-action buttons and the contact form. One instance per app. */
export class ListenerContactTopicState implements ContactTopicState {
  private readonly listeners = new Set<(topic: string) => void>();

  /** @inheritdoc */
  subscribe(listener: (topic: string) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** @inheritdoc */
  select(topic: string): void {
    for (const listener of Array.from(this.listeners)) {
      listener(topic);
    }
  }
}
