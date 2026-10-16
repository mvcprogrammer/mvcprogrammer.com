/** Shown for any path other than the home page. CloudFront hands every unknown path to index.html. */
export function NotFound() {
  return (
    <section className="section" aria-labelledby="not-found-title">
      <div className="container">
        <p className="eyebrow">404</p>
        <h1 id="not-found-title">Page not found</h1>
        <p className="section-intro">
          There is nothing at this address. Everything on the site is on the{' '}
          <a href="/">home page</a>.
        </p>
      </div>
    </section>
  );
}
