import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Icon } from '../icon/icon';

/** Social profile links, used in the header and the footer. */
@Component({
  selector: 'app-social-links',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="social-list" role="list" aria-label="Social profiles">
      <li>
        <a class="social-link" href="https://github.com/mvcprogrammer" target="_blank" rel="noopener noreferrer me" aria-label="GitHub">
          <app-icon name="github" />
        </a>
      </li>
      <li>
        <a class="social-link" href="https://www.linkedin.com/in/mvcprogrammer/" target="_blank" rel="noopener noreferrer me" aria-label="LinkedIn">
          <app-icon name="linkedin" />
        </a>
      </li>
      <li>
        <a class="social-link" href="https://www.flickr.com/photos/lightsplitters/" target="_blank" rel="noopener noreferrer me" aria-label="Flickr">
          <app-icon name="flickr" />
        </a>
      </li>
    </ul>
  `,
})
export class SocialLinks {}
