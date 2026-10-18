import { render, screen } from '@testing-library/react';
import { KpiTile } from './KpiTile';

describe('KpiTile', () => {
  it('should show the label, value, delta with an arrow, and a sparkline', () => {
    // Arrange, Act
    render(<KpiTile label="Visits" value="463" delta="+12%" direction="up" spark={[1, 2, 3]} hint="463 this period" />);

    // Assert
    expect(screen.getByText('Visits')).toBeTruthy();
    expect(screen.getByText('463')).toBeTruthy();
    const delta = screen.getByText('+12%').closest('.tile-delta');
    expect(delta?.className).toContain('is-up');
    expect(delta?.textContent).toContain('▲');
    expect(screen.getByRole('img', { name: 'Visits, last seven points' })).toBeTruthy();
    expect(screen.getByRole('article').getAttribute('title')).toBe('463 this period');
  });

  it('should color a fall red and show nothing when there is no delta', () => {
    // Arrange, Act
    const { rerender } = render(<KpiTile label="Time" value="45s" delta="-6%" direction="down" />);

    // Assert
    expect(screen.getByText('-6%').closest('.tile-delta')?.className).toContain('is-down');

    // Act
    rerender(<KpiTile label="Time" value="45s" />);

    // Assert
    expect(document.querySelector('.tile-delta')?.textContent).toBe('');
  });

  it('should render a skeleton while loading and grey out a muted tile', () => {
    // Arrange, Act
    render(<KpiTile label="Beacon reach" value="–" loading muted />);

    // Assert
    const tile = screen.getByRole('article');
    expect(tile.className).toContain('is-muted');
    expect(tile.getAttribute('aria-busy')).toBe('true');
    expect(tile.querySelector('.skeleton')).not.toBeNull();
    expect(screen.queryByText('–')).toBeNull();
  });
});
