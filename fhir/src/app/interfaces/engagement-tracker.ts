/**
 * Records how far a visitor gets on the page. An abstract class rather than an interface so it can
 * serve as the injection token.
 */
export abstract class EngagementTracker {
  /** Starts watching the page's sections and the tab's visibility. Calling it twice restarts. */
  abstract start(): void;

  /** Stops watching and releases the observers and listeners. */
  abstract stop(): void;
}
