import { WorkMode } from '../enumerations/work-mode';
import type { Position } from '../models/position';

/**
 * "Remote", "Hybrid", or the place for on-site roles.
 * @param position The position.
 * @returns The label that follows the dates on the timeline.
 */
export function placeLabel(position: Position): string {
  switch (position.workMode) {
    case WorkMode.Remote:
      return 'Remote';
    case WorkMode.Hybrid:
      return 'Hybrid';
    default:
      return position.location.trim() === '' ? 'On-site' : position.location;
  }
}
