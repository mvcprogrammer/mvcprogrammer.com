import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Quote band. */
@Component({
  selector: 'app-quote-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quote-section.html',
})
export class QuoteSection {}
