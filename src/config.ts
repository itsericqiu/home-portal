export const CATALOG_URL = "/.well-known/home-stack/catalog.json";
export const STATUS_URL = "/.well-known/home-stack/status.json";
export const STATUS_STALE_AFTER_MS = 60_000;

export const useDevelopmentFixtures =
  import.meta.env.DEV && import.meta.env.VITE_USE_FIXTURES !== "false";

export const catalogURL = useDevelopmentFixtures ? "/__fixtures/catalog.json" : CATALOG_URL;
export const statusURL = useDevelopmentFixtures ? "/__fixtures/status.json" : STATUS_URL;
