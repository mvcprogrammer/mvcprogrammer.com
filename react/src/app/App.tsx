import { BrowserRouter, Route, Routes } from 'react-router';
import { IconSprite } from './components/IconSprite';
import { SiteFooter } from './components/SiteFooter';
import { SiteHeader } from './components/SiteHeader';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { SiteProvider } from './providers/SiteProvider';
import type { SiteServices } from './providers/site-services';

/** Props of App. */
export interface AppProps {
  /** The services built by createSiteServices(), or fakes in a test. */
  readonly services: SiteServices;
}

/** The layout: skip link, icon sprite, header, the routed page inside main, footer. Needs a router above it. */
export function Layout() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <IconSprite />

      <SiteHeader />

      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <SiteFooter />
    </>
  );
}

/** The app: the services, the browser router, and the layout. "/" is Home; everything else is NotFound. */
export function App({ services }: AppProps) {
  return (
    <SiteProvider services={services}>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </SiteProvider>
  );
}
