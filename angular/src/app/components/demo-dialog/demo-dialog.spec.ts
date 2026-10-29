import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DemoDialog } from './demo-dialog';

/** Hosts a DemoDialog with the kiosk's inputs, the shape the portfolio section uses. */
@Component({
  imports: [DemoDialog],
  template: `
    <app-demo-dialog dialogId="kiosk-dialog" heading="Interactive Property Search Window Display" note="The real kiosk, scaled to fit."
                     src="https://kiosk.example.test/" frameTitle="Interactive Property Search Window Display, live" #demo />
  `,
})
class KioskHost {}

/** Hosts a DemoDialog with the explorer's inputs: a page that scrolls, so the slot is tall. */
@Component({
  imports: [DemoDialog],
  template: `
    <app-demo-dialog dialogId="fhir-dialog" heading="FHIR R4 Patient Explorer" note="The explorer, live." src="https://fhir.example.test/"
                     frameTitle="FHIR R4 Patient Explorer, live" [tall]="true" />
  `,
})
class ExplorerHost {}

describe('DemoDialog', () => {
  let fixture: ComponentFixture<KioskHost>;
  let component: DemoDialog;
  let dialog: HTMLDialogElement;
  let showModal: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [KioskHost, ExplorerHost] }).compileComponents();
    fixture = TestBed.createComponent(KioskHost);
    await fixture.whenStable();
    dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog') as HTMLDialogElement;
    component = fixture.debugElement.children[0].componentInstance as DemoDialog;
    stubNativeDialog(dialog);
  });

  /** jsdom has no modal dialogs, so the two native methods are stand-ins that keep the open state honest. */
  function stubNativeDialog(element: HTMLDialogElement): void {
    showModal = vi.fn(() => element.setAttribute('open', ''));
    close = vi.fn(() => {
      element.removeAttribute('open');
      element.dispatchEvent(new Event('close'));
    });
    Object.defineProperty(element, 'showModal', { value: showModal, configurable: true });
    Object.defineProperty(element, 'close', { value: close, configurable: true });
    Object.defineProperty(element, 'open', { get: () => element.hasAttribute('open'), configurable: true });
  }

  describe('render', () => {
    it('should render the heading and the full-size link but no iframe while closed', () => {
      // Assert
      expect(dialog.querySelector('#kiosk-dialog-title')?.textContent).toBe('Interactive Property Search Window Display');
      expect(dialog.querySelector('.demo-dialog-note')?.textContent).toBe('The real kiosk, scaled to fit.');
      expect(dialog.querySelector<HTMLAnchorElement>('.demo-dialog-foot a')?.getAttribute('href')).toBe('https://kiosk.example.test/');
      expect(dialog.querySelector('iframe')).toBeNull();
      expect(component.open()).toBe(false);
    });

    it('should wire the id to the heading for aria-labelledby and omit the tall attribute by default', () => {
      // Assert
      expect(dialog.id).toBe('kiosk-dialog');
      expect(dialog.getAttribute('aria-labelledby')).toBe('kiosk-dialog-title');
      expect(dialog.querySelector('h2')?.id).toBe('kiosk-dialog-title');
      expect(dialog.hasAttribute('data-frame')).toBe(false);
    });

    it('should mark a tall dialog for the stylesheet', async () => {
      // Arrange
      const other = TestBed.createComponent(ExplorerHost);

      // Act
      await other.whenStable();

      // Assert
      const element = (other.nativeElement as HTMLElement).querySelector('dialog') as HTMLDialogElement;
      expect(element.id).toBe('fhir-dialog');
      expect(element.getAttribute('data-frame')).toBe('tall');
      expect(element.querySelector('#fhir-dialog-title')?.textContent).toBe('FHIR R4 Patient Explorer');
    });
  });

  describe('show', () => {
    it('should render the iframe for the configured site and open the dialog modally', async () => {
      // Act
      component.show();
      await fixture.whenStable();

      // Assert
      expect(showModal).toHaveBeenCalledTimes(1);
      const frame = dialog.querySelector<HTMLIFrameElement>('iframe.demo-frame');
      expect(frame?.getAttribute('src')).toBe('https://kiosk.example.test/');
      expect(frame?.getAttribute('title')).toBe('Interactive Property Search Window Display, live');
    });

    it('should be idempotent', async () => {
      // Arrange
      component.show();
      await fixture.whenStable();

      // Act
      component.show();
      await fixture.whenStable();

      // Assert
      expect(showModal).toHaveBeenCalledTimes(1);
      expect(dialog.querySelectorAll('iframe').length).toBe(1);
    });
  });

  describe('hide', () => {
    it('should close the dialog and remove the iframe', async () => {
      // Arrange
      component.show();
      await fixture.whenStable();

      // Act
      dialog.querySelector<HTMLButtonElement>('.demo-dialog-close')?.click();
      await fixture.whenStable();

      // Assert
      expect(close).toHaveBeenCalledTimes(1);
      expect(dialog.querySelector('iframe')).toBeNull();
      expect(component.open()).toBe(false);
    });

    it('should do nothing before the dialog was opened', async () => {
      // Act
      dialog.querySelector<HTMLButtonElement>('.demo-dialog-close')?.click();
      await fixture.whenStable();

      // Assert
      expect(close).not.toHaveBeenCalled();
    });

    it('should close on a backdrop click but not on a click inside', async () => {
      // Arrange
      component.show();
      await fixture.whenStable();

      // Act
      dialog.querySelector<HTMLElement>('.demo-dialog-head')?.click();
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
      component.show();
      await fixture.whenStable();

      // Act
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
      await fixture.whenStable();

      // Assert
      expect(dialog.querySelector('iframe')).toBeNull();
      expect(component.open()).toBe(false);
    });
  });
});
