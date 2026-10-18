import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeStatsClient, makeDay, makeVisit } from '../../testing/fixtures';
import type { StatsIndex } from '../data/types';
import { resolvePreset, type Query } from '../query/query';
import { Dashboard } from './Dashboard';

const TODAY = '2026-10-18';

const DAYS = [
  makeDay('2026-10-16', [
    makeVisit({ token: 'a', hour: 10, editions: ['js', 'angular'], referrer: 'www.linkedin.com', loads: 1, screen: 'desktop', scheme: 'dark', sections: ['about', 'portfolio'], seconds: 75, clicks: ['edition/angular/header'], apiCalls: 1, skills: ['Angular'] }),
    makeVisit({ token: 'b', hour: 22, editions: ['react'], country: 'DE', edge: 'FRA', loads: 1, screen: 'phone', scheme: 'light', seconds: 20, clicks: ['github/profile/about'], resumes: ['react'] }),
  ]),
  makeDay('2026-10-17', [makeVisit({ token: 'a', hour: 9, editions: ['js'], loads: 1, screen: 'desktop', scheme: 'dark', seconds: 5 }), makeVisit({ token: 'c', hour: 14, editions: ['blazor'], country: 'NL', edge: 'AMS' })]),
  // 2026-10-18 has no file
];

function indexOf(client: ReturnType<typeof fakeStatsClient>): Promise<StatsIndex> {
  return client.loadIndex();
}

function renderDashboard(query: Query, client = fakeStatsClient(DAYS)) {
  const setQuery = vi.fn();
  const view = indexOf(client).then((index) => render(<Dashboard client={client} index={index} query={query} setQuery={setQuery} today={TODAY} />));
  return { setQuery, client, view };
}

const SEVEN_DAYS: Query = { range: resolvePreset('7d', TODAY), preset: '7d', compare: false, segments: [] };

