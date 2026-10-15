import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  inject,
} from '@angular/core';
import { EngagementTracker } from '../../interfaces/engagement-tracker';
import { AboutSection } from '../../sections/about-section/about-section';
import { ColophonSection } from '../../sections/colophon-section/colophon-section';
import { ContactSection } from '../../sections/contact-section/contact-section';
import { FreelanceSection } from '../../sections/freelance-section/freelance-section';
import { HeroSection } from '../../sections/hero-section/hero-section';
import { PortfolioSection } from '../../sections/portfolio-section/portfolio-section';
import { QuoteSection } from '../../sections/quote-section/quote-section';
import { ResumeSection } from '../../sections/resume-section/resume-section';
import { ServicesSection } from '../../sections/services-section/services-section';

/** The one page: the sections in page order. Starts the engagement tracker once they are rendered. */
@Component({
  selector: 'app-home',
  imports: [
    HeroSection,
    AboutSection,
    QuoteSection,
    ServicesSection,
    FreelanceSection,
    PortfolioSection,
    ResumeSection,
    ContactSection,
    ColophonSection,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-hero-section />
    <app-about-section />
    <app-quote-section />
    <app-services-section />
    <app-freelance-section />
    <app-portfolio-section />
    <app-resume-section />
    <app-contact-section />
    <app-colophon-section />
  `,
})
export class Home {
  constructor() {
    const tracker = inject(EngagementTracker);
    afterNextRender(() => tracker.start());
    inject(DestroyRef).onDestroy(() => tracker.stop());
  }
}
