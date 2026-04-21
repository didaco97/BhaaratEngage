import { AsyncLocalStorage } from "node:async_hooks";

import type { RequestPrincipal } from "./auth.types.js";

interface RequestAuthContext {
  readonly principal: RequestPrincipal | null;
  readonly organizationId: string | null;
}

const requestContextStorage = new AsyncLocalStorage<RequestAuthContext | null>();

export function runWithRequestPrincipal<T>(principal: RequestPrincipal | null, callback: () => T) {
  return requestContextStorage.run(
    {
      principal,
      organizationId: principal?.organizationId ?? null,
    },
    callback,
  );
}

export function runWithRequestOrganizationId<T>(organizationId: string, callback: () => T) {
  const existingContext = requestContextStorage.getStore();

  return requestContextStorage.run(
    {
      principal: existingContext?.principal ?? null,
      organizationId,
    },
    callback,
  );
}

export function getRequestPrincipal() {
  return requestContextStorage.getStore()?.principal ?? null;
}

export function getRequestOrganizationId() {
  return requestContextStorage.getStore()?.organizationId ?? null;
}
