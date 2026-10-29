/**
 * Endpoints the site talks to. Held by the SiteServices the SiteProvider supplies, so the Lambda
 * URLs live in configuration rather than in components.
 */
export interface SiteOptions {
  /** Lambda function URL that receives the contact form as JSON. */
  readonly contactEndpoint: string;

  /** Relative base of the Experience API, served by CloudFront on the same origin. */
  readonly experienceApiBase: string;

  /** Relative path of the bundled copy of the positions seed, the fallback when the API is unreachable. */
  readonly experienceSeedPath: string;

  /** The patient explorer, embedded in the portfolio demo dialog. */
  readonly fhirExplorerUrl: string;

  /** The live kiosk, embedded in the portfolio demo dialog. */
  readonly kioskUrl: string;

  /** Lambda function URL that records a resume download and redirects to the PDF. */
  readonly resumeUrl: string;
}
