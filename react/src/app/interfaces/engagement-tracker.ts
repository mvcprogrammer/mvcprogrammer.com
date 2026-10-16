/** Records how far a visitor gets on the page. */
export interface EngagementTracker {
  /** Starts watching the page's sections and the tab's visibility. Calling it twice restarts. */
  start(): void;

  /** Stops watching and releases the observers and listeners. */
  stop(): void;
}
