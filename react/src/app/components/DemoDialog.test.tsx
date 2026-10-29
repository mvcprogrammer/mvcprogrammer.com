import { fireEvent, render, screen } from '@testing-library/react';
import { DemoDialog } from './DemoDialog';

describe('DemoDialog', () => {
  it('should render the heading, the note, and the full-size link, but no iframe while closed', () => {
    // Arrange, Act
    renderDialog(false);

    // Assert
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.querySelector('h2')?.textContent).toBe('A demo');
    expect(document.querySelector('.demo-dialog-note')?.textContent).toBe('What it shows.');
    expect(document.querySelector('.demo-dialog-foot a')?.getAttribute('href')).toBe(
      'https://demo.example.test/',
    );
  });

  it('should wire the heading to the dialog through its id', () => {
    // Arrange, Act
    renderDialog(false);

    // Assert
    const dialog = document.querySelector('dialog');
    expect(dialog?.id).toBe('a-dialog');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('a-dialog-title');
    expect(document.querySelector('h2')?.id).toBe('a-dialog-title');
  });

  it('should carry the tall frame attribute only when asked', () => {
    // Arrange, Act
    renderDialog(false);
    const plain = document.querySelector('dialog')?.getAttribute('data-frame');
    document.body.innerHTML = '';
    renderDialog(false, true);

    // Assert
    expect(plain).toBeNull();
    expect(document.querySelector('dialog')?.getAttribute('data-frame')).toBe('tall');
  });

  it('should show the dialog modally with the configured page framed when opened', () => {
    // Arrange
    const { rerender, showModal } = renderDialog(false);

    // Act
    rerender(true);

    // Assert
    expect(showModal).toHaveBeenCalledTimes(1);
    const iframe = document.querySelector('iframe');
    expect(iframe?.getAttribute('src')).toBe('https://demo.example.test/');
    expect(iframe?.getAttribute('title')).toBe('A demo, live');
  });

  it('should not call showModal again while already open', () => {
    // Arrange
    const { rerender, showModal } = renderDialog(true);

    // Act
    rerender(true);

    // Assert
    expect(showModal).toHaveBeenCalledTimes(1);
  });

  it('should close the native dialog from the close button and report the close', () => {
    // Arrange
    const { onClose, close } = renderDialog(true);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Close the demo' }));

    // Assert
    expect(close).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should report the close straight away when the close button is pressed on a dialog that is not open', () => {
    // Arrange
    const { onClose, close } = renderDialog(false);

    // Act: a closed native dialog is hidden from the accessibility tree, so the query looks past that
    fireEvent.click(screen.getByRole('button', { name: 'Close the demo', hidden: true }));

    // Assert
    expect(close).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should close on a backdrop click but not on a click inside', () => {
    // Arrange
    const { close } = renderDialog(true);
    const dialog = document.querySelector('dialog')!;

    // Act, Assert: inside
    fireEvent.click(dialog.querySelector('h2')!);
    expect(close).not.toHaveBeenCalled();

    // Act, Assert: the backdrop is the dialog element itself
    fireEvent.click(dialog);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('should close the native dialog when the parent sets open back to false', () => {
    // Arrange
    const { rerender, close } = renderDialog(true);

    // Act
    rerender(false);

    // Assert
    expect(close).toHaveBeenCalledTimes(1);
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('should report an Escape close through the dialog close event', () => {
    // Arrange
    const { onClose } = renderDialog(true);

    // Act
    fireEvent(document.querySelector('dialog')!, new Event('close'));

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * Renders the dialog with the given open state. jsdom has no modal dialogs, so showModal and close
   * are stubbed on the element to track the open attribute and raise the close event the way a browser does.
   */
  function renderDialog(open: boolean, tall = false) {
    const onClose = vi.fn();
    const showModal = vi.fn();
    const close = vi.fn();
    const element = (isOpen: boolean) => (
      <DemoDialog
        id="a-dialog"
        title="A demo"
        note="What it shows."
        src="https://demo.example.test/"
        frameTitle="A demo, live"
        tall={tall}
        open={isOpen}
        onClose={onClose}
      />
    );
    const utils = render(element(false));
    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    Object.defineProperty(dialog, 'showModal', {
      configurable: true,
      value: showModal.mockImplementation(() => dialog.setAttribute('open', '')),
    });
    Object.defineProperty(dialog, 'close', {
      configurable: true,
      value: close.mockImplementation(() => {
        dialog.removeAttribute('open');
        dialog.dispatchEvent(new Event('close'));
      }),
    });
    if (open) {
      utils.rerender(element(true));
    }

    return {
      onClose,
      showModal,
      close,
      rerender: (isOpen: boolean) => utils.rerender(element(isOpen)),
    };
  }
});
