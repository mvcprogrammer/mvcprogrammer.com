import { useEffect, useRef, type MouseEvent } from 'react';

/** Props of DemoDialog. */
export interface DemoDialogProps {
  /** The dialog element's id; its heading is `${id}-title`. */
  readonly id: string;

  /** The heading. */
  readonly title: string;

  /** The line under the heading that says what the visitor is looking at. */
  readonly note: string;

  /** The page to frame, an absolute URL from configuration. */
  readonly src: string;

  /** The iframe's accessible title. */
  readonly frameTitle: string;

  /** True for a page that is taller than wide; the stylesheet gives the frame more height. */
  readonly tall?: boolean;

  /** True while the dialog should be showing; the parent owns it. */
  readonly open: boolean;

  /** Called when the dialog closed, whichever way (button, backdrop, Escape). */
  readonly onClose: () => void;
}

/**
 * A live demo in a native dialog: the kiosk and the FHIR patient explorer each get one. The iframe
 * is rendered only while the dialog is open, so the framed page and whatever runs behind it load
 * only for visitors who ask. The parent opens it by setting open; the native dialog is shown
 * modally in an effect and torn down on close.
 */
export function DemoDialog({ id, title, note, src, frameTitle, tall = false, open, onClose }: DemoDialogProps) {
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
      className="demo-dialog"
      id={id}
      aria-labelledby={`${id}-title`}
      data-frame={tall ? 'tall' : undefined}
      ref={dialog}
      onClick={onBackdropClick}
      onClose={onClose}
    >
      <div className="demo-dialog-head">
        <div>
          <p className="eyebrow">Live demo</p>
          <h2 id={`${id}-title`}>{title}</h2>
          <p className="demo-dialog-note">{note}</p>
        </div>
        <button type="button" className="demo-dialog-close" aria-label="Close the demo" onClick={hide}>
          &times;
        </button>
      </div>
      <div className="demo-frame-slot">
        {open && <iframe className="demo-frame" src={src} title={frameTitle} loading="eager"></iframe>}
      </div>
      <p className="demo-dialog-foot">
        <a href={src} target="_blank" rel="noopener">
          Open full size in a new tab
        </a>
      </p>
    </dialog>
  );
}
