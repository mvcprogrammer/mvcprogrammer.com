import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../../components/icon/icon';
import { ContactTopicState } from '../../interfaces/contact-topic-state';

/** Freelance. The call to action preselects the contact topic. */
@Component({
  selector: 'app-freelance-section',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './freelance-section.html',
})
export class FreelanceSection {
  protected readonly topics = inject(ContactTopicState);
}
