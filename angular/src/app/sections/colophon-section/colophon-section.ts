import { ChangeDetectionStrategy, Component } from '@angular/core';

/** How this edition is built. The static site's colophon, rewritten for the Angular build. */
@Component({
  selector: 'app-colophon-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './colophon-section.html',
})
export class ColophonSection {}
