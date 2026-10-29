import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, inject } from '@angular/core';
import { FhirExplorer } from '../../components/fhir-explorer/fhir-explorer';
import { SITE_OPTIONS } from '../../configurations/site-options';
import { EngagementTracker } from '../../interfaces/engagement-tracker';

/**
 * The one page: the patient explorer, full width, and a line on where it comes from. Starts the
 * engagement tracker once the page is rendered.
 */
@Component({
  selector: 'app-explorer',
  imports: [FhirExplorer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section explorer-page" id="explorer" aria-label="FHIR R4 patient explorer">
      <div class="container">
        <app-fhir-explorer />
        <p class="explorer-about">
          A demo from <a [href]="siteUrl">mvcprogrammer.com</a>. Angular in the browser; the API behind it is C# on .NET 10 on AWS Lambda,
          reading a public FHIR R4 sandbox through the Firely SDK. No real patient data, nothing stored.
        </p>
      </div>
    </section>
  `,
})
export class Explorer {
  /** The main site, for the "about" line. */
  protected readonly siteUrl = inject(SITE_OPTIONS).siteUrl;

  constructor() {
    const tracker = inject(EngagementTracker);
    afterNextRender(() => tracker.start());
    inject(DestroyRef).onDestroy(() => tracker.stop());
  }
}
