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
              Most recently I spent two years on the AI Transition Team at an enterprise healthcare
              software company, bringing GitHub Copilot and then Claude into day-to-day development
              and learning, from production code and code-review feedback, what makes an AI pair
              programmer worth trusting. I have since put those lessons into my own Claude skills
              and agents, written from my experience in the healthcare and accounting fields: HL7 v2
              and FHIR interoperability skills, accounting-domain skills, and reviewer agents that
              enforce my coding standard. The result is a pair programmer that already knows the
              domain and my production patterns, so useful work starts on day one, as the HL7 and
              FHIR projects on this site show. The skills and agents live in a private repository of
              mine and are available for viewing on request.
            </p>
            <p>
              I build on SOLID principles and modern software engineering patterns, and I own my
              work end to end, from Sprint 0 and architecture review through delivery, code review,
              mentoring, and production root-cause analysis. Teams count on me to ship on schedule
              and to leave the codebase better than I found it.
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
                <a href="https://fhir.mvcprogrammer.com/" title="See the live FHIR R4 patient explorer">
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
