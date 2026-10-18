// node --test infra/lambda/stats-auth/
'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildOptions, createHandler, readParameters, withCookieHeader, PARAMETER_PREFIX } = require('./index.js');

const PARAMETERS = { 'user-pool-id': 'us-east-1_abc', 'user-pool-app-id': 'client123', 'user-pool-domain': 'stats.auth.us-east-1.amazoncognito.com', 'nonce-secret': 's3cret' };

test('buildOptions maps the parameters onto the Authenticator options with hardened cookies', () => {
  const options = buildOptions(PARAMETERS);
  assert.equal(options.userPoolId, 'us-east-1_abc');
  assert.equal(options.userPoolAppId, 'client123');
  assert.equal(options.userPoolDomain, 'stats.auth.us-east-1.amazoncognito.com');
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, 'Lax');
  assert.equal(options.cookieExpirationDays, 30);
  assert.deepEqual(options.logoutConfiguration, { logoutUri: '/signout', logoutRedirectUri: 'https://mvcprogrammer.com/' });
  assert.equal(options.csrfProtection.nonceSigningSecret, 's3cret');
});

test('buildOptions refuses a missing or empty parameter', () => {
  assert.throws(() => buildOptions({ ...PARAMETERS, 'nonce-secret': '' }), /Missing SSM parameter \/mvcprogrammer\/stats\/nonce-secret/);
  const { 'user-pool-id': _dropped, ...rest } = PARAMETERS;
  assert.throws(() => buildOptions(rest), /user-pool-id/);
});

test('readParameters asks for every name under the prefix with decryption and strips the prefix', async () => {
  let sent = null;
  const client = {
    send: async (command) => {
      sent = command.input;
      return { Parameters: Object.entries(PARAMETERS).map(([name, value]) => ({ Name: `${PARAMETER_PREFIX}${name}`, Value: value })) };
    },
  };
  const parameters = await readParameters(client);
  assert.deepEqual(parameters, PARAMETERS);
  assert.equal(sent.WithDecryption, true);
  assert.deepEqual(sent.Names, Object.keys(PARAMETERS).map((name) => `${PARAMETER_PREFIX}${name}`));
});

test('the handler passes the event to the authenticator built once per container', async () => {
  let built = 0;
  const seen = [];
  const handler = createHandler(async () => {
    built++;
    return { handle: async (event) => { seen.push(event); return { status: '302' }; } };
  });
  assert.deepEqual(await handler({ id: 1 }), { status: '302' });
  assert.deepEqual(await handler({ id: 2 }), { status: '302' });
  assert.equal(built, 1);
  assert.deepEqual(seen.map((event) => event.id), [1, 2]);
});

test('the handler fails closed with 503 when the configuration cannot be loaded, then retries', async () => {
  const silence = console.error;
  console.error = () => {};
  try {
    let attempts = 0;
    const handler = createHandler(async () => {
      if (attempts++ === 0) {
        throw new Error('Missing SSM parameter');
      }
      return { handle: async () => ({ status: '200' }) };
    });
    const failed = await handler({});
    assert.equal(failed.status, '503');
    assert.equal(failed.headers['cache-control'][0].value, 'no-store');
    assert.equal((await handler({})).status, '200');
    assert.equal(attempts, 2);
  } finally {
    console.error = silence;
  }
});

test('the handler answers 503 when the authenticator itself throws', async () => {
  const silence = console.error;
  console.error = () => {};
  try {
    const handler = createHandler(async () => ({ handle: async () => { throw new Error('boom'); } }));
    assert.equal((await handler({})).status, '503');
  } finally {
    console.error = silence;
  }
});

test('withCookieHeader gives a cookie-less request an empty cookie header and leaves others alone', () => {
  const bare = { Records: [{ cf: { request: { uri: '/signout', headers: { host: [{ key: 'Host', value: 'stats.mvcprogrammer.com' }] } } } }] };
  assert.deepEqual(withCookieHeader(bare).Records[0].cf.request.headers.cookie, []);
  const cookies = [{ key: 'Cookie', value: 'a=b' }];
  const withCookies = { Records: [{ cf: { request: { uri: '/', headers: { cookie: cookies } } } }] };
  assert.equal(withCookieHeader(withCookies).Records[0].cf.request.headers.cookie, cookies);
  assert.deepEqual(withCookieHeader({}), {});
});
