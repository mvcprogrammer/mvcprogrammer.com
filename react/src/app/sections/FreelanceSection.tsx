import { Icon } from '../components/Icon';
import { useSite } from '../providers/SiteProvider';

/** Freelance. The call to action preselects the contact topic. */
export function FreelanceSection() {
  const { topics } = useSite();
  return (
    <section className="section" id="freelance" aria-labelledby="freelance-title">
      <div className="container">
        <p className="eyebrow">03 / Freelance Work</p>
        <h2 id="freelance-title">Collaborate with Me</h2>
        <p className="section-intro">
          Not every problem needs a full-time hire. I take on short, well-defined engagements for
          teams that want senior .NET, Angular, React, or SQL Server help without the ramp-up, and I
          keep the first step small so there is nothing to lose by trying it.
        </p>
        <div className="card-grid">
          <article className="card service-card">
            <div className="service-icon" aria-hidden="true">
              <Icon name="preview" />
            </div>
            <h3>Low-risk preview</h3>
            <p>
              Start with one small, fixed-scope piece of work, a day or two at most, so you can see
              how I communicate, estimate, and deliver before committing to anything bigger.
            </p>
            <p>
              If it is not a fit, you still walk away with finished, tested work and a clear
              write-up of what I found.
            </p>
          </article>
          <article className="card service-card">
            <div className="service-icon" aria-hidden="true">
              <Icon name="wrench" />
            </div>
            <h3>Small changes</h3>
            <p>
              Bug fixes, small features, framework and dependency upgrades, and the tickets that
              never reach the top of the backlog.
            </p>
            <p>
              Scoped up front and delivered as clean pull requests against your repository, with
              tests, so your team can review and merge on its own schedule.
            </p>
          </article>
          <article className="card service-card">
            <div className="service-icon" aria-hidden="true">
              <Icon name="savings" />
            </div>
            <h3>Cloud cost savings</h3>
            <p>
              A review of your AWS or Azure bill and the architecture behind it: idle and oversized
              resources, servers doing work that serverless does for pennies, and the slow queries
              and missing caches that inflate compute.
            </p>
            <p>
              You get the savings quantified and ranked by payoff against effort, in a
              plan your team can act on itself or hand to me. This site, including its
              fully functional API, runs on S3, CloudFront, Lambda, and DynamoDB for a
              few dollars a month.
            </p>
          </article>
          <article className="card service-card">
            <div className="service-icon" aria-hidden="true">
              <Icon name="audit" />
            </div>
            <h3>Audits for developers</h3>
            <p>
              A second set of senior eyes on your codebase: architecture and code review, a SQL
              Server performance pass over execution plans, indexes, and slow stored procedures, or
              a pre-release security check.
            </p>
            <p>
              You get a written report with findings ranked by impact and concrete next steps, not a
              list of lint warnings.
            </p>
          </article>
        </div>
        <div className="button-row section-cta">
          <a
            className="button button-primary"
            href="#contact"
            onClick={() => topics.select('Freelance')}
          >
            Start a conversation
          </a>
        </div>
      </div>
    </section>
  );
}
