import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express from 'express';
import { currentUserKey, currentUserToken, userTokenScope, userTokenStorage } from './userToken.ts';

async function serve(app: express.Express) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() };
}

function appEchoingToken() {
  const app = express();
  app.use(userTokenScope);
  app.use(express.json());
  app.post('/echo', async (req, res) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    const scope = currentUserToken();
    res.json({ inRequest: scope !== undefined, token: scope?.userToken ?? null, body: req.body });
  });
  return app;
}

test('a request handler reads the X-Kbc-App-User-Token of its own request, after an await and a JSON body', async () => {
  const { url, close } = await serve(appEchoingToken());
  try {
    const [a, b] = await Promise.all(
      ['token-a', 'token-b'].map((token) =>
        fetch(`${url}/echo`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-kbc-app-user-token': token },
          body: JSON.stringify({ token }),
        }).then((res) => res.json()),
      ),
    );
    assert.deepEqual(a, { inRequest: true, token: 'token-a', body: { token: 'token-a' } });
    assert.deepEqual(b, { inRequest: true, token: 'token-b', body: { token: 'token-b' } });
  } finally {
    close();
  }
});

test('a request without the header is in a request scope with no token', async () => {
  const { url, close } = await serve(appEchoingToken());
  try {
    const res = await fetch(`${url}/echo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.deepEqual(await res.json(), { inRequest: true, token: null, body: {} });
  } finally {
    close();
  }
});

test('code outside a request has no scope', () => {
  assert.equal(currentUserToken(), undefined);
});

function fakeToken(payload: object) {
  return ['{"alg":"ES256"}', JSON.stringify(payload)].map((part) => Buffer.from(part).toString('base64url')).join('.') + '.sig';
}

test('the user key is idp and sub, the same for every token of that user', () => {
  const key = (payload: object) => userTokenStorage.run({ userToken: fakeToken(payload) }, currentUserKey);
  const anna = key({ idp: 'https://login.example.com', sub: 'anna', jti: '1' });
  assert.equal(anna, key({ idp: 'https://login.example.com', sub: 'anna', jti: '2' }));
  assert.notEqual(anna, key({ idp: 'https://login.example.com', sub: 'bob', jti: '1' }));
  assert.notEqual(anna, key({ idp: 'https://other.example.com', sub: 'anna', jti: '1' }));
  assert.doesNotMatch(String(anna), /sig/);
});

test('no token or an unreadable one has no user key', () => {
  assert.equal(currentUserKey(), undefined);
  assert.equal(userTokenStorage.run({ userToken: undefined }, currentUserKey), undefined);
  assert.equal(userTokenStorage.run({ userToken: 'not-a-jwt' }, currentUserKey), undefined);
  assert.equal(userTokenStorage.run({ userToken: fakeToken({ sub: 'anna' }) }, currentUserKey), undefined);
});
