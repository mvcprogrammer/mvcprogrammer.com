import { Icon } from '../components/Icon';

/** About. */
export function AboutSection() {
  return (
    <section className="section" id="about" aria-labelledby="about-title">
      <div className="container">
        <p className="eyebrow">01 / About</p>
        <h2 id="about-title">About Me</h2>
        <div className="about-grid">
          <div className="about-body">
            <p>
              I've spent 15+ years building enterprise API applications on C# / .NET and SQL Server,
              with Angular front ends over ASP.NET Core Web APIs. My SQL Server work runs deep:
              complex queries, stored procedures, indexing, execution plan analysis, and performance
              tuning under concurrent load.
            </p>
            <p>
              Most recently I re-architected a legacy interval-polling Windows service into an
              event-driven RabbitMQ pipeline that handles 1M+ API requests around the clock. Before
              that I developed and maintained TOPS Software's proprietary accounting system,
              covering general ledger, receivables, payables, bank reconciliation, and financial
              reporting.
            </p>
            <p>
              I build on SOLID principles and modern software engineering patterns, and I own my
              work end to end, from Sprint 0 and architecture review through delivery, code review,
              mentoring, and production root-cause analysis. Teams count on me to ship on schedule
              and to leave the codebase better than I found it. AI-assisted tools like Claude Code
              are part of my daily workflow.
            </p>
            <a
              className="button button-primary"
              href="https://github.com/mvcprogrammer"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="github" />
              See my code on GitHub
            </a>
          </div>
          <div className="about-aside">
            <h3 className="aside-title">Core skills</h3>
            <ul className="tag-list" role="list" aria-label="Skills">
              <li className="tag">API First Design</li>
              <li className="tag">C# / .NET</li>
              <li className="tag">Claude Pair Programming</li>
              {/* The Angular, React, Blazor, and JavaScript chips lead to the four editions of this site and are the same on every edition. */}
              <li className="tag">
                <a
                  href="https://angular.mvcprogrammer.com/"
                  title="See the Angular edition of this site"
                >
                  Angular
                </a>
              </li>
              <li className="tag">
                <a
                  href="https://react.mvcprogrammer.com/"
                  title="See the React edition of this site"
                >
                  React
                </a>
              </li>
              <li className="tag">SQL Server</li>
              <li className="tag">AWS</li>
              <li className="tag">
                <a
                  href="https://blazor.mvcprogrammer.com/"
                  title="See the Blazor edition of this site"
                >
                  Blazor
                </a>
              </li>
              <li className="tag">
                <a
                  href="https://mvcprogrammer.com/"
                  title="See the plain JavaScript edition of this site"
                >
                  JavaScript
                </a>
              </li>
              <li className="tag">Azure DevOps</li>
              <li className="tag">xUnit</li>
              <li className="tag">Docker</li>
            </ul>
            <h3 className="aside-title">Domains</h3>
            <ul className="tag-list" role="list" aria-label="Domain expertise">
              <li className="tag">Accounting</li>
              <li className="tag">
                <a href="https://mvcprogrammer.com/fhir" title="Open the FHIR R4 patient explorer, a live demo on this site">
                  Healthcare (HL7, FHIR, HIPAA)
                </a>
              </li>
              <li className="tag">Real estate (Stellar MLS, Bridge API)</li>
              <li className="tag">Financial trading systems</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
