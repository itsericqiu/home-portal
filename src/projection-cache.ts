import type { ZodType } from "zod";

import { catalogSchema, statusSchema, type Catalog, type PortalStatus } from "./contracts";

const CATALOG_CACHE_KEY = "home-portal.catalog.v1";
const STATUS_CACHE_KEY = "home-portal.status.v1";

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage access itself can be denied (for example, in a restricted web
    // view). Cache cleanup must remain as optional as cache reads and writes.
  }
}

function readValidated<T>(key: string, schema: ZodType<T>): T | undefined {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return undefined;
    const parsed = schema.safeParse(JSON.parse(stored));
    if (parsed.success) return parsed.data;
    remove(key);
  } catch {
    remove(key);
  }
  return undefined;
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable or full. Network and service-worker caching
    // remain authoritative, so startup caching must never block rendering.
  }
}

export function readCachedCatalog(): Catalog | undefined {
  return readValidated(CATALOG_CACHE_KEY, catalogSchema);
}

export function readCachedStatus(): PortalStatus | undefined {
  return readValidated(STATUS_CACHE_KEY, statusSchema);
}

export function cacheCatalog(catalog: Catalog): void {
  write(CATALOG_CACHE_KEY, catalog);
}

export function cacheStatus(status: PortalStatus): void {
  write(STATUS_CACHE_KEY, status);
}
