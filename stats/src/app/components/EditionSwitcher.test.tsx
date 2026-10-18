import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditionSwitcher } from './EditionSwitcher';

describe('EditionSwitcher', () => {
  it('should press the current edition and report changes, with All as null', async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<EditionSwitcher value="react" onChange={onChange} />);

    // Assert
    const group = screen.getByRole('group', { name: 'Edition' });
    expect(Array.from(group.querySelectorAll('button')).map((button) => button.textContent)).toEqual(['All', 'JS', 'Angular', 'React', 'Blazor']);
    expect(screen.getByRole('button', { name: 'React' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('false');

    // Act
    await user.click(screen.getByRole('button', { name: 'Blazor' }));
    await user.click(screen.getByRole('button', { name: 'All' }));

    // Assert
    expect(onChange.mock.calls).toEqual([['blazor'], [null]]);
  });
});
