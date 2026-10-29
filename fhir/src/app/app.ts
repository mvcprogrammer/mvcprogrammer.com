import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IconSprite } from './components/icon-sprite/icon-sprite';
import { SiteFooter } from './components/site-footer/site-footer';
import { SiteHeader } from './components/site-header/site-header';

/** The layout: skip link, icon sprite, header, the routed page inside main, footer. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, IconSprite, SiteHeader, SiteFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#main">Skip to content</a>

    <app-icon-sprite />

    <app-site-header />

    <main id="main" tabindex="-1">
      <router-outlet />
    </main>

    <app-site-footer />
  `,
})
export class App {}
