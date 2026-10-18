import { render } from '@testing-library/react';
import { Sparkline, sparklinePoints } from './Sparkline';

describe('Sparkline', () => {
  it('should spread the points across the width and scale to the tallest value', () => {
    // Act
    const points = sparklinePoints([0, 5, 10]);

    // Assert
    expect(points).toBe('2.0,28.0 50.0,15.0 98.0,2.0');
  });

  it('should draw a flat baseline for no values or all zeros', () => {
    expect(sparklinePoints([])).toBe('0,28 100,28');
    expect(sparklinePoints([0, 0])).toBe('2.0,28.0 98.0,28.0');
    expect(sparklinePoints([4])).toBe('50.0,2.0');
  });

  it('should render an SVG with a label and no style attribute', () => {
    // Arrange, Act
    const { container } = render(<Sparkline values={[1, 3, 2]} label="Visits, last seven points" />);

    // Assert
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-label')).toBe('Visits, last seven points');
    expect(svg?.querySelector('polyline')?.getAttribute('points')).toBe(sparklinePoints([1, 3, 2]));
    expect(container.querySelector('[style]')).toBeNull();
  });
});
