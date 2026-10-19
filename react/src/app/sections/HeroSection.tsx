/** Hero. */
export function HeroSection() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container">
        <p className="eyebrow">Tampa Bay, Florida, USA</p>
        <h1 id="hero-title">Neal&nbsp;Thomas</h1>
        <p className="lead">
          Senior full-stack engineer building enterprise API applications on C#&nbsp;/&nbsp;.NET,
          Angular, React, and SQL&nbsp;Server.
        </p>

        <ul className="highlights" role="list" aria-label="Highlights">
          <li>
            <span className="highlight-value">C# / .NET</span>
            <span className="highlight-label">15+ Years Backend</span>
          </li>
          <li>
            <span className="highlight-value">Angular / React</span>
            <span className="highlight-label">TypeScript front ends</span>
          </li>
          <li>
            <span className="highlight-value">SQL Server + NoSQL</span>
            <span className="highlight-label">T-SQL &amp; performance tuning</span>
          </li>
        </ul>

        <div className="button-row">
          <a className="button button-primary" href="#portfolio">
            View portfolio
          </a>
          <a className="button button-secondary" href="#contact">
            Get in touch
          </a>
        </div>
      </div>
    </section>
  );
}
