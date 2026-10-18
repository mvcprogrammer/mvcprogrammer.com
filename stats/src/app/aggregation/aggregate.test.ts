import { makeVisit } from '../../testing/fixtures';
import { EMPTY_SUMMARY, bucketSeconds, countBy, delta, filterVisits, matches, quantile, ranScript, returningVisitors, share, splitClick, summarize } from './aggregate';

const VISITS = [
  makeVisit({ token: 'a', hour: 10, editions: ['js', 'angular'], referrer: 'www.linkedin.com', loads: 1, screen: 'desktop', scheme: 'dark', sections: ['about', 'portfolio'], seconds: 75, clicks: ['edition/angular/header'], apiCalls: 1, skills: ['Angular'] }),
  makeVisit({ token: 'a', hour: 10, editions: ['js'], loads: 1, screen: 'desktop', scheme: 'dark', seconds: 5 }),
  makeVisit({ token: 'b', hour: 22, editions: ['react'], country: 'DE', edge: 'FRA', loads: 1, screen: 'phone', scheme: 'light', seconds: 20, clicks: ['github/profile/about', 'github/mvcprogrammer.com/portfolio'], resumes: ['react'] }),
  makeVisit({ token: 'b', hour: 23, editions: ['js'], country: 'DE', edge: 'FRA', sections: ['about'] }),
];

