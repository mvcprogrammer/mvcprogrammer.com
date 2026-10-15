import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** One icon from the sprite in IconSprite. Decorative: labelled by the surrounding link or button. */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg class="icon" aria-hidden="true" focusable="false"><use [attr.href]="'#icon-' + name()"></use></svg>`,
})
export class Icon {
  /** Symbol id without the "icon-" prefix, e.g. "github". */
  readonly name = input.required<string>();
}
