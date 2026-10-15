import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Shown for any path other than the home page. CloudFront hands every unknown path to index.html. */
@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" aria-labelledby="not-found-title">
      <div class="container">
        <p class="eyebrow">404</p>
        <h1 id="not-found-title">Page not found</h1>
        <p class="section-intro">There is nothing at this address. Everything on the site is on the <a href="/">home page</a>.</p>
      </div>
    </section>
  `,
})
export class NotFound {}
