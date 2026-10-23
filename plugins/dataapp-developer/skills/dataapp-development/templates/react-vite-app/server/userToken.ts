import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

export const USER_TOKEN_HEADER = 'X-Kbc-App-User-Token';

export const userTokenStorage = new AsyncLocalStorage<{ userToken: string | undefined }>();

/**
 * Keeps the request's `X-Kbc-App-User-Token` (set by Keboola's apps proxy) for the whole request, so `runQuery`
 * sends it without route code passing it on.
 */
export function userTokenScope(req: Request, _res: Response, next: NextFunction) {
  userTokenStorage.run({ userToken: req.get(USER_TOKEN_HEADER) || undefined }, next);
}

/** The current request's user token scope, or `undefined` outside a request (startup, timers, background jobs). */
export function currentUserToken() {
  return userTokenStorage.getStore();
}
