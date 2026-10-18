// mvcprogrammer.com — tools/test/fixtures/sample-log.mjs
// A CloudFront access log in the W3C shape the real files have, covering every kind of line the
// tools care about. The times are UTC; the site's day is America/New_York, so 2026-10-17 runs from
// 04:00Z on the 17th to 04:00Z on the 18th. Each scenario is named so a test can say which it asserts.
//
//   A  A desktop visitor from LinkedIn (IAD): page, assets, load ping, two view pings, the Experience
//      API with a skill filter, an edition click in the header, a page on the Angular edition, leave 75 s.
//   B  The same browser back 31 minutes after its last request: a second visit, same visitor.
//   C  A phone visitor (FRA) on the React edition at 22:30 local: load ping, resume download, GitHub click, leave 20 s.
//   D  The same phone at 23:50 local, with a view ping after local midnight: one visit on the 17th.
//   E  Googlebot and an empty user agent: scanners, never visits.
//   F  A real browser probing /wp-login.php and getting a 404: a scanner request, no page, no visit.
//   G  The owner's own IP: excluded when the tools are told to.
//   H  A browser that fetched the page and nothing else: not a visit.
//   I  A Blazor edition visit on 2026-10-16 (MIA): belongs to the day before.

const FIELDS = 'date time x-edge-location sc-bytes c-ip cs-method cs(Host) cs-uri-stem sc-status cs(Referer) cs(User-Agent) cs-uri-query cs(Cookie) x-edge-result-type x-edge-request-id x-host-header cs-protocol cs-bytes time-taken x-forwarded-for ssl-protocol ssl-cipher x-edge-response-result-type cs-protocol-version fle-status fle-encrypted-fields c-port time-to-first-byte x-edge-detailed-result-type sc-content-type sc-content-len sc-range-start sc-range-end';

export const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
export const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
export const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
export const OWN_IP = '68.200.163.142';

/** One log line. CloudFront percent-encodes spaces in the referrer and user agent; the fixture does the same. */
function line({ at, edge, ip, method = 'GET', host, path, status, referrer = '-', ua, query = '-' }) {
  const [date, time] = at.replace('Z', '').split('T');
  const encode = (value) => (value === '-' ? '-' : encodeURIComponent(value).replaceAll('%2F', '/').replaceAll('%3A', ':'));
  const values = [
    date, time, `${edge}50-P1`, '1048', ip, method, 'drm68g34kommd.cloudfront.net', path, String(status), encode(referrer), encode(ua),
    query, '-', status === 404 ? 'Error' : 'Hit', 'request-id', host, 'https', '300', '0.001', '-', 'TLSv1.3', 'TLS_AES_128_GCM_SHA256',
    status === 404 ? 'Error' : 'Hit', 'HTTP/2.0', '-', '-', '51668', '0.001', status === 404 ? 'Error' : 'Hit', 'text/html', '0', '-', '-',
  ];
  return values.join('\t');
}

