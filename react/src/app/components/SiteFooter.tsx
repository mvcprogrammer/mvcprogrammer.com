import { SocialLinks } from './SocialLinks';

/** Footer. The legal pages stay on the static site, so the links leave this origin. */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p className="footer-copy">&copy; {year} mvcprogrammer.com</p>
        <ul className="footer-links" role="list" aria-label="Legal">
          <li>
            <a href="https://mvcprogrammer.com/privacy.html">Privacy</a>
          </li>
          <li>
            <a href="https://mvcprogrammer.com/terms.html">SMS terms</a>
          </li>
        </ul>
        <SocialLinks />
      </div>
    </footer>
  );
}
