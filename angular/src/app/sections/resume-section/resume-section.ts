import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ExperienceTimeline } from '../../components/experience-timeline/experience-timeline';
import { Icon } from '../../components/icon/icon';
import { SITE_OPTIONS } from '../../configurations/site-options';

/** Resume: the download link, then the API-backed timeline, then education. */
@Component({
  selector: 'app-resume-section',
  imports: [Icon, ExperienceTimeline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resume-section.html',
})
export class ResumeSection {
  protected readonly options = inject(SITE_OPTIONS);
}
