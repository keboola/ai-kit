import assert from 'node:assert/strict';
import { createServer, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, test } from 'node:test';
import { RowLevelSecurityError, runQuery } from './kbcQuery.ts';
import { userTokenStorage } from './userToken.ts';

const RLS_DENIED = 'Row-level security does not allow this query';

let answer: { status: number; headers: Record<string, string>; exception: string };
let received: IncomingHttpHeaders[] = [];
const fakeQueryService = createServer((req, res) => {
  received.push(req.headers);
  req.resume().on('end', () => {
    res.writeHead(answer.status, { 'content-type': 'application/json', ...answer.headers });
    res.end(JSON.stringify({ error: answer.status, code: String(answer.status), exception: answer.exception, status: 'error' }));
  });
});

before(async () => {
  await new Promise<void>((resolve) => fakeQueryService.listen(0, '127.0.0.1', resolve));
  const { port } = fakeQueryService.address() as AddressInfo;
  Object.assign(process.env, {
    KBC_URL: 'http://127.0.0.1:1',
    KBC_TOKEN: 'sapi-token',
    BRANCH_ID: '1',
    WORKSPACE_ID: '2',
    QUERY_SERVICE_URL: `http://127.0.0.1:${port}`,
  });
});
after(() => fakeQueryService.close());
beforeEach(() => {
  received = [];
  answer = { status: 403, headers: { 'x-kbc-rls-mode': 'enforce' }, exception: RLS_DENIED };
});

test('inside a request, the user token goes to the Query Service', async () => {
  await assert.rejects(userTokenStorage.run({ userToken: 'user-jwt' }, () => runQuery('SELECT 1')));
  assert.equal(received[0]?.['x-kbc-app-user-token'], 'user-jwt');
  assert.equal(received[0]?.['x-storageapi-token'], 'sapi-token');
});

test('outside a request, no user token is sent', async () => {
  await assert.rejects(runQuery('SELECT 1'));
  assert.equal(received.length > 0, true);
  assert.equal(received[0]?.['x-kbc-app-user-token'], undefined);
});

test('a row-level security refusal is a RowLevelSecurityError without the request', async () => {
  const err = await userTokenStorage.run({ userToken: 'user-jwt' }, () => runQuery('SELECT 1')).catch((e: unknown) => e);
  assert.ok(err instanceof RowLevelSecurityError);
  assert.equal(err.cause, undefined);
  assert.doesNotMatch(JSON.stringify(err) + String(err.stack), /user-jwt|sapi-token/);
});

test('a refusal outside a request is a RowLevelSecurityError too', async () => {
  await assert.rejects(runQuery('SELECT 1'), RowLevelSecurityError);
});

test('the refusal text is enough, without the X-KBC-RLS-Mode header', async () => {
  answer = { status: 403, headers: {}, exception: RLS_DENIED };
  await assert.rejects(runQuery('SELECT 1'), RowLevelSecurityError);
});

for (const [name, status, headers, exception] of [
  ['the workspace credentials 403 of a governed workspace', 403, { 'x-kbc-rls-mode': 'enforce' }, 'Failed to get workspace credentials'],
  ['the RLS 503', 503, { 'x-kbc-rls-mode': 'enforce' }, 'Row-level security could not be applied to this workspace'],
] as const) {
  test(`${name} stays a plain error`, async () => {
    answer = { status, headers, exception };
    const err = await runQuery('SELECT 1').catch((e: unknown) => e);
    assert.ok(err instanceof Error);
    assert.ok(!(err instanceof RowLevelSecurityError));
    assert.equal(err.message, `query service ${status}: ${exception}`);
  });
}
