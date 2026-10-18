import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangePicker } from './DateRangePicker';

const TODAY = '2026-10-18';

describe('DateRangePicker', () => {
  it('should emit the resolved range for a preset', async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DateRangePicker range={{ from: '2026-09-19', to: TODAY }} preset="30d" today={TODAY} onChange={onChange} />);

    // Act
    await user.selectOptions(screen.getByLabelText('Range'), '7d');

    // Assert
    expect(onChange).toHaveBeenCalledWith({ from: '2026-10-12', to: TODAY }, '7d');
    expect(screen.queryByLabelText('From')).toBeNull();
  });

  it('should reveal the date inputs for Custom and emit only a valid pair', async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DateRangePicker range={{ from: '2026-09-19', to: TODAY }} preset="30d" today={TODAY} earliest="2026-10-07" onChange={onChange} />);

    // Act
    await user.selectOptions(screen.getByLabelText('Range'), 'custom');
    const from = screen.getByLabelText('From') as HTMLInputElement;
    const to = screen.getByLabelText('To') as HTMLInputElement;
    fireEvent.change(from, { target: { value: '2026-10-20' } }); // after `to`: ignored
    fireEvent.change(from, { target: { value: '2026-10-10' } });

    // Assert
    expect(from.getAttribute('min')).toBe('2026-10-07');
    expect(to.getAttribute('max')).toBe(TODAY);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ from: '2026-10-10', to: TODAY }, null);
  });

  it('should start on Custom when the query has no preset', () => {
    // Arrange, Act
    render(<DateRangePicker range={{ from: '2026-10-01', to: '2026-10-15' }} preset={null} today={TODAY} onChange={vi.fn()} />);

    // Assert
    expect((screen.getByLabelText('Range') as HTMLSelectElement).value).toBe('custom');
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('2026-10-01');
  });
});
