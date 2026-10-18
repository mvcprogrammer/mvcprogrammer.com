import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeStatsClient, generateDays } from '../testing/fixtures';
import { App } from './App';

const TODAY = '2026-10-18';

describe('App', () => {
  it('should render the header controls, the updated stamp, and the dashboard from the index', async () => {
    // Arrange
    const client = fakeStatsClient(generateDays('2026-09-01', '2026-10-18'), '2026-10-18T13:00:00Z');

    // Act
    render(<App client={client} today={TODAY} />);

    // Assert
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('mvcprogrammer.com');
    await waitFor(() => expect(screen.getByText(/Updated/)).toBeTruthy());
    expect(screen.getByRole('group', { name: 'Edition' })).toBeTruthy();
    expect(screen.getByLabelText('Range')).toBeTruthy();
    expect(screen.getByLabelText('Compare')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Visitors', { selector: '.tile-label' })).toBeTruthy());
    expect(window.location.search).toBe('');
  });

  it('should put the edition, compare, and range into the URL and show the chips', async () => {
    // Arrange
    const user = userEvent.setup();
    const client = fakeStatsClient(generateDays('2026-09-01', '2026-10-18'));
    render(<App client={client} today={TODAY} />);
    await waitFor(() => expect(screen.getByText('Visitors', { selector: '.tile-label' })).toBeTruthy());

    // Act
    await user.click(screen.getByRole('button', { name: 'React' }));
    await user.click(screen.getByLabelText('Compare'));
    await user.selectOptions(screen.getByLabelText('Range'), '7d');

    // Assert
    expect(window.location.search).toBe('?range=7d&compare=1&seg=edition%3Areact');
    expect(screen.getByRole('button', { name: 'Remove filter Edition: React' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'React' }).getAttribute('aria-pressed')).toBe('true');

    // Act
    await user.click(screen.getByRole('button', { name: 'Remove filter Edition: React' }));

    // Assert
    expect(window.location.search).toBe('?range=7d&compare=1');
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('should read the query from the URL on load and follow the back button', async () => {
    // Arrange
    window.history.replaceState(null, '', '/?range=7d&seg=country%3AUS');
    const client = fakeStatsClient(generateDays('2026-09-01', '2026-10-18'));
    render(<App client={client} today={TODAY} />);
    await waitFor(() => expect(screen.getByText('Visitors', { selector: '.tile-label' })).toBeTruthy());

    // Assert
    expect((screen.getByLabelText('Range') as HTMLSelectElement).value).toBe('7d');
    expect(screen.getByRole('button', { name: 'Remove filter Country: United States' })).toBeTruthy();

    // Act
    window.history.replaceState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));

    // Assert
    await waitFor(() => expect((screen.getByLabelText('Range') as HTMLSelectElement).value).toBe('30d'));
    expect(screen.queryByRole('button', { name: /Remove filter/ })).toBeNull();
  });

  it('should clean the sign-in return parameters out of the URL on load', async () => {
    // Arrange
    window.history.replaceState(null, '', '/?code=abc123&state=eyJub25jZSI6IjEifQ&range=7d');
    const client = fakeStatsClient(generateDays('2026-10-01', '2026-10-18'));

    // Act
    render(<App client={client} today={TODAY} />);
    await waitFor(() => expect(screen.getByText('Visitors', { selector: '.tile-label' })).toBeTruthy());

    // Assert
    expect(window.location.search).toBe('?range=7d');
    expect((screen.getByLabelText('Range') as HTMLSelectElement).value).toBe('7d');
  });

  it('should show the error state with retry when the index fails', async () => {
    // Arrange
    const good = fakeStatsClient(generateDays('2026-10-01', '2026-10-18'));
    let failed = false;
    const client = {
      ...good,
      loadIndex: () => {
        if (!failed) {
          failed = true;
          return Promise.reject(new Error('/data/index.json answered 503'));
        }
        return good.loadIndex();
      },
    };
    const user = userEvent.setup();
    render(<App client={client} today={TODAY} />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('503'));

    // Act
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    await waitFor(() => expect(screen.getByText('Visitors', { selector: '.tile-label' })).toBeTruthy());
  });
});