/** The scenario rows in time order, as objects; `sampleLogText()` renders them. */
export const ROWS = [
  // I: the day before
  { at: '2026-10-16T12:00:00Z', edge: 'MIA', ip: '203.0.113.44', host: 'blazor.mvcprogrammer.com', path: '/', status: 200, ua: CHROME },
  { at: '2026-10-16T12:00:01Z', edge: 'MIA', ip: '203.0.113.44', host: 'blazor.mvcprogrammer.com', path: '/blazor.css', status: 200, ua: CHROME },

  // A
  { at: '2026-10-17T14:00:00Z', edge: 'IAD', ip: '203.0.113.10', host: 'mvcprogrammer.com', path: '/', status: 200, referrer: 'https://www.linkedin.com/', ua: CHROME },
  { at: '2026-10-17T14:00:01Z', edge: 'IAD', ip: '203.0.113.10', host: 'mvcprogrammer.com', path: '/styles.css', status: 200, referrer: 'https://mvcprogrammer.com/', ua: CHROME },
  { at: '2026-10-17T14:00:01Z', edge: 'IAD', ip: '203.0.113.10', host: 'mvcprogrammer.com', path: '/main.js', status: 200, referrer: 'https://mvcprogrammer.com/', ua: CHROME },
  { at: '2026-10-17T14:00:02Z', edge: 'IAD', ip: '203.0.113.10', host: 'mvcprogrammer.com', path: '/ping', status: 204, ua: CHROME, query: 'e=load&v=desktop&c=dark' },
  { at: '2026-10-17T14:00:03Z', edge: 'IAD', ip: '203.0.113.10', host: 'mvcprogrammer.com', path: '/api/experience', status: 200, ua: CHROME, query: 'skill=Angular' },
  { at: '2026-10-17T14:00:20Z', edge: 'IAD', ip: '203.0.113.10', host: 'mvcprogrammer.com', path: '/ping', status: 204, ua: CHROME, query: 'e=view&s=about' },
  { at: '2026-10-17T14:00:45Z', edge: 'IAD', ip: '203.0.113.10', host: 'mvcprogrammer.com', path: '/ping', status: 204, ua: CHROME, query: 'e=view&s=portfolio' },
  { at: '2026-10-17T14:01:10Z', edge: 'IAD', ip: '203.0.113.10', host: 'mvcprogrammer.com', path: '/ping', status: 204, ua: CHROME, query: 'e=click&k=edition&t=angular&f=header' },
  { at: '2026-10-17T14:01:11Z', edge: 'IAD', ip: '203.0.113.10', host: 'mvcprogrammer.com', path: '/ping', status: 204, ua: CHROME, query: 'e=leave&t=75' },
  { at: '2026-10-17T14:01:12Z', edge: 'IAD', ip: '203.0.113.10', host: 'angular.mvcprogrammer.com', path: '/', status: 200, referrer: 'https://mvcprogrammer.com/', ua: CHROME },
  { at: '2026-10-17T14:01:13Z', edge: 'IAD', ip: '203.0.113.10', host: 'angular.mvcprogrammer.com', path: '/main-ABC123.js', status: 200, ua: CHROME },

  // E
  { at: '2026-10-17T15:00:00Z', edge: 'SFO', ip: '192.0.2.1', host: 'mvcprogrammer.com', path: '/', status: 200, ua: GOOGLEBOT },
  { at: '2026-10-17T15:00:01Z', edge: 'SFO', ip: '192.0.2.1', host: 'mvcprogrammer.com', path: '/styles.css', status: 200, ua: GOOGLEBOT },
  { at: '2026-10-17T15:00:02Z', edge: 'SFO', ip: '192.0.2.2', host: 'mvcprogrammer.com', path: '/', status: 200, ua: '-' },

  // B: 31 minutes after A's last request
  { at: '2026-10-17T14:32:14Z', edge: 'IAD', ip: '203.0.113.10', host: 'mvcprogrammer.com', path: '/', status: 304, ua: CHROME },
  { at: '2026-10-17T14:32:15Z', edge: 'IAD', ip: '203.0.113.10', host: 'mvcprogrammer.com', path: '/styles.css', status: 304, ua: CHROME },
  { at: '2026-10-17T14:32:15Z', edge: 'IAD', ip: '203.0.113.10', host: 'mvcprogrammer.com', path: '/ping', status: 204, ua: CHROME, query: 'e=load&v=desktop&c=dark' },
  { at: '2026-10-17T14:32:20Z', edge: 'IAD', ip: '203.0.113.10', host: 'mvcprogrammer.com', path: '/ping', status: 204, ua: CHROME, query: 'e=leave&t=5' },

  // F
  { at: '2026-10-17T16:00:00Z', edge: 'AMS', ip: '192.0.2.5', host: 'mvcprogrammer.com', path: '/wp-login.php', status: 404, ua: CHROME },

  // G
  { at: '2026-10-17T17:00:00Z', edge: 'TPA', ip: OWN_IP, host: 'mvcprogrammer.com', path: '/', status: 200, ua: CHROME },
  { at: '2026-10-17T17:00:01Z', edge: 'TPA', ip: OWN_IP, host: 'mvcprogrammer.com', path: '/styles.css', status: 200, ua: CHROME },

  // H
  { at: '2026-10-17T18:00:00Z', edge: 'JFK', ip: '192.0.2.9', host: 'mvcprogrammer.com', path: '/', status: 200, ua: CHROME },

  // C: 22:30 local
  { at: '2026-10-18T02:30:00Z', edge: 'FRA', ip: '198.51.100.7', host: 'react.mvcprogrammer.com', path: '/', status: 200, ua: IPHONE },
  { at: '2026-10-18T02:30:01Z', edge: 'FRA', ip: '198.51.100.7', host: 'react.mvcprogrammer.com', path: '/bundles/index-XYZ.js', status: 200, ua: IPHONE },
  { at: '2026-10-18T02:30:02Z', edge: 'FRA', ip: '198.51.100.7', host: 'react.mvcprogrammer.com', path: '/ping', status: 204, ua: IPHONE, query: 'e=load&v=phone&c=light' },
  { at: '2026-10-18T02:30:40Z', edge: 'FRA', ip: '198.51.100.7', host: 'react.mvcprogrammer.com', path: '/resume/Neal_Thomas_Resume-react.pdf', status: 200, ua: IPHONE },
  { at: '2026-10-18T02:30:50Z', edge: 'FRA', ip: '198.51.100.7', host: 'react.mvcprogrammer.com', path: '/ping', status: 204, ua: IPHONE, query: 'e=click&k=github&t=profile&f=about' },
  { at: '2026-10-18T02:30:55Z', edge: 'FRA', ip: '198.51.100.7', host: 'react.mvcprogrammer.com', path: '/ping', status: 204, ua: IPHONE, query: 'e=leave&t=20' },

  // D: 23:50 local, crossing midnight
  { at: '2026-10-18T03:50:00Z', edge: 'FRA', ip: '198.51.100.7', host: 'mvcprogrammer.com', path: '/', status: 200, ua: IPHONE },
  { at: '2026-10-18T03:50:01Z', edge: 'FRA', ip: '198.51.100.7', host: 'mvcprogrammer.com', path: '/styles.css', status: 200, ua: IPHONE },
  { at: '2026-10-18T04:05:00Z', edge: 'FRA', ip: '198.51.100.7', host: 'mvcprogrammer.com', path: '/ping', status: 204, ua: IPHONE, query: 'e=view&s=about' },
];

/** The fixture as the text of one gzipped-before-upload log file, header included. Lines are not sorted, as in the real files. */
export function sampleLogText() {
  return ['#Version: 1.0', `#Fields: ${FIELDS}`, ...ROWS.map(line), ''].join('\n');
}
