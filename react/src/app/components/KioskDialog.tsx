import { useEffect, useRef, type MouseEvent } from 'react';
import { useSite } from '../providers/SiteProvider';

/** Props of KioskDialog. */
export interface KioskDialogProps {
  /** True while the dialog should be showing; the parent owns it. */
  readonly open: boolean;

  /** Called when the dialog closed, whichever way (button, backdrop, Escape). */
  readonly onClose: () => void;
}

/**
 * Live kiosk demo. The iframe is rendered only while the dialog is open, so the kiosk and its
 * Lambda load only for visitors who ask. The parent opens it by setting open; the native dialog
 * is shown modally in an effect and torn down on close.
 */
export function KioskDialog({ open, onClose }: KioskDialogProps) {
  const { options } = useSite();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }

    if (open && !element.open) {
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  /** A click on the backdrop lands on the dialog element itself, not its children. */
  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>): void => {
    if (event.target === dialog.current) {
      hide();
    }
  };

  /** Closes the dialog; the close event then reports back to the parent. */
  const hide = (): void => {
    const element = dialog.current;
    if (element !== null && element.open) {
      element.close();
    } else {
      onClose();
    }
  };

  return (
    <dialog
      className="kiosk-dialog"
      id="kiosk-dialog"
      aria-labelledby="kiosk-dialog-title"
      ref={dialog}
      onClick={onBackdropClick}
      onClose={onClose}
    >
      <div className="kiosk-dialog-head">
        <div>
          <p className="eyebrow">Live demo</p>
          <h2 id="kiosk-dialog-title">Interactive Property Search Window Display</h2>
          <p className="kiosk-dialog-note">
            The real kiosk at display.lightsplitters.com, scaled to fit this window. Touch or click
            around; it returns to its lock screen after three minutes idle, like the one behind the
            glass.
          </p>
        </div>
        <button
          type="button"
          className="kiosk-dialog-close"
          aria-label="Close the demo"
          onClick={hide}
        >
          &times;
        </button>
      </div>
      <div className="kiosk-frame-slot">
        {open && (
          <iframe
            className="kiosk-frame"
            src={options.kioskUrl}
            title="Interactive Property Search Window Display, live"
            loading="eager"
          ></iframe>
        )}
      </div>
      <p className="kiosk-dialog-foot">
        <a href={options.kioskUrl} target="_blank" rel="noopener">
          Open full size in a new tab
        </a>
      </p>
    </dialog>
  );
}
