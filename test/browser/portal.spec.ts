import { createRequire } from "node:module";

import { expect, test, type Page, type Route } from "@playwright/test";

import catalogFixture from "../fixtures/catalog.v1.json" with { type: "json" };
import statusFixture from "../fixtures/status.v1.json" with { type: "json" };

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");

function currentCatalog() {
  return { ...catalogFixture, generated_at: new Date().toISOString() };
}

function currentStatus() {
  const now = new Date().toISOString();
  return {
    ...statusFixture,
    generated_at: now,
    services: Object.fromEntries(Object.entries(statusFixture.services).map(([id, service]) => [id, { ...service, checked_at: now }]))
  };
}

async function projections(page: Page, status: () => unknown = currentStatus) {
  await page.route("**/.well-known/home-stack/catalog.json", (route) => route.fulfill({ json: currentCatalog() }));
  await page.route("**/.well-known/home-stack/status.json", (route) => route.fulfill({ json: status() }));
}

test.beforeEach(async ({ page }) => {
  await projections(page);
});

test("discovers services, exposes launch targets, and has no mobile overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hermes Agent" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Hermes Agent" })).toHaveAttribute("href", "https://hermes.home.example.com/");
  await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveAttribute("href", "https://admin.home.example.com/");
  await expect(page.getByRole("heading", { name: "Unknown Tool" })).toBeVisible();
  await expect(page.getByText("Future API")).toHaveCount(0);
  await expect(page.getByText("Media Server")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  const manifest = await page.request.get("/manifest.json");
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).display).toBe("standalone");
});

test("search, command palette, favorites, and details work by keyboard and touch", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Filter services…").fill("hrms");
  await expect(page.getByRole("heading", { name: "Hermes Agent" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "OpenChamber" })).toHaveCount(0);
  await page.getByPlaceholder("Filter services…").fill("");

  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("dialog", { name: "Search and launch services" })).toBeVisible();
  await page.getByPlaceholder("Search apps, services, and tags…").fill("Hermes");
  const hermesOption = page.getByRole("option", { name: /Hermes Agent/ });
  await expect(hermesOption).toHaveAttribute("aria-selected", "true");
  await expect(hermesOption).toHaveAttribute("href", "https://hermes.home.example.com/");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Hermes Agent" })).toBeVisible();

  await page.getByRole("button", { name: "View Hermes Agent details" }).click();
  const details = page.getByRole("dialog", { name: "Hermes Agent" });
  await expect(details).toBeVisible();
  await expect(details.getByText("https://hermes.home.example.com/")).toBeVisible();
  await expect(details.getByRole("link", { name: "View in Admin" })).toHaveAttribute("href", "https://admin.home.example.com/#service-hermes");
  await details.getByRole("button", { name: "Favorite" }).click();
  await details.getByRole("button", { name: "Close details" }).click();
  await expect(page.getByRole("heading", { name: "Favorites" })).toBeVisible();
});

test("browser history dismisses transient search and detail surfaces", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one history-navigation pass is sufficient");
  await page.goto("/");
  await page.getByRole("button", { name: "View Hermes Agent details" }).click();
  await expect(page).toHaveURL(/#service\/hermes$/);
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Hermes Agent" })).toHaveCount(0);

  await page.getByRole("button", { name: /Search apps, services, and tags/ }).click();
  await expect(page).toHaveURL(/#search$/);
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Search and launch services" })).toHaveCount(0);
});

test("mobile navigation keeps Home, Search, and System in thumb reach", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop", "mobile navigation is intentionally hidden on desktop");
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Portal navigation" });
  await expect(navigation).toBeVisible();
  await navigation.getByRole("button", { name: "System" }).click();
  await expect(page.getByRole("heading", { name: "System" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hermes Agent" })).toHaveCount(0);
  await navigation.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("dialog", { name: "Search and launch services" })).toBeVisible();
});

test("ships an immediate launch shell and limits expensive glass to controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one paint and compositing pass is sufficient");
  const html = await (await page.request.get("/")).text();
  expect(html).toContain("boot-shell");
  await page.goto("/");
  const styles = await page.locator(".service-card").first().evaluate((element) => ({
    backdrop: getComputedStyle(element).backdropFilter,
    contentVisibility: getComputedStyle(element.closest(".service-section")!).contentVisibility
  }));
  expect(["none", ""]).toContain(styles.backdrop);
  expect(styles.contentVisibility).toBe("auto");
});

test("malformed catalog is disclosed and never replaced with samples", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one contract-failure pass is sufficient");
  await page.unroute("**/.well-known/home-stack/catalog.json");
  await page.route("**/.well-known/home-stack/catalog.json", (route: Route) => route.fulfill({ json: { services: [] } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your services can’t be shown yet." })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("Portal does not substitute sample data in production.")).toBeVisible();
  await expect(page.getByText("Hermes Agent")).toHaveCount(0);
});

test("stale status is withheld and recovers after refresh", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one recovery pass is sufficient");
  let stale = true;
  const serveStatus = (route: Route) => {
    const payload = currentStatus();
    if (stale) payload.generated_at = "2026-01-01T00:00:00Z";
    return route.fulfill({ json: payload });
  };
  await page.unroute("**/.well-known/home-stack/status.json");
  await page.route("**/.well-known/home-stack/status.json", serveStatus);
  // The service worker fetches status.json NetworkFirst once it claims the page.
  // page.route never sees requests a service worker makes; on a slow runner the
  // worker activates between first paint and the refresh click, the stub is
  // bypassed, and the cached (stale) copy is served back. Context-level routes
  // do intercept service-worker requests, so register the same stub there.
  await context.route("**/.well-known/home-stack/status.json", serveStatus);
  await page.goto("/");
  await expect(page.getByText("Status is stale.")).toBeVisible();
  stale = false;
  await page.getByRole("button", { name: "Refresh catalog and status" }).click();
  await expect(page.getByText("Status is stale.")).toHaveCount(0);
});

test("cached shell and catalog disclose offline status", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one service-worker pass is sufficient");
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.evaluate(async ({ catalog, status }) => {
    const headers = { "Content-Type": "application/json" };
    const catalogCache = await caches.open("home-stack-catalog-v1");
    const statusCache = await caches.open("home-stack-status-v1");
    await catalogCache.put("/.well-known/home-stack/catalog.json", new Response(JSON.stringify(catalog), { headers }));
    await statusCache.put("/.well-known/home-stack/status.json", new Response(JSON.stringify(status), { headers }));
  }, { catalog: currentCatalog(), status: currentStatus() });
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByText("You’re offline.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hermes Agent" })).toBeVisible();
  await context.setOffline(false);
});

test("has no serious automated accessibility violations", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "component and one browser pass cover semantics");
  await page.goto("/");
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    const result = await (window as unknown as { axe: { run: () => Promise<{ violations: Array<{ impact: string | null; id: string }> }> } }).axe.run();
    return result.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  });
  expect(violations).toEqual([]);
});

test("honors reduced motion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one media-preference pass is sufficient");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page.locator(".service-card").first().evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(["0s", "0.00001s", "1e-05s"]).toContain(duration);
});
