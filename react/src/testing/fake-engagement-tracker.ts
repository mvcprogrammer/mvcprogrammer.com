import type { EngagementTracker } from '../app/interfaces/engagement-tracker';

/** Records start and stop calls instead of sending pings. */
export class FakeEngagementTracker implements EngagementTracker {
  starts = 0;
  stops = 0;

  /** @inheritdoc */
  start(): void {
    this.starts++;
  }

  /** @inheritdoc */
  stop(): void {
    this.stops++;
  }
}
