// mvcprogrammer.com — infra/lambda/stats-auth/index.js
// The sign-in check in front of stats.mvcprogrammer.com, run by CloudFront as a Lambda@Edge viewer-
// request function. Every request, the day files under /data/ included, passes through here: with a
// valid Cognito session cookie it continues to S3; without one it is redirected to the user pool's
// hosted sign-in, and the return trip (/?code=...) is exchanged for tokens that are set as HttpOnly
// cookies. /signout revokes the tokens, clears the cookies, and sends the visitor to the main site.
// The cognito-at-edge library does the work; this file only loads its configuration.
//
// Lambda@Edge functions have no environment variables, so the pool id, app client id, hosted UI
// domain, and the CSRF nonce secret are read once per container from SSM Parameter Store in
// us-east-1 (see README.md for the parameter names and the role the function needs).
'use strict';

const { Authenticator } = require('cognito-at-edge');
const { SSMClient, GetParametersCommand } = require('@aws-sdk/client-ssm');

/** Where the parameters live; the names under it are fixed. */
const PARAMETER_PREFIX = '/mvcprogrammer/stats/';

/** The parameters the function needs, by the name under the prefix. */
const PARAMETER_NAMES = ['user-pool-id', 'user-pool-app-id', 'user-pool-domain', 'nonce-secret'];

/** Sessions last this long before the visitor signs in again; matches the app client's refresh token validity. */
const COOKIE_EXPIRATION_DAYS = 30;

/** Where /signout sends the visitor. */
const SIGN_OUT_REDIRECT = 'https://mvcprogrammer.com/';

let authenticatorPromise = null;

/**
 * Builds the Authenticator options from a map of parameter name (without the prefix) to value.
 * Exported for the test; throws when a parameter is missing so a misconfigured deploy fails loudly
 * instead of letting requests through.
 */
function buildOptions(parameters) {
  for (const name of PARAMETER_NAMES) {
    if (typeof parameters[name] !== 'string' || parameters[name] === '') {
      throw new Error(`Missing SSM parameter ${PARAMETER_PREFIX}${name}`);
    }
  }
  return {
    region: 'us-east-1',
    userPoolId: parameters['user-pool-id'],
    userPoolAppId: parameters['user-pool-app-id'],
    userPoolDomain: parameters['user-pool-domain'],
    cookieExpirationDays: COOKIE_EXPIRATION_DAYS,
    httpOnly: true,
    sameSite: 'Lax',
    logoutConfiguration: { logoutUri: '/signout', logoutRedirectUri: SIGN_OUT_REDIRECT },
    csrfProtection: { nonceSigningSecret: parameters['nonce-secret'] },
    logLevel: 'warn',
  };
}

/** Reads the parameters from SSM (decrypting the secret) into a plain map. */
async function readParameters(client) {
  const names = PARAMETER_NAMES.map((name) => `${PARAMETER_PREFIX}${name}`);
  const response = await client.send(new GetParametersCommand({ Names: names, WithDecryption: true }));
  const parameters = {};
  for (const parameter of response.Parameters ?? []) {
    parameters[parameter.Name.slice(PARAMETER_PREFIX.length)] = parameter.Value;
  }
  return parameters;
}

async function createAuthenticator() {
  const client = new SSMClient({ region: 'us-east-1' });
  return new Authenticator(buildOptions(await readParameters(client)));
}

exports.handler = async (event) => {
  try {
    authenticatorPromise ??= createAuthenticator();
    const authenticator = await authenticatorPromise;
    return await authenticator.handle(event);
  } catch (error) {
    authenticatorPromise = null; // try the parameters again on the next request
    console.error('stats-auth failed', error);
    // Fail closed: never let a request through because the check broke.
    return { status: '503', statusDescription: 'Service Unavailable', headers: { 'content-type': [{ key: 'Content-Type', value: 'text/plain' }], 'cache-control': [{ key: 'Cache-Control', value: 'no-store' }] }, body: 'Sign-in is unavailable right now.' };
  }
};

exports.buildOptions = buildOptions;
exports.readParameters = readParameters;
exports.PARAMETER_PREFIX = PARAMETER_PREFIX;