describe('aggregate', () => {
  it('should count visits, visitors, beacon loads, and engaged visits', () => {
    // Act
    const summary = summarize(VISITS);

    // Assert
    expect(summary.visits).toBe(4);
    expect(summary.visitors).toBe(2);
    expect(summary.beaconLoads).toBe(3);
    expect(summary.beaconReached).toBe(4); // D sent a view ping without a load ping
    expect(summary.engaged).toBe(2);
    expect(summary.apiLoads).toBe(1);
  });

  it('should break visits down by edition, screen, scheme, referrer, country, and hour', () => {
    // Act
    const summary = summarize(VISITS);

    // Assert
    expect(summary.byEdition).toEqual({ js: 3, angular: 1, react: 1 });
    expect(Object.keys(summary.byEdition)).toEqual(['js', 'angular', 'react']); // display order, not count order
    expect(summary.byScreen).toEqual({ phone: 1, desktop: 2 });
    expect(summary.byScheme).toEqual({ light: 1, dark: 2 });
    expect(summary.byReferrer).toEqual({ '(direct)': 3, 'www.linkedin.com': 1 });
    expect(summary.byCountry).toEqual({ DE: 2, US: 2 });
    expect(Object.keys(summary.byCountry)).toEqual(['DE', 'US']); // ties by name
    expect(summary.byHour.filter((count) => count > 0)).toEqual([2, 1, 1]);
    expect(summary.byHour[10]).toBe(2);
  });

  it('should collect the funnel, the seconds, and the clicks', () => {
    // Act
    const summary = summarize(VISITS);

    // Assert
    expect(summary.sectionReach).toEqual({ about: 2, portfolio: 1 });
    expect(summary.seconds).toEqual([5, 20, 75]);
    expect(summary.clicks).toEqual({ 'edition/angular/header': 1, 'github/mvcprogrammer.com/portfolio': 1, 'github/profile/about': 1 });
    expect(summary.editionClickVisits).toBe(1);
    expect(summary.githubClickVisits).toBe(1);
    expect(summary.githubProfileClicks).toBe(1);
    expect(summary.githubRepoClicks).toBe(1);
    expect(summary.skillClicks).toEqual({ Angular: 1 });
    expect(summary.resumeDownloads).toEqual({ react: 1 });
  });

  it('should tell a visit that ran the script from one that did not', () => {
    expect(ranScript(makeVisit({ loads: 1 }))).toBe(true);
    expect(ranScript(makeVisit({ sections: ['about'] }))).toBe(true);
    expect(ranScript(makeVisit({ seconds: 0 }))).toBe(true);
    expect(ranScript(makeVisit({ clicks: ['github/profile/about'] }))).toBe(true);
    expect(ranScript(makeVisit({ apiCalls: 2 }))).toBe(false);
  });

  it('should summarize nothing as zeros', () => {
    expect(EMPTY_SUMMARY.visits).toBe(0);
    expect(EMPTY_SUMMARY.byHour).toHaveLength(24);
    expect(EMPTY_SUMMARY.seconds).toEqual([]);
  });

  it('should match segments on every dimension, with direct for a missing referrer', () => {
    const [a, , c, d] = VISITS;
    expect(matches(a!, [{ dimension: 'edition', value: 'angular' }])).toBe(true);
    expect(matches(c!, [{ dimension: 'edition', value: 'angular' }])).toBe(false);
    expect(matches(c!, [{ dimension: 'screen', value: 'phone' }, { dimension: 'country', value: 'DE' }])).toBe(true);
    expect(matches(c!, [{ dimension: 'screen', value: 'phone' }, { dimension: 'country', value: 'US' }])).toBe(false);
    expect(matches(d!, [{ dimension: 'referrer', value: '(direct)' }])).toBe(true);
    expect(matches(a!, [{ dimension: 'referrer', value: '(direct)' }])).toBe(false);
    expect(matches(d!, [{ dimension: 'scheme', value: 'dark' }])).toBe(false); // never ran the script
  });

  it('should filter visits and return a copy when there are no segments', () => {
    const all = filterVisits(VISITS, []);
    expect(all).toEqual(VISITS);
    expect(all).not.toBe(VISITS);
    expect(filterVisits(VISITS, [{ dimension: 'country', value: 'DE' }]).map((visit) => visit.hour)).toEqual([22, 23]);
  });

  it('should count returning visitors as tokens seen on more than one day', () => {
    const day1 = [makeVisit({ token: 'a' }), makeVisit({ token: 'a' }), makeVisit({ token: 'b' })];
    const day2 = [makeVisit({ token: 'b' }), makeVisit({ token: 'c' })];
    expect(returningVisitors([day1, day2])).toBe(1);
    expect(returningVisitors([day1])).toBe(0);
  });

  it('should compute quantiles, shares, and deltas with nulls for the undefined cases', () => {
    expect(quantile([5, 20, 75], 0.5)).toBe(20);
    expect(quantile([5, 20, 75], 0.75)).toBe(75);
    expect(quantile([], 0.5)).toBeNull();
    expect(share(1, 4)).toBe(0.25);
    expect(share(0, 0)).toBeNull();
    expect(delta(120, 100)).toBeCloseTo(0.2);
    expect(delta(80, 100)).toBeCloseTo(-0.2);
    expect(delta(5, 0)).toBeNull();
    expect(delta(null, 3)).toBeNull();
  });

  it('should bucket seconds into the six fixed buckets', () => {
    expect(bucketSeconds([0, 9, 10, 29, 30, 59, 60, 119, 120, 299, 300, 9999])).toEqual([2, 2, 2, 2, 2, 2]);
    expect(bucketSeconds([])).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('should order countBy by the named keys first, then by count, then by name', () => {
    expect(Object.entries(countBy(['b', 'a', 'b', 'c', 'c', 'c']))).toEqual([['c', 3], ['b', 2], ['a', 1]]);
    expect(Object.keys(countBy(['zz', 'about', 'zz'], ['about', 'services']))).toEqual(['about', 'zz']);
  });

  it('should split a click key into kind, target, and place', () => {
    expect(splitClick('edition/angular/header')).toEqual({ kind: 'edition', target: 'angular', place: 'header' });
    expect(splitClick('github/profile/about')).toEqual({ kind: 'github', target: 'profile', place: 'about' });
    expect(splitClick('odd')).toEqual({ kind: 'odd', target: '?', place: '?' });
  });
});
