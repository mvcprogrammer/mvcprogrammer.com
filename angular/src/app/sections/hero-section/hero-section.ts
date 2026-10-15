import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Hero. */
@Component({
  selector: 'app-hero-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hero-section.html',
})
export class HeroSection {}
