// fhir.mvcprogrammer.com — CloudFront Function "mvcprogrammer-fhir-viewer-request" (viewer-request, cloudfront-js-2.0).
// Attached to the default behavior of the explorer's distribution only; the /api/fhir/* behavior has no function.
// Two jobs:
//   1. Answer the engagement beacon (GET /ping) with an empty 204 at the edge, as mvcprogrammer-www-redirect
//      does for the editions. The request is still written to the access logs, which is all tools/cf-stats.mjs needs.
//   2. Send any path without a file extension to /index.html, so the Angular router answers deep links from
//      S3 directly. The distribution carries no 403 -> /index.html custom error response, so the FHIR function's
//      own 403 (the read-only answer for the seeded patient) reaches the client as the problem openapi.yaml
//      promises; a missing asset (a path with an extension) answers S3's 403, which is right for a file.
// Deploy: see docs/DEPLOY.md, FHIR explorer section.
function handler(event) {
  var request = event.request;
  if (request.uri === '/ping') {
    return {
      statusCode: 204,
      statusDescription: 'No Content',
      headers: { 'cache-control': { value: 'no-store' } }
    };
  }
  var last = request.uri.substring(request.uri.lastIndexOf('/') + 1);
  if (last.indexOf('.') === -1) {
    request.uri = '/index.html';
  }
  return request;
}
