import { Suspense, lazy, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { Icon } from '../components/Icon';
import { KioskDialog } from '../components/KioskDialog';

/** The URL fragment that opens the FHIR API card, the target of the Healthcare chip and the old /fhir redirect. */
export const FHIR_HASH = '#fhir-api';

// The explorer is its own chunk, fetched the first time the accordion opens.
const FhirExplorer = lazy(() =>
  import('../components/FhirExplorer').then((module) => ({ default: module.FhirExplorer })),
);

/**
 * Selected work. The kiosk card opens the live demo dialog; the FHIR API card's accordion holds the
 * patient explorer, loaded lazily the first time it opens, and opens itself for "#fhir-api".
 */
export function PortfolioSection() {
  const [kioskOpen, setKioskOpen] = useState(false);
  const [fhirOpen, setFhirOpen] = useState(false);
  const [fhirLoaded, setFhirLoaded] = useState(false);
  const fhirCard = useRef<HTMLElement>(null);

  // "#fhir-api" opens the accordion on first render and on hashchange; the browser scrolls to the card
  // on its own, and the toggle below scrolls again.
  useEffect(() => {
    const openFromHash = (): void => {
      if (window.location.hash === FHIR_HASH) {
        setFhirOpen(true);
      }
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, []);

  // Once opened, the explorer stays mounted so a closed card keeps its search.
  useEffect(() => {
    if (fhirOpen) {
      setFhirLoaded(true);
    }
  }, [fhirOpen]);

  /**
   * Keeps the state in step with a toggle on the native element. Opening hides the card's image, so
   * the body jumps up and the explorer unfolds below the fold; scrolling the card to the top of the
   * viewport keeps the whole thing in view. The stylesheet's scroll-padding-top clears the header
   * and prefers-reduced-motion drops the glide.
   */
  const onFhirToggle = (event: SyntheticEvent<HTMLDetailsElement>): void => {
    setFhirOpen(event.currentTarget.open);
    if (event.currentTarget.open) {
      fhirCard.current?.scrollIntoView({ block: 'start' });
    }
  };

  return (
    <>
      <section className="section section-alt" id="portfolio" aria-labelledby="portfolio-title">
        <div className="container">
          <p className="eyebrow">03 / Portfolio</p>
          <h2 id="portfolio-title">Selected Work</h2>
          <p className="section-intro">
            My entire career has gone into enterprise systems that belong to the companies I built
            them for, so that code stays in their private repositories. The projects below are my own. They are
            here to show how I design, write, test, and ship software when every decision is mine.
          </p>
          <div className="card-grid portfolio-grid">
            <article className="card portfolio-card portfolio-card-featured">
              <div className="card-media">
                <img
                  src="assets/images/portfolio/mvcprogrammer-com.jpg"
                  alt="Neal Thomas, with C# service code from a .NET API in the background"
                  width="1200"
                  height="750"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="card-body">
                <h3>mvcprogrammer.com</h3>
                <p className="card-subtitle">The tech behind this site, in four editions</p>
                <p>
                  The default edition of this site follows the KISS principle: keep it simple, and
                  add nothing that is not earning its place. Plain HTML, CSS, and JavaScript with no
                  framework, no build step, and no dependencies. The files live in a private S3
                  bucket that only CloudFront can read through Origin Access Control. CloudFront
                  serves them worldwide over HTTPS with an ACM certificate, Route 53 points the
                  domain at the distribution, and a GitHub Actions workflow authenticated with OIDC
                  syncs the bucket and invalidates the cache on every push to main. No servers, no
                  load balancer, no auto scaling group.
                </p>
                <p>
                  The Experience section is served by a C# API on Lambda and DynamoDB, with default
                  HTML as a fallback.
                </p>
                <p>
                  You are reading the fourth edition: the same page rebuilt as a React 19 app,
                  TypeScript and hooks in the browser, bundled by Vite and served the same way from
                  a <code>react/</code> prefix of the same bucket. The second and third editions do
                  it again in Blazor WebAssembly and in Angular. Every content change ships to all
                  four in the same commit; the edition menu in the header switches between them. The
                  colophon at the bottom has the details.
                </p>
                <ul
                  className="tag-list card-tags"
                  role="list"
                  aria-label="Technologies used on mvcprogrammer.com"
                >
                  <li className="tag">HTML</li>
                  <li className="tag">CSS</li>
                  <li className="tag">Vanilla JavaScript</li>
                  <li className="tag">JSON-LD</li>
                  <li className="tag">C# / .NET 10 on Lambda</li>
                  <li className="tag">DynamoDB</li>
                  <li className="tag">OpenAPI 3.1</li>
                  <li className="tag">Amazon S3</li>
                  <li className="tag">CloudFront + OAC</li>
                  <li className="tag">CloudFront Functions</li>
                  <li className="tag">Route 53</li>
                  <li className="tag">IAM</li>
                  <li className="tag">GitHub Actions (OIDC)</li>
                  <li className="tag">Content Security Policy</li>
                  <li className="tag">React 19</li>
                </ul>
                <a
                  className="card-link"
                  href="https://github.com/mvcprogrammer/mvcprogrammer.com"
                  target="_blank"
                  rel="noopener"
                >
                  View the source on GitHub
                </a>
              </div>
            </article>

            <article className="card portfolio-card">
              <div className="card-media">
                <img
                  src="assets/images/portfolio/property-search-kiosk.jpg"
                  alt="Interactive property search kiosk screen listing Clearwater Beach condos with touch controls"
                  width="1200"
                  height="750"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="card-body">
                <h3>Interactive Property Search Window Display</h3>
                <p className="card-subtitle">Touch screen kiosk, React + .NET on AWS</p>
                <p>
                  A touch-screen kiosk behind the window of a Clearwater Beach real estate office,
                  running since 2010. Visitors pick sales or rentals over an aerial photo of Sand
                  Key, browse live Stellar MLS listings and photos pulled through the Bridge Data
                  Output API, and ask to be emailed details or called back from an on-screen
                  keyboard. The 2026 rebuild is a React and TypeScript screen built with Vite,
                  pixel-matched to the original against captures of the live kiosk, in front of a
                  .NET 10 API on AWS Lambda served through CloudFront.
                </p>
                <p>
                  <strong>Built for 1920&times;1080.</strong> The screen is pixel-matched to the
                  kiosk's fixed full-HD display and runs full screen at that resolution. In any
                  other window it scales itself to fit, letterboxed, so the live demo below looks
                  like the kiosk on a laptop or a phone.
                </p>
                <ul
                  className="tag-list card-tags"
                  role="list"
                  aria-label="Technologies used on the kiosk"
                >
                  <li className="tag">React</li>
                  <li className="tag">TypeScript</li>
                  <li className="tag">Vite</li>
                  <li className="tag">.NET 10</li>
                  <li className="tag">AWS Lambda</li>
                  <li className="tag">CloudFront</li>
                  <li className="tag">Stellar MLS</li>
                  <li className="tag">Bridge Data Output API</li>
                  <li className="tag">1920&times;1080</li>
                </ul>
                <div className="button-row card-actions">
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => setKioskOpen(true)}
                  >
                    <Icon name="monitor" />
                    Try the live kiosk
                  </button>
                </div>
                <a
                  className="card-link"
                  href="https://github.com/mvcprogrammer/sandkey-display-web"
                  target="_blank"
                  rel="noopener"
                >
                  Kiosk screen on GitHub
                </a>
                <a
                  className="card-link"
                  href="https://github.com/mvcprogrammer/sandkey-display-api"
                  target="_blank"
                  rel="noopener"
                >
                  API on GitHub
                </a>
              </div>
            </article>

            <article className="card portfolio-card">
              <div className="card-media">
                <img
                  src="assets/images/portfolio/lightsplitters-com.jpg"
                  alt="Home page of lightsplitters.com showing the LightSplitters Media wedding, portrait, and pet photography galleries"
                  width="1200"
                  height="750"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="card-body">
                <h3>lightsplitters.com</h3>
                <p className="card-subtitle">Photography studio, Angular on AWS</p>
                <p>
                  The website for LightSplitters Media, a fictional Tampa Bay photography studio I
                  created as a portfolio piece: weddings, portraits, family albums, and archival prints. An
                  Angular 22 workspace with standalone components and signals, prerendered to static
                  HTML with no server. A second app in the same workspace is a template for client
                  sites, so each couple's wedding site or family album lives at its own subdomain
                  from one shared build plus a JSON file and a folder of photos. Masonry galleries
                  with a native dialog lightbox, responsive WebP and JPEG images, a contact form
                  that posts to a Lambda function sending through SES, and print orders through
                  Stripe Payment Links. All of it served from a private S3 bucket through
                  CloudFront, with a CloudFront Function routing each subdomain to its folder.
                </p>
                <ul
                  className="tag-list card-tags"
                  role="list"
                  aria-label="Technologies used on lightsplitters.com"
                >
                  <li className="tag">Angular 22</li>
                  <li className="tag">TypeScript</li>
                  <li className="tag">Signals</li>
                  <li className="tag">Prerendered SSG</li>
                  <li className="tag">SCSS</li>
                  <li className="tag">Amazon S3</li>
                  <li className="tag">CloudFront Functions</li>
                  <li className="tag">Lambda + SES</li>
                  <li className="tag">Route 53</li>
                  <li className="tag">Stripe</li>
                </ul>
                <a
                  className="card-link"
                  href="https://lightsplitters.com"
                  target="_blank"
                  rel="noopener"
                >
                  Visit lightsplitters.com
                </a>
                <a
                  className="card-link"
                  href="https://github.com/mvcprogrammer/lightsplitters.com"
                  target="_blank"
                  rel="noopener"
                >
                  Source on GitHub
                </a>
              </div>
            </article>

            {/* FHIR API card. The explorer is a lazy component rendered once the accordion has opened,
                so its chunk and its first request to /api/fhir load only when a visitor asks. Open, the
                card spans the grid row (styles.css) so the two-panel results keep their width. */}
            <article className="card portfolio-card" id="fhir-api" ref={fhirCard}>
              <div className="card-media">
                <img
                  src="assets/images/portfolio/fhir-api-react.jpg"
                  alt="The React edition's FHIR R4 patient explorer in dark mode, showing a synthetic patient's summary: counts and active conditions with SNOMED codes"
                  width="1200"
                  height="750"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="card-body">
                <h3>FHIR API</h3>
                <p className="card-subtitle">
                  FHIR R4 patient explorer, C# on Lambda with the Firely SDK
                </p>
                <p>
                  A read-only window onto a public FHIR R4 test server seeded with synthetic records. Five endpoints under <code>/api/fhir</code> (patient search, summary, raw bundle, capability, and health) run as C# on .NET 10 on AWS Lambda behind this distribution, specified in the same OpenAPI document as the Experience API. The browser never talks to the sandbox; the function is the boundary, parsing every resource with the Firely SDK and mapping only the US Core fields to small DTOs.
                </p>
                <p>
                  <strong>Built to be polite to a shared sandbox.</strong> Every upstream call has a short timeout, retries with backoff, and a circuit breaker, and a failure comes back as an RFC 9457 problem the explorer turns into a plain message. Responses carry ETags and CloudFront caches them. No real patient data, nothing stored.
                </p>
                <ul
                  className="tag-list card-tags"
                  role="list"
                  aria-label="Technologies used on the FHIR API"
                >
                  <li className="tag">C# / .NET 10 on Lambda</li>
                  <li className="tag">Firely SDK</li>
                  <li className="tag">FHIR R4 / US Core</li>
                  <li className="tag">HAPI sandbox</li>
                  <li className="tag">OpenAPI 3.1</li>
                  <li className="tag">Polly</li>
                  <li className="tag">RFC 9457</li>
                  <li className="tag">CloudFront caching</li>
                  <li className="tag">React 19</li>
                </ul>
                <a
                  className="card-link"
                  href="https://github.com/mvcprogrammer/mvcprogrammer.com/tree/main/api/src/Fhir.Api"
                  target="_blank"
                  rel="noopener"
                >
                  API on GitHub
                </a>
                <a
                  className="card-link"
                  href="https://github.com/mvcprogrammer/mvcprogrammer.com/blob/main/api/openapi.yaml"
                  target="_blank"
                  rel="noopener"
                >
                  OpenAPI spec
                </a>

                <details
                  className="fhir-accordion"
                  data-fhir-accordion
                  open={fhirOpen}
                  onToggle={onFhirToggle}
                >
                  <summary className="button button-primary fhir-accordion-summary">
                    <Icon name="data" />
                    <span className="fhir-accordion-open-label">Try the patient explorer</span>
                    <span className="fhir-accordion-close-label">Close the patient explorer</span>
                  </summary>
                  {fhirLoaded && (
                    <Suspense fallback={null}>
                      <FhirExplorer />
                    </Suspense>
                  )}
                </details>
              </div>
            </article>
          </div>
        </div>
      </section>

      <KioskDialog open={kioskOpen} onClose={() => setKioskOpen(false)} />
    </>
  );
}
