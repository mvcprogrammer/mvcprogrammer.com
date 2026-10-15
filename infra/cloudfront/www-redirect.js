// mvcprogrammer.com — CloudFront Function "mvcprogrammer-www-redirect" (viewer-request, cloudfront-js-2.0).
// Attached to every behavior of the main distribution. Two jobs:
//   1. Send www.mvcprogrammer.com to the apex with a 301.
//   2. Answer the engagement beacon (GET /ping?e=view&s=<section> and /ping?e=leave&t=<seconds>, sent by
//      main.js and its Blazor and Angular mirrors) with an empty 204 at the edge. The request is still
//      written to the access logs, which is all tools/cf-stats.mjs needs; nothing reaches S3.
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
  return request;
}
