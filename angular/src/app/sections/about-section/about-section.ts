import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Icon } from '../../components/icon/icon';

/** About. */
@Component({
  selector: 'app-about-section',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about-section.html',
})
export class AboutSection {}
