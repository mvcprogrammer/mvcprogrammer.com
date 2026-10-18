import { render, screen } from '@testing-library/react';
import { Updated } from './Updated';

describe('Updated', () => {
  it('should say how long ago with the exact time in the tooltip', () => {
    // Arrange, Act
    render(<Updated generatedAt="2026-10-18T13:00:00Z" now={new Date('2026-10-18T15:10:00Z')} />);

    // Assert
    const time = screen.getByText('2 h ago');
    expect(time.tagName).toBe('TIME');
    expect(time.getAttribute('dateTime')).toBe('2026-10-18T13:00:00Z');
    expect(time.getAttribute('title')).toMatch(/2026/);
  });
});
