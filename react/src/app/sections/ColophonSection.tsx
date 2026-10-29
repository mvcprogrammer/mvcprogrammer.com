/** How this edition is built. The static site's colophon, rewritten for the React build. */
export function ColophonSection() {
  return (
    <section className="section colophon" id="colophon" aria-labelledby="colophon-title">
      <div className="container">
        <p className="eyebrow">06 / Colophon</p>
        <h2 id="colophon-title">How This Site Is Built</h2>
        <p className="section-intro">
          A footnote for the curious. This is the React edition of{' '}
          <a href="https://mvcprogrammer.com/">mvcprogrammer.com</a>: the same content and the same
          stylesheet under its own palette, with the page rebuilt as React function components in
          TypeScript. There is still no server behind it, only static files on a CDN, four Lambdas,
          and the same API.
        </p>
        <dl className="colophon-list">
          <div className="colophon-item">
            <dt>Front end</dt>
            <dd>
              A React 19 application built with Vite: function components, hooks, and React Router
              for the one route and the not-found page. Each section of the page is a component; the
              header, the skill filter, the kiosk demo, and the contact form hold their state in{' '}
              <code>useState</code> and reach the browser through effects. The static edition's 470
              lines of JavaScript became about the same amount of TypeScript, now split by
              component, typed against the API's contract, and covered by tests. There is no
              separate script: the components call <code>IntersectionObserver</code>,{' '}
              <code>matchMedia</code>, and the native <code>&lt;dialog&gt;</code> directly and clean
              up in effect teardowns.
            </dd>
          </div>
          <div className="colophon-item">
            <dt>Shared with the static site</dt>
            <dd>
              The stylesheet, fonts, images, icons, and the Experience seed data are copied into
              this build from the repository root by a script that runs before every build, so the
              editions cannot drift. The markup is the static page's markup, section by section, as
              JSX. There is no CSS-in-JS and no <code>style</code> attribute: the Content Security
              Policy forbids inline styles, so the few additions sit in one extra stylesheet that
              Vite bundles next to the scripts. That file also carries this edition's palette, the
              slate and cyan of the React documentation, by overriding the shared design tokens with{' '}
              <code>light-dark()</code>; no rule from the shared stylesheet is repeated. The theme
              toggle beside the edition menu is a plain function in the header component that sets{' '}
              <code>data-theme</code> on the root and saves the choice; a small shared script in the
              head applies a saved choice before React renders, so the page never flashes the wrong
              theme.
            </dd>
          </div>
          <div className="colophon-item">
            <dt>API integration</dt>
            <dd>
              The work history is read from the same Experience API (<code>/api/experience</code>{' '}
              and <code>/api/skills</code>) through <code>fetch</code>, with an explicit timeout on
              every request and TypeScript interfaces that mirror the OpenAPI contract. CloudFront
              routes <code>/api</code> on this subdomain to the same Lambda, so the calls stay
              same-origin. If the API is unreachable the timeline renders from a bundled copy of the
              seed file.
            </dd>
          </div>
          <div className="colophon-item">
            <dt>Healthcare demo</dt>
            <dd>
              The <a href="#fhir-api">FHIR API card</a> in Selected Work opens the live FHIR R4
              patient explorer at fhir.mvcprogrammer.com, an Angular app of its own, in the same
              native <code>&lt;dialog&gt;</code> the kiosk demo uses: one <code>DemoDialog</code>{' '}
              function component takes the title, note, and URL as props, owns the native dialog in
              an effect, and renders the iframe only while it is open, so the explorer and the C#
              Lambda behind it load only when a visitor asks. The function reads a public sandbox of
              synthetic records through the Firely SDK, maps the resources to small DTOs, and reports
              every upstream call so the explorer can show what happened; its write side creates,
              replaces, patches, and deletes demo patients under a guard tied to the visitor's
              session. Nothing is stored, and no real patient data is involved.
            </dd>
          </div>
          <div className="colophon-item">
            <dt>Configuration</dt>
            <dd>
              The Lambda URLs and API paths are one typed options object, validated at startup. The
              two fetch clients, the contact topic state, and the engagement beacon are built in one{' '}
              <code>createSiteServices()</code> function behind interfaces and handed to the tree
              through a context provider, so components depend on the contract and tests swap in
              fakes.
            </dd>
          </div>
          <div className="colophon-item">
            <dt>Hosting</dt>
            <dd>
              The build output sits under a <code>react/</code> prefix in the same private S3 bucket
              as the static site, read by a fourth CloudFront distribution through Origin Access
              Control at <code>react.mvcprogrammer.com</code>, with its own ACM certificate and
              Route 53 alias. Unknown paths fall back to <code>index.html</code> so React Router
              answers them.
            </dd>
          </div>
          <div className="colophon-item">
            <dt>Security</dt>
            <dd>
              The same strict response headers as the static site, Content Security Policy included,
              with no change: React needs no inline script, no inline style, and no{' '}
              <code>eval</code>. Vite is told to inline nothing, not even small assets. There is
              still nothing third-party, no cookies, and no analytics.
            </dd>
          </div>
          <div className="colophon-item">
            <dt>Payload</dt>
            <dd>
              The production build is tree-shaken and minified by Vite into a handful of
              fingerprinted files that the browser caches for a week and CloudFront compresses on
              the fly. The app, framework included, is a fraction of the size of the .NET runtime
              the Blazor edition downloads.
            </dd>
          </div>
          <div className="colophon-item">
            <dt>Deploys</dt>
            <dd>
              The GitHub Actions workflow that deploys the static site also runs the Vitest suite,
              the type check, and <code>vite build</code> for this project, syncs the output to the{' '}
              <code>react/</code> prefix, and invalidates this distribution. Same OIDC role, no
              stored AWS keys.
            </dd>
          </div>
          <div className="colophon-item">
            <dt>Tooling</dt>
            <dd>
              Written in JetBrains Rider with Claude Code as a pair programmer, and previewed
              locally with the Vite dev server before each commit.
            </dd>
          </div>
        </dl>
        <a
          className="card-link"
          href="https://github.com/mvcprogrammer/mvcprogrammer.com/tree/main/react"
          target="_blank"
          rel="noopener"
        >
          Read the source on GitHub
        </a>
      </div>
    </section>
  );
}
