import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SITE_OPTIONS } from '../../configurations/site-options';
import { KioskDialog } from './kiosk-dialog';
import { TEST_SITE_OPTIONS } from '../../../testing/site-testing';

describe('KioskDialog', () => {
  let fixture: ComponentFixture<KioskDialog>;
  let dialog: HTMLDialogElement;
  let showModal: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KioskDialog],
      providers: [{ provide: SITE_OPTIONS, useValue: TEST_SITE_OPTIONS }],
    }).compileComponents();
    fixture = TestBed.createComponent(KioskDialog);
    await fixture.whenStable();
    dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog') as HTMLDialogElement;

    // jsdom has no modal dialogs, so the two native methods are stand-ins that keep the open state honest.
    showModal = vi.fn(() => dialog.setAttribute('open', ''));
    close = vi.fn(() => {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    });
    Object.defineProperty(dialog, 'showModal', { value: showModal, configurable: true });
    Object.defineProperty(dialog, 'close', { value: close, configurable: true });
    Object.defineProperty(dialog, 'open', { get: () => dialog.hasAttribute('open'), configurable: true });
  });

  describe('render', () => {
    it('should render the heading and the full-size link but no iframe while closed', () => {
      // Assert
      expect(dialog.querySelector('#kiosk-dialog-title')?.textContent).toBe('Interactive Property Search Window Display');
      expect(dialog.querySelector<HTMLAnchorElement>('.kiosk-dialog-foot a')?.getAttribute('href')).toBe(TEST_SITE_OPTIONS.kioskUrl);
      expect(dialog.querySelector('iframe')).toBeNull();
      expect(fixture.componentInstance.open()).toBe(false);
    });
  });

  describe('show', () => {
    it('should render the iframe for the configured kiosk and open the dialog modally', async () => {
      // Act
      fixture.componentInstance.show();
      await fixture.whenStable();

      // Assert
      expect(showModal).toHaveBeenCalledTimes(1);
      const frame = dialog.querySelector<HTMLIFrameElement>('iframe.kiosk-frame');
      expect(frame?.getAttribute('src')).toBe(TEST_SITE_OPTIONS.kioskUrl);
      expect(frame?.getAttribute('title')).toBe('Interactive Property Search Window Display, live');
    });

    it('should be idempotent', async () => {
      // Arrange
      fixture.componentInstance.show();
      await fixture.whenStable();

      // Act
      fixture.componentInstance.show();
      await fixture.whenStable();

      // Assert
      expect(showModal).toHaveBeenCalledTimes(1);
      expect(dialog.querySelectorAll('iframe').length).toBe(1);
    });
  });

  describe('hide', () => {
    it('should close the dialog and remove the iframe', async () => {
      // Arrange
      fixture.componentInstance.show();
      await fixture.whenStable();

      // Act
      dialog.querySelector<HTMLButtonElement>('.kiosk-dialog-close')?.click();
      await fixture.whenStable();

      // Assert
      expect(close).toHaveBeenCalledTimes(1);
      expect(dialog.querySelector('iframe')).toBeNull();
      expect(fixture.componentInstance.open()).toBe(false);
    });

    it('should do nothing before the dialog was opened', async () => {
      // Act
      dialog.querySelector<HTMLButtonElement>('.kiosk-dialog-close')?.click();
      await fixture.whenStable();

      // Assert
      expect(close).not.toHaveBeenCalled();
    });

    it('should close on a backdrop click but not on a click inside', async () => {
      // Arrange
      fixture.componentInstance.show();
      await fixture.whenStable();

      // Act
      dialog.querySelector<HTMLElement>('.kiosk-dialog-head')?.click();
      await fixture.whenStable();

      // Assert
      expect(close).not.toHaveBeenCalled();

      // Act again
      dialog.click();
      await fixture.whenStable();

      // Assert again
      expect(close).toHaveBeenCalledTimes(1);
      expect(dialog.querySelector('iframe')).toBeNull();
    });

    it('should remove the iframe when the dialog closes on its own, as Escape does', async () => {
      // Arrange
      fixture.componentInstance.show();
      await fixture.whenStable();

      // Act
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
      await fixture.whenStable();

      // Assert
      expect(dialog.querySelector('iframe')).toBeNull();
      expect(fixture.componentInstance.open()).toBe(false);
    });
  });
});