describe('Dashboard', () => {
  it('should load only the days that exist and show the headline numbers', async () => {
    // Arrange
    const { client, view } = renderDashboard(SEVEN_DAYS);
    await view;

    // Act
    await waitFor(() => expect(screen.getByText('Visitors', { selector: '.tile-label' })).toBeTruthy());

    // Assert
    expect(client.requested).toEqual(['2026-10-16', '2026-10-17']);
    const tiles = screen.getAllByRole('article');
    const tileText = (label: string) => tiles.find((tile) => within(tile).queryByText(label) !== null)?.querySelector('.tile-value')?.textContent ?? '';
    expect(tileText('Visitors')).toContain('3');
    expect(tileText('Visits')).toContain('4');
    expect(tileText('Beacon reach')).toContain('75%'); // visit c never sent a ping
    expect(tileText('Time on page')).toContain('20s'); // median of 5, 20, 75
    expect(tileText('Edition clicks')).toContain('1');
    expect(tileText('GitHub clicks')).toContain('1');
    expect(tileText('Resume downloads')).toContain('1');
    expect(screen.getByText(/Returning visitors/).textContent).toContain('1');
    expect(screen.getByText(/No file for 5 days/)).toBeTruthy();
  });

  it('should fill the panels from the same visits', async () => {
    // Arrange
    await renderDashboard(SEVEN_DAYS).view;
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Editions' })).toBeTruthy());

    // Assert
    const editions = screen.getByRole('heading', { name: 'Editions' }).closest('section')!;
    expect(within(editions).getByRole('button', { name: 'Filter by JS' }).closest('li')?.textContent).toContain('2');
    const referrers = screen.getByRole('heading', { name: 'Referrers' }).closest('section')!;
    expect(within(referrers).getByRole('button', { name: 'Filter by Direct or unknown' }).closest('li')?.textContent).toContain('75%');
    const countries = screen.getByRole('heading', { name: 'Countries' }).closest('section')!;
    expect(within(countries).getByRole('button', { name: 'Filter by Germany' })).toBeTruthy();
    const funnel = screen.getByRole('heading', { name: 'Reading funnel' }).closest('section')!;
    expect(within(funnel).getByText('About').closest('li')?.textContent).toContain('100%');
    const clicks = screen.getByRole('heading', { name: 'Edition clicks' }).closest('section')!;
    expect(within(clicks).getByText('To Angular')).toBeTruthy();
    expect(within(clicks).getByText('header menu 1')).toBeTruthy();
    const profile = screen.getByRole('heading', { name: 'GitHub and profile clicks' }).closest('section')!;
    expect(within(profile).getByText('GitHub profile')).toBeTruthy();
    const api = screen.getByRole('heading', { name: 'Experience API' }).closest('section')!;
    expect(within(api).getByText('Angular')).toBeTruthy();
    expect(screen.getAllByTestId('chart-line')).toHaveLength(2); // the main chart and the scanner panel
    expect(screen.getAllByTestId('chart-doughnut')).toHaveLength(2);
    expect(screen.getAllByTestId('chart-bar')).toHaveLength(2);
  });

  it('should add a segment when a row is clicked and narrow every panel to it', async () => {
    // Arrange
    const user = userEvent.setup();
    const { setQuery, view } = renderDashboard(SEVEN_DAYS);
    await view;
    await waitFor(() => expect(screen.getByRole('button', { name: 'Filter by React' })).toBeTruthy());

    // Act
    await user.click(screen.getByRole('button', { name: 'Filter by React' }));

    // Assert
    expect(setQuery).toHaveBeenCalledWith({ ...SEVEN_DAYS, segments: [{ dimension: 'edition', value: 'react' }] });
  });

  it('should apply the query segments to the numbers', async () => {
    // Arrange
    const query: Query = { ...SEVEN_DAYS, segments: [{ dimension: 'country', value: 'DE' }] };
    await renderDashboard(query).view;
    await waitFor(() => expect(screen.getByText('Visitors', { selector: '.tile-label' })).toBeTruthy());

    // Assert
    const tiles = screen.getAllByRole('article');
    const visits = tiles.find((tile) => within(tile).queryByText('Visits') !== null);
    expect(visits?.querySelector('.tile-value')?.textContent).toContain('1');
    expect(screen.getByText('No edition clicks in this range')).toBeTruthy();
  });

  it('should show deltas when comparing with the previous period', async () => {
    // Arrange
    const client = fakeStatsClient([...DAYS, makeDay('2026-10-09', [makeVisit({ token: 'z' })])]);
    const { view } = renderDashboard({ ...SEVEN_DAYS, compare: true }, client);
    await view;
    await waitFor(() => expect(screen.getByText('Visitors', { selector: '.tile-label' })).toBeTruthy());

    // Assert
    expect(client.requested).toContain('2026-10-09');
    const visits = screen.getAllByRole('article').find((tile) => within(tile).queryByText('Visits') !== null);
    expect(visits?.querySelector('.tile-delta')?.textContent).toContain('+300%');
    expect(screen.getByText(/compared with Oct 5 – Oct 11, 2026/)).toBeTruthy();
  });

  it('should say when the range has no files and offer the available days', async () => {
    // Arrange
    const user = userEvent.setup();
    const query: Query = { range: { from: '2026-09-01', to: '2026-09-07' }, preset: null, compare: false, segments: [] };
    const { setQuery, view } = renderDashboard(query);
    await view;
    await waitFor(() => expect(screen.getByText('No data for this range')).toBeTruthy());

    // Act
    await user.click(screen.getByRole('button', { name: 'Go to the latest day' }));

    // Assert
    expect(setQuery).toHaveBeenCalledWith({ ...query, range: { from: '2026-10-17', to: '2026-10-17' } });
  });

  it('should show the error with a retry when a day fails to load', async () => {
    // Arrange
    const client = fakeStatsClient(DAYS);
    let failures = 0;
    const failing = {
      ...client,
      loadDays: (keys: readonly string[]) => {
        if (failures++ === 0) {
          return Promise.reject(new Error('/data/days/2026-10-17.json answered 500'));
        }
        return client.loadDays(keys);
      },
    };
    const user = userEvent.setup();
    const { view } = renderDashboard(SEVEN_DAYS, failing as typeof client);
    await view;
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());

    // Act
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    await waitFor(() => expect(screen.getByText('Visitors', { selector: '.tile-label' })).toBeTruthy());
  });
});
