import { ChangeDetectionStrategy, Component, afterNextRender, signal } from '@angular/core';
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

  constructor() {
    afterNextRender(() => this.openFhirFromHash());
  }

  /** Keeps the signal in step with a toggle the visitor made on the native element. */
  protected onFhirToggle(open: boolean): void {
    this.fhirOpen.set(open);
  }

  /** Opens the accordion when the page is on "#fhir-api"; the browser scrolls to the card on its own. */
  protected openFhirFromHash(): void {
    if (window.location.hash === PortfolioSection.FHIR_HASH) {
      this.fhirOpen.set(true);
    }
  }
}
