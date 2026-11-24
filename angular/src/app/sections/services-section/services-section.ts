import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../../components/icon/icon';
import { ContactTopicState } from '../../interfaces/contact-topic-state';

/** What I offer employers and clients. Each call to action preselects its contact topic. */
@Component({
  selector: 'app-services-section',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './services-section.html',
})
export class ServicesSection {
  protected readonly topics = inject(ContactTopicState);
}
