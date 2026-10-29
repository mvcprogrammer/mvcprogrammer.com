import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SocialLinks } from '../social-links/social-links';

/** Footer. The legal pages stay on the static site, so the links leave this origin. */
@Component({
  selector: 'app-site-footer',
  imports: [SocialLinks],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="site-footer">
      <div class="container footer-inner">
        <p class="footer-copy">&copy; {{ year }} mvcprogrammer.com</p>
        <ul class="footer-links" role="list" aria-label="Legal">
          <li><a href="https://mvcprogrammer.com/privacy.html">Privacy</a></li>
          <li><a href="https://mvcprogrammer.com/terms.html">SMS terms</a></li>
        </ul>
        <app-social-links />
      </div>
    </footer>
  `,
})
export class SiteFooter {
  /** The year in the copyright line. */
  protected readonly year = new Date().getFullYear();
}
