import { Pipe, PipeTransform } from '@angular/core';
import { WorkMode } from '../enumerations/work-mode';
import { Position } from '../models/position';

/** "Remote", "Hybrid", or the place for on-site roles. */
@Pipe({ name: 'placeLabel' })
export class PlaceLabelPipe implements PipeTransform {
  /**
   * @param position The position.
   * @returns The label that follows the dates on the timeline.
   */
  transform(position: Position): string {
    switch (position.workMode) {
      case WorkMode.Remote:
        return 'Remote';
      case WorkMode.Hybrid:
        return 'Hybrid';
      default:
        return position.location.trim() === '' ? 'On-site' : position.location;
    }
  }
}
