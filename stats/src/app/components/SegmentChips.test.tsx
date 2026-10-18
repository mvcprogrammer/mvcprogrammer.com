import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentChips, segmentValueLabel } from './SegmentChips';

describe('SegmentChips', () => {
  it('should render nothing without segments', () => {
    // Arrange, Act
    const { container } = render(<SegmentChips segments={[]} onRemove={vi.fn()} onClear={vi.fn()} />);

    // Assert
    expect(container.innerHTML).toBe('');
  });

  it('should show a chip per segment with a remove button and a clear-all for two or more', async () => {
    // Arrange
    const onRemove = vi.fn();
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(
      <SegmentChips
        segments={[
          { dimension: 'edition', value: 'react' },
          { dimension: 'country', value: 'DE' },
        ]}
        onRemove={onRemove}
        onClear={onClear}
      />,
    );

    // Act
    await user.click(screen.getByRole('button', { name: 'Remove filter Edition: React' }));
    await user.click(screen.getByRole('button', { name: 'Clear all' }));

    // Assert
    expect(onRemove).toHaveBeenCalledWith('edition');
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Remove filter Country: Germany' })).toBeTruthy();
  });

  it('should hide clear-all with a single chip', () => {
    // Arrange, Act
    render(<SegmentChips segments={[{ dimension: 'screen', value: 'phone' }]} onRemove={vi.fn()} onClear={vi.fn()} />);

    // Assert
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
    expect(screen.getByText('Phone')).toBeTruthy();
  });

  it('should label values the way a reader says them', () => {
    expect(segmentValueLabel({ dimension: 'edition', value: 'js' })).toBe('JS');
    expect(segmentValueLabel({ dimension: 'country', value: 'NL' })).toBe('Netherlands');
    expect(segmentValueLabel({ dimension: 'scheme', value: 'dark' })).toBe('Dark');
    expect(segmentValueLabel({ dimension: 'referrer', value: '(direct)' })).toBe('(direct)');
  });
});
