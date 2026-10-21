import { ChangeDetectionStrategy, Component, type ElementRef, afterNextRender, signal, viewChild } from '@angular/core';
import { FhirExplorer } from '../../components/fhir-explorer/fhir-explorer';
import { Icon } from '../../components/icon/icon';
import { KioskDialog } from '../../components/kiosk-dialog/kiosk-dialog';

/**
 * Selected work. The kiosk card opens the live demo dialog; the FHIR API card's accordion holds the
 * patient explorer, deferred until the accordion first opens, and opens itself for "#fhir-api".
 */
@Component({
  selector: 'app-portfolio-section',
  imports: [Icon, KioskDialog, FhirExplorer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portfolio-section.html',
  host: { '(window:hashchange)': 'openFhirFromHash()' },
})
export class PortfolioSection {
  /** The URL fragment that opens the FHIR API card, the target of the Healthcare chip and the old /fhir redirect. */
  static readonly FHIR_HASH = '#fhir-api';

  /** True while the FHIR API card's accordion is open; the explorer is deferred until the first time. */
  protected readonly fhirOpen = signal(false);

  /** The FHIR API card, scrolled into view when its accordion opens. */
  private readonly fhirCard = viewChild.required<ElementRef<HTMLElement>>('fhirCard');

  constructor() {
    afterNextRender(() => this.openFhirFromHash());
  }

  /**
   * Keeps the signal in step with a toggle on the native element. Opening hides the card's image, so
   * the body jumps up and the explorer unfolds below the fold; scrolling the card to the top of the
   * viewport keeps the whole thing in view. The stylesheet's scroll-padding-top clears the header
   * and prefers-reduced-motion drops the glide.
   */
  protected onFhirToggle(open: boolean): void {
    this.fhirOpen.set(open);
    if (open) {
      this.fhirCard().nativeElement.scrollIntoView({ block: 'start' });
    }
  }

  /** Opens the accordion when the page is on "#fhir-api"; the browser scrolls to the card on its own, and the toggle scrolls again. */
  protected openFhirFromHash(): void {
    if (window.location.hash === PortfolioSection.FHIR_HASH) {
      this.fhirOpen.set(true);
    }
  }
}
