import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Icon } from '../../components/icon/icon';
import { KioskDialog } from '../../components/kiosk-dialog/kiosk-dialog';

/** Selected work. The kiosk card opens the live demo dialog. */
@Component({
  selector: 'app-portfolio-section',
  imports: [Icon, KioskDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portfolio-section.html',
})
export class PortfolioSection {}
