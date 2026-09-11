import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

function developmentFixtures(): Plugin {
  const fixtures: Record<string, string> = {
    "/__fixtures/catalog.json": "catalog.v1.json",
    "/__fixtures/status.json": "status.v1.json"
  };

  return {
    name: "home-stack-development-fixtures",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const fixture = fixtures[request.url?.split("?")[0] ?? ""];
        if (!fixture) {
          next();
          return;
        }

        const source = fs.readFileSync(path.join(projectRoot, "test/fixtures", fixture), "utf8");
        const payload = JSON.parse(source) as Record<string, unknown>;
        const now = new Date().toISOString();
        payload.generated_at = now;
        if (fixture === "status.v1.json" && payload.services && typeof payload.services === "object") {
          for (const service of Object.values(payload.services as Record<string, Record<string, unknown>>)) {
            service.checked_at = now;
          }
        }

        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(JSON.stringify(payload));
      });
    }
  };
}

export default defineConfig({
  plugins: [
    developmentFixtures(),
    react(),
    VitePWA({
      registerType: "prompt",
      manifestFilename: "manifest.json",
      includeAssets: ["icons/icon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Home Stack Portal",
        short_name: "Home Stack",
        description: "A private, read-only front door to Home Stack.",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#111714",
        theme_color: "#111714",
        categories: ["utilities", "productivity"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === "/.well-known/home-stack/catalog.json",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "home-stack-catalog-v1",
              expiration: { maxEntries: 1, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] }
            }
          },
          {
            urlPattern: ({ url }) => url.pathname === "/.well-known/home-stack/status.json",
            handler: "NetworkFirst",
            options: {
              cacheName: "home-stack-status-v1",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 1, maxAgeSeconds: 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] }
            }
          }
        ]
      }
    })
  ],
  build: {
    target: "es2022",
    sourcemap: true,
    reportCompressedSize: true
  }
});
