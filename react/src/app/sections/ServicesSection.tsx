import { Icon } from '../components/Icon';
import { useSite } from '../providers/SiteProvider';

/** For employers. The call to action preselects the contact topic. */
export function ServicesSection() {
  const { topics } = useSite();
  return (
    <section className="section" id="services" aria-labelledby="services-title">
      <div className="container">
        <p className="eyebrow">02 / For Employers</p>
        <h2 id="services-title">What I Offer Employers</h2>
        <p className="section-intro">
          For companies hiring a senior full-stack engineer. These are the six areas I own on a
          product team, from the first design review through production support, and the standard I
          hold each one to.
        </p>
        <div className="card-grid">
          <article className="card service-card">
            <div className="service-icon" aria-hidden="true">
              <Icon name="design" />
            </div>
            <h3>Design</h3>
            <p>
              Turning requirements from Product into scalable design blueprints. I research the
              problem space and the systems already in play, then break the work into epics,
              stories, and tasks with clear acceptance criteria.
            </p>
            <p>
              From there I plan Sprint 0, lead the architecture review, and guide the development
              effort through delivery, documenting progress, decisions, and challenges so the whole
              team can see where things stand.
            </p>
            <p>An engineered design is the keystone.</p>
          </article>
          <article className="card service-card">
            <div className="service-icon" aria-hidden="true">
              <Icon name="data" />
            </div>
            <h3>Data</h3>
            <p>
              Schema design and T-SQL on SQL Server: stored procedures, indexing strategy, and
              execution plan analysis for queries that stay fast under load. On AWS, single-table
              DynamoDB models with keys and access patterns designed up front.
            </p>
            <p>
              Data stays tight from the database to the browser: typed models in the API, versioned
              request and response contracts, and TypeScript interfaces that mirror them, so a
              change in one layer is caught at compile time rather than in production.
            </p>
          </article>
          <article className="card service-card">
            <div className="service-icon" aria-hidden="true">
              <Icon name="code" />
            </div>
            <h3>Code</h3>
            <p>
              Maintainable, efficient code written to industry-standard conventions refined over 15
              years, built on SOLID principles and modern software engineering patterns, and
              delivered on schedule.
            </p>
            <p>
              Clean, consistent C# and TypeScript the next engineer can read without a tour, kept
              that way through analyzers, code review, and small, focused pull requests.
            </p>
            <p>No over-engineering or anti-patterns.</p>
          </article>
          <article className="card service-card">
            <div className="service-icon" aria-hidden="true">
              <Icon name="test" />
            </div>
            <h3>Test</h3>
            <p>
              Every feature ships with fully functional unit and integration tests in xUnit or
              NUnit, with Moq for mocking, covering the happy path, edge cases, and failure modes.
            </p>
            <p>
              Tests run in the pipeline on every push, so refactoring stays safe and regressions
              surface before review rather than in production.
            </p>
            <p>Tests are the guardrails.</p>
          </article>
          <article className="card service-card">
            <div className="service-icon" aria-hidden="true">
              <Icon name="deploy" />
            </div>
            <h3>Deploy</h3>
            <p>
              CI/CD pipelines in Azure DevOps or GitHub Actions that build, test, and ship Docker
              images, from GitOps deployments with ArgoCD on Kubernetes down to lean deploy scripts
              for small serverless projects on AWS.
            </p>
            <p>
              Environments are reproducible, rollbacks are a single step, and every release leaves a
              trail from commit to running service.
            </p>
          </article>
          <article className="card service-card">
            <div className="service-icon" aria-hidden="true">
              <Icon name="monitor" />
            </div>
            <h3>Monitor &amp; Support</h3>
            <p>
              Production is instrumented with structured logging through Serilog, shipped to Seq,
              Datadog, or CloudWatch, with dashboards and alarms tuned so problems surface before
              customers notice.
            </p>
            <p>
              When something does slip through, I switch on debug-level logging for the affected
              component, trace the request through the logs, run the root-cause analysis, and ship
              the fix with a test that keeps it from coming back.
            </p>
          </article>
        </div>
        <div className="button-row section-cta">
          <a
            className="button button-primary"
            href="#contact"
            onClick={() => topics.select('Job opportunity')}
          >
            Talk about a role
          </a>
          <a className="button button-secondary" href="#resume">
            See my experience
          </a>
        </div>
      </div>
    </section>
  );
}
