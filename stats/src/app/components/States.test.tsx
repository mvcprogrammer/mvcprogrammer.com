import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyRange, ErrorState, LoadingSkeleton } from './States';

describe('States', () => {
  it('should show the error and retry', async () => {
    // Arrange
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorState message="/data/index.json answered 500" onRetry={onRetry} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(screen.getByRole('alert').textContent).toContain('answered 500');
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should offer the earliest and latest days for an empty range', async () => {
    // Arrange
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<EmptyRange earliest="2026-10-07" latest="2026-10-18" onPick={onPick} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Go to the earliest day' }));

    // Assert
    expect(onPick).toHaveBeenCalledWith('2026-10-07');
    expect(screen.getByText(/Oct 7, 2026 to Oct 18, 2026/)).toBeTruthy();
  });

  it('should say when nothing was ever exported', () => {
    render(<EmptyRange onPick={vi.fn()} />);
    expect(screen.getByText('No day files have been exported yet.')).toBeTruthy();
  });

  it('should render a busy skeleton in the final layout', () => {
    const { container } = render(<LoadingSkeleton />);
    expect(container.querySelector('[role="status"][aria-busy="true"]')).not.toBeNull();
    expect(container.querySelectorAll('.tile')).toHaveLength(6);
    expect(container.querySelectorAll('.panel')).toHaveLength(7);
  });
});
