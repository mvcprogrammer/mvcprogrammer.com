import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

/**
 * An unlisted page: the cross-reference of a job description's requirements to this repository, for an
 * interview. Not in the nav or the sitemap, and marked noindex while it is on screen. A deliberate
 * exception to the mirror rule: it lives on this edition only, as a one-off presentation.
 */
@Component({
  selector: 'app-ensemble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ensemble.html',
})
export class Ensemble {
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
