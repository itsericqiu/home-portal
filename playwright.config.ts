import { defineConfig, devices } from "@playwright/test";

const testPort = 41720;
const testOrigin = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: "./test/browser",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: testOrigin,
    serviceWorkers: "allow",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${testPort} --strictPort`,
    url: testOrigin,
    reuseExistingServer: false,
    timeout: 30_000
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "iphone-390", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true } },
    { name: "iphone-430", use: { browserName: "chromium", viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true } }
  ]
});
