// mvcprogrammer.com — CloudFront Function "mvcprogrammer-www-redirect" (viewer-request, cloudfront-js-2.0).
// Attached to every behavior of the main distribution. Three jobs:
//   1. Send www.mvcprogrammer.com to the apex with a 301.
//   2. Answer the engagement beacon (GET /ping?e=view&s=<section> and /ping?e=leave&t=<seconds>, sent by
//      main.js and its Blazor and Angular mirrors) with an empty 204 at the edge. The request is still
//      written to the access logs, which is all tools/cf-stats.mjs needs; nothing reaches S3.
//   3. Send the FHIR patient explorer's old URL, /fhir (with or without a trailing slash), to the FHIR API
//      card on the home page with a 301. The explorer lived at /fhir from 2026-10-20 to 2026-10-21; the
//      card's accordion opens itself when the URL carries #fhir-api.
// Deploy: see docs/DEPLOY.md, section 4b.
function handler(event) {
  var request = event.request;
  var host = request.headers.host && request.headers.host.value;
  if (host === 'www.mvcprogrammer.com') {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: 'https://mvcprogrammer.com' + request.uri } }
    };
  }
  if (request.uri === '/ping') {
    return {
      statusCode: 204,
      statusDescription: 'No Content',
      headers: { 'cache-control': { value: 'no-store' } }
    };
  }
  if (request.uri === '/fhir' || request.uri === '/fhir/') {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: 'https://mvcprogrammer.com/#fhir-api' } }
    };
  }
  return request;
}
