import { Icon } from './Icon';

/** Social profile links, used in the header and the footer. */
export function SocialLinks() {
  return (
    <ul className="social-list" role="list" aria-label="Social profiles">
      <li>
        <a
          className="social-link"
          href="https://github.com/mvcprogrammer"
          target="_blank"
          rel="noopener noreferrer me"
          aria-label="GitHub"
        >
          <Icon name="github" />
        </a>
      </li>
      <li>
        <a
          className="social-link"
          href="https://www.linkedin.com/in/mvcprogrammer/"
          target="_blank"
          rel="noopener noreferrer me"
          aria-label="LinkedIn"
        >
          <Icon name="linkedin" />
        </a>
      </li>
      <li>
        <a
          className="social-link"
          href="https://www.flickr.com/photos/lightsplitters/"
          target="_blank"
          rel="noopener noreferrer me"
          aria-label="Flickr"
        >
          <Icon name="flickr" />
        </a>
      </li>
    </ul>
  );
}
