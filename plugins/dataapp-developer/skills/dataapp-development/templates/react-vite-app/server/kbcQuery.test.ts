import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, test } from 'node:test';
import { inspect } from 'node:util';
import { isRowLevelSecurityError } from '@keboola/api-client';
import { runQuery } from './kbcQuery.ts';
import { userTokenStorage } from './userToken.ts';

const RLS_DENIED = 'Row-level security does not allow this query';

type Seen = { method: string; path: string; job: string; userToken?: string; storageToken?: string };
let seen: Seen[] = [];
let refusal: { status: number; exception: string } | undefined;
let jobs = 0;
const polls = new Map<string, number>();

const fakeQueryService = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const job = url.pathname.match(/\/queries\/(job-\d+)/)?.[1] ?? '';
  const answer = (status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  req.resume().on('end', () => {
    const entry: Seen = {
      method: req.method ?? '',
      path: url.pathname,
      job,
      userToken: req.headers['x-kbc-app-user-token'] as string | undefined,
      storageToken: req.headers['x-storageapi-token'] as string | undefined,
    };
    if (req.method === 'POST') {
      if (refusal) {
        seen.push(entry);
        return answer(refusal.status, { error: refusal.status, code: String(refusal.status), exception: refusal.exception, status: 'error' });
      }
      const created = `job-${++jobs}`;
      seen.push({ ...entry, job: created });
      return answer(201, { queryJobId: created });
    }
    seen.push(entry);
    if (url.pathname.endsWith('/results')) {
      const owner = seen.find((s) => s.method === 'POST' && s.job === job)?.userToken ?? null;
      return answer(200, {
        status: 'completed',
        columns: [{ name: 'OWNER', type: 'text', nullable: true }],
        data: [[owner]],
        numberOfRows: 1,
        rowsAffected: 0,
      });
    }
    const poll = (polls.get(job) ?? 0) + 1;
    polls.set(job, poll);
    return answer(200, {
      queryJobId: job,
      status: poll < 3 ? 'processing' : 'completed',
      actorType: 'user',
      createdAt: '2026-01-01T00:00:00Z',
      changedAt: '2026-01-01T00:00:01Z',
      statements: [{ id: 'stmt-1', query: 'SELECT 1', status: poll < 3 ? 'processing' : 'completed' }],
    });
  });
});

const tokenDir = mkdtempSync(path.join(tmpdir(), 'kbcQuery-test-'));
const tokenFile = path.join(tokenDir, 'token');

before(async () => {
  await new Promise<void>((resolve) => fakeQueryService.listen(0, '127.0.0.1', resolve));
  const { port } = fakeQueryService.address() as AddressInfo;
  Object.assign(process.env, {
    KBC_URL: 'http://127.0.0.1:1',
    BRANCH_ID: '1',
    WORKSPACE_ID: '2',
    QUERY_SERVICE_URL: `http://127.0.0.1:${port}`,
  });
});
after(() => fakeQueryService.close());
beforeEach(() => {
  seen = [];
  refusal = undefined;
  process.env.KBC_TOKEN = 'env-storage-token';
  delete process.env.STORAGE_API_TOKEN_PATH;
});

const asUser = <T>(userToken: string | undefined, fn: () => Promise<T>) => userTokenStorage.run({ userToken }, fn);
const fast = { interval: 5 };

test('inside a request, every call of the query sends the user token with the Storage token', async () => {
  const rows = await asUser('user-a', () => runQuery('SELECT 1', fast));
  assert.deepEqual(rows, [{ owner: 'user-a' }]);
  assert.deepEqual(new Set(seen.map((s) => s.method)), new Set(['POST', 'GET']));
  assert.ok(seen.some((s) => s.path.endsWith('/results')));
  for (const s of seen) {
    assert.equal(s.userToken, 'user-a', `${s.method} ${s.path}`);
    assert.equal(s.storageToken, 'env-storage-token', `${s.method} ${s.path}`);
  }
});

test('two users at the same time: each query job only ever carries its own user token', async () => {
  const [a, b] = await Promise.all([
    asUser('user-a', () => runQuery('SELECT 1', fast)),
    asUser('user-b', () => runQuery('SELECT 1', fast)),
  ]);
  assert.deepEqual(a, [{ owner: 'user-a' }]);
  assert.deepEqual(b, [{ owner: 'user-b' }]);
  for (const job of new Set(seen.map((s) => s.job))) {
    const tokens = new Set(seen.filter((s) => s.job === job).map((s) => s.userToken));
    assert.equal(tokens.size, 1, `${job} saw ${[...tokens].join(', ')}`);
  }
});

test('outside a request, only the Storage token is sent', async () => {
  await runQuery('SELECT 1', fast);
  assert.ok(seen.length > 0);
  for (const s of seen) {
    assert.equal(s.userToken, undefined);
    assert.equal(s.storageToken, 'env-storage-token');
  }
});

test('the Storage token file wins over KBC_TOKEN and is read again for every query', async () => {
  process.env.STORAGE_API_TOKEN_PATH = tokenFile;
  writeFileSync(tokenFile, 'file-token-1\n');
  await runQuery('SELECT 1', fast);
  writeFileSync(tokenFile, 'file-token-2\n');
  seen = [];
  await runQuery('SELECT 1', fast);
  assert.deepEqual(new Set(seen.map((s) => s.storageToken)), new Set(['file-token-2']));
});

test('an unreadable token file fails with its path, not with a stale KBC_TOKEN', async () => {
  process.env.STORAGE_API_TOKEN_PATH = path.join(tokenDir, 'missing');
  await assert.rejects(runQuery('SELECT 1', fast), /STORAGE_API_TOKEN_PATH.*missing/);
  assert.equal(seen.length, 0);
});

test('no Storage token at all names both sources', async () => {
  delete process.env.KBC_TOKEN;
  await assert.rejects(runQuery('SELECT 1', fast), /STORAGE_API_TOKEN_PATH.*KBC_TOKEN/);
  assert.equal(seen.length, 0);
});

test('a row-level security refusal is a RowLevelSecurityError with the Query Service text and no token', async () => {
  refusal = { status: 403, exception: RLS_DENIED };
  const err = await asUser('user-a', () => runQuery('SELECT 1', fast)).catch((e: unknown) => e);
  assert.ok(isRowLevelSecurityError(err));
  assert.equal(err.message, RLS_DENIED);
  assert.doesNotMatch(inspect(err, { depth: 8 }) + JSON.stringify(err), /user-a|env-storage-token/);
});

test('a refusal outside a request is a RowLevelSecurityError too', async () => {
  refusal = { status: 403, exception: RLS_DENIED };
  const err = await runQuery('SELECT 1', fast).catch((e: unknown) => e);
  assert.ok(isRowLevelSecurityError(err));
});

for (const [status, exception] of [
  [403, 'Failed to get workspace credentials'],
  [503, 'Row-level security could not be applied to this workspace'],
] as const) {
  test(`${status} "${exception}" stays a plain error`, async () => {
    refusal = { status, exception };
    const err = await asUser('user-a', () => runQuery('SELECT 1', fast)).catch((e: unknown) => e);
    assert.ok(err instanceof Error);
    assert.ok(!isRowLevelSecurityError(err));
    assert.equal(err.message, `query service ${status}: ${exception}`);
  });
}
