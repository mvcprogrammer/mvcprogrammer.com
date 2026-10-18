import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as csv from '../formatters/csv';
import { TableTwin } from './TableTwin';

describe('TableTwin', () => {
  it('should render the columns and rows as a table behind a disclosure', () => {
    // Arrange, Act
    render(<TableTwin columns={['Day', 'Visits']} rows={[['Oct 1', '3']]} />);

    // Assert
    expect(screen.getByText('Show as table').tagName).toBe('SUMMARY');
    expect(screen.getByRole('columnheader', { name: 'Visits' })).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'Oct 1' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '3' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Download CSV' })).toBeNull();
  });

  it('should download the same rows as CSV when named', async () => {
    // Arrange
    const download = vi.spyOn(csv, 'downloadText').mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<TableTwin name="Visits per day" columns={['Day', 'Visits']} rows={[['Oct 1', '3']]} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Download CSV' }));

    // Assert
    expect(download).toHaveBeenCalledWith('visits-per-day.csv', 'Day,Visits\r\nOct 1,3\r\n');
    download.mockRestore();
  });
});
