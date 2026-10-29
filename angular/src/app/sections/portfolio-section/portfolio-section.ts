import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DemoDialog } from '../../components/demo-dialog/demo-dialog';
import { Icon } from '../../components/icon/icon';
import { SITE_OPTIONS } from '../../configurations/site-options';

/**
 * Selected work. The kiosk card and the FHIR API card each open a live demo in a dialog: the kiosk
 * itself, and the patient explorer at its own host. The dialogs sit after the grid and load their
 * iframe only when opened.
 */
@Component({
  selector: 'app-portfolio-section',
  imports: [Icon, DemoDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portfolio-section.html',
})
export class PortfolioSection {
  /** The demo URLs for the two dialogs. */
  protected readonly options = inject(SITE_OPTIONS);
}
