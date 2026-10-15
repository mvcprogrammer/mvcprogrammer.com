import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../../components/icon/icon';
import { ContactTopicState } from '../../interfaces/contact-topic-state';

/** For employers. The call to action preselects the contact topic. */
@Component({
  selector: 'app-services-section',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './services-section.html',
})
export class ServicesSection {
  protected readonly topics = inject(ContactTopicState);
}
