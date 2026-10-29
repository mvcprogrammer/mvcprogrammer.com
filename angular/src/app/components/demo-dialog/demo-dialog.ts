import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/**
 * A live demo in a native dialog: the kiosk and the patient explorer both open through one of these.
 * Opens the dialog modally and tears the iframe down on close, so the framed site and whatever runs
 * behind it load only for visitors who ask.
 */
@Component({
  selector: 'app-demo-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './demo-dialog.html',
})
export class DemoDialog {
  /** Element id of the dialog; the heading gets "{dialogId}-title" for aria-labelledby. Not "id": a static id attribute would also land on the host element. */
  readonly dialogId = input.required<string>();

  /** The heading. Not "title": a static title attribute would also land on the host element as a tooltip. */
  readonly heading = input.required<string>();

  /** The line under the heading saying what the visitor is looking at. */
  readonly note = input.required<string>();

  /** Absolute URL of the framed site. It comes from configuration, not from user input, so it is safe to frame. */
  readonly src = input.required<string>();

  /** The iframe's accessible title. */
  readonly frameTitle = input.required<string>();

  /** True for a page that scrolls (the explorer) rather than a fixed 16:9 screen (the kiosk); the stylesheet gives it a taller slot. */
  readonly tall = input(false);

  /** True while the dialog is showing and the iframe is rendered. */
  readonly open = signal(false);

  protected readonly titleId = computed(() => `${this.dialogId()}-title`);
  protected readonly frameSrc = computed<SafeResourceUrl>(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.src()));

  private readonly sanitizer = inject(DomSanitizer);
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
