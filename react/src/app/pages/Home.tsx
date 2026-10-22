import { useEffect } from 'react';
import { useSite } from '../providers/SiteProvider';
import { AboutSection } from '../sections/AboutSection';
import { ColophonSection } from '../sections/ColophonSection';
import { ContactSection } from '../sections/ContactSection';
import { HeroSection } from '../sections/HeroSection';
import { PortfolioSection } from '../sections/PortfolioSection';
import { QuoteSection } from '../sections/QuoteSection';
import { ResumeSection } from '../sections/ResumeSection';
import { ServicesSection } from '../sections/ServicesSection';

/** The one page: the sections in page order. Starts the engagement tracker once they are rendered. */
export function Home() {
  const { engagement } = useSite();

  useEffect(() => {
    engagement.start();
    return () => engagement.stop();
  }, [engagement]);

  return (
    <>
      <HeroSection />
      <AboutSection />
      <QuoteSection />
      <ServicesSection />
      <PortfolioSection />
      <ResumeSection />
      <ContactSection />
      <ColophonSection />
    </>
  );
}
