// mvcprogrammer.com — CloudFront Function "mvcprogrammer-www-redirect" (viewer-request, cloudfront-js-2.0).
// Attached to every behavior of the main distribution. Three jobs:
//   1. Send www.mvcprogrammer.com to the apex with a 301.
//   2. Answer the engagement beacon (GET /ping?e=view&s=<section> and /ping?e=leave&t=<seconds>, sent by
//      main.js and its Blazor and Angular mirrors) with an empty 204 at the edge. The request is still
//      written to the access logs, which is all tools/cf-stats.mjs needs; nothing reaches S3.
//   3. Serve the clean URL of the FHIR patient explorer: on the apex, /fhir (with or without a trailing
//      slash) reads fhir.html from the bucket and the address bar does not change. The explorer exists
//      once, on the apex, so on the edition hosts (blazor., angular., react.) /fhir is sent there with a 301.
// Deploy: see docs/DEPLOY.md, section 4b.
function handler(event) {
  var request = event.request;
  var host = request.headers.host && request.headers.host.value;
  if (host === 'www.mvcprogrammer.com') {
    return redirect('https://mvcprogrammer.com' + request.uri);
  }
  if (request.uri === '/ping') {
    return {
      statusCode: 204,
      statusDescription: 'No Content',
      headers: { 'cache-control': { value: 'no-store' } }
    };
  }
  if (request.uri === '/fhir' || request.uri === '/fhir/') {
    if (host !== 'mvcprogrammer.com') {
      return redirect('https://mvcprogrammer.com/fhir');
    }
    request.uri = '/fhir.html';
  }
  return request;
}

function redirect(location) {
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: { location: { value: location } }
  };
}
