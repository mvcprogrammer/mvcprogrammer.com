import { createContext, useContext, type ReactNode } from 'react';
import type { SiteServices } from './site-services';

const SiteContext = createContext<SiteServices | null>(null);

/** Props of SiteProvider. */
export interface SiteProviderProps {
  /** The services every component below reads through useSite(). */
  readonly services: SiteServices;

  /** The app. */
  readonly children: ReactNode;
}

/** Supplies the site services to the component tree. Tests wrap components in it with fakes. */
export function SiteProvider({ services, children }: SiteProviderProps) {
  return <SiteContext value={services}>{children}</SiteContext>;
}

/**
 * The site services from the nearest SiteProvider.
 * @throws Error when no SiteProvider is above the calling component.
 */
export function useSite(): SiteServices {
  const services = useContext(SiteContext);
  if (services === null) {
    throw new Error('useSite() needs a SiteProvider above the component.');
  }

  return services;
}
