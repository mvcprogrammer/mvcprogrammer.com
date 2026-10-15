import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SITE_OPTIONS } from '../../configurations/site-options';

/** Kiosk demo dialog: opens the native dialog and tears the iframe down on close. */
@Component({
  selector: 'app-kiosk-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kiosk-dialog.html',
})
export class KioskDialog {
  protected readonly options = inject(SITE_OPTIONS);

  /** The kiosk URL comes from configuration, not from user input, so it is safe to frame. */
  protected readonly kioskUrl: SafeResourceUrl = inject(DomSanitizer).bypassSecurityTrustResourceUrl(this.options.kioskUrl);

  /** True while the dialog is showing and the iframe is rendered. */
  readonly open = signal(false);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** Renders the iframe and shows the dialog modally. A second call while open does nothing. */
  show(): void {
    if (this.open()) {
      return;
    }

    this.open.set(true);
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) {
      dialog.showModal();
    }
  }

  /** Closes the dialog; the close event then removes the iframe. */
  hide(): void {
    const dialog = this.dialog().nativeElement;
    if (dialog.open) {
      dialog.close();
    }
  }

  /** A click on the backdrop lands on the dialog element itself, not its children. */
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.hide();
    }
  }

  /** The dialog closed, whichever way (button, backdrop, Escape). */
  protected onClosed(): void {
    this.open.set(false);
  }
}
