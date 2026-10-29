import { ChangeDetectionStrategy, Component } from '@angular/core';

/** The inline SVG sprite every icon on the page references. Rendered once in the layout. */
@Component({
  selector: 'app-icon-sprite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon-sprite.html',
})
export class IconSprite {}
