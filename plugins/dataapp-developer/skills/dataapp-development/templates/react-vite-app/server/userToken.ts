import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

export const USER_TOKEN_HEADER = 'X-Kbc-App-User-Token';

export const userTokenStorage = new AsyncLocalStorage<{ userToken: string | undefined }>();

export function userTokenScope(req: Request, _res: Response, next: NextFunction) {
  userTokenStorage.run({ userToken: req.get(USER_TOKEN_HEADER) || undefined }, next);
}

export function currentUserToken() {
  return userTokenStorage.getStore();
}

/**
 * The current user from the token's `idp` and `sub`, the same for every token of that user: the key for a per-user cache.
 *
 * - `undefined` without a readable token: cache nothing for such a call.
 * - The payload is read, not verified. That is safe only behind Keboola's apps proxy, which drops any copy of the
 *   header the browser sends; Query Service verifies the token itself.
 */
export function currentUserKey(): string | undefined {
  const payload = currentUserToken()?.userToken?.split('.')[1];
  if (!payload) return undefined;
  try {
    const { idp, sub } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { idp?: unknown; sub?: unknown };
    return typeof idp === 'string' && typeof sub === 'string' && idp && sub ? JSON.stringify([idp, sub]) : undefined;
  } catch {
    return undefined;
  }
}
