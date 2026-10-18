// node --test infra/lambda/stats-auth/
'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildOptions, readParameters, PARAMETER_PREFIX } = require('./index.js');

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
