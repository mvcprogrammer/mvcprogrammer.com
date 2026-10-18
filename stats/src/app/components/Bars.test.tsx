import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Bars } from './Bars';

const ROWS = [
  { key: 'js', label: 'JS', count: 30, share: 0.6 },
  { key: 'react', label: 'React', count: 15, share: 0.3 },
  { key: '(others)', label: 'Others (3)', count: 5, share: 0.1, dim: true },
];

describe('Bars', () => {
  it('should size each bar against the largest row using attributes only', () => {
    // Arrange, Act
    const { container } = render(<Bars rows={ROWS} />);

    // Assert
    const widths = Array.from(container.querySelectorAll('.bar-track rect:not(.bar-rail)')).map((rect) => rect.getAttribute('width'));
    expect(widths).toEqual(['100.00', '50.00', '16.67']);
    expect(container.querySelector('[style]')).toBeNull();
    expect(screen.getByText('30')).toBeTruthy();
    expect(container.textContent).toContain('60%');
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('should make rows buttons when selectable, except the unselectable ones, and report the selection', async () => {
    // Arrange
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Bars rows={ROWS} onSelect={onSelect} selectedKey="react" unselectable={new Set(['(others)'])} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Filter by JS' }));

    // Assert
    expect(onSelect).toHaveBeenCalledWith('js');
    expect(screen.getByRole('button', { name: 'Filter by React' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: /Others/ })).toBeNull();
    expect(screen.getByText('Others (3)').closest('li')?.className).toContain('is-dim');
  });

  it('should show a glyph and a detail line when given', () => {
    // Arrange, Act
    render(<Bars rows={[{ key: 'US', label: 'United States', count: 3, share: null, glyph: '🇺🇸', detail: 'header 2 · hero 1' }]} />);

    // Assert
    expect(screen.getByText('🇺🇸')).toBeTruthy();
    expect(screen.getByText('header 2 · hero 1')).toBeTruthy();
    expect(screen.getByText('3').parentElement?.textContent).toBe('3'); // no share when the whole is zero
  });
});
