import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

/**
 * An unlisted page: the cross-reference of a second job description's requirements to this repository, for
 * an interview. Not in the nav or the sitemap, and marked noindex while it is on screen. The same deliberate
 * exception to the mirror rule as the ensemble page: it lives on this edition only, as a one-off presentation.
 */
@Component({
  selector: 'app-nexus',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nexus.html',
})
export class Nexus {
  constructor() {
    const meta = inject(Meta);
    const title = inject(Title);
    const previous = title.getTitle();
    title.setTitle('JD cross-reference | mvcprogrammer.com');
    meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    inject(DestroyRef).onDestroy(() => {
      meta.removeTag('name="robots"');
      title.setTitle(previous);
    });
  }
}
