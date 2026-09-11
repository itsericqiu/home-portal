# Portal v2 implementation scope

_Historical: the scope and acceptance criteria Portal v2 was built against. Service names in the examples (e.g. Hermes) are illustrative; Portal renders any registered service from contract data._

## Product boundary

Portal v2 is a static, read-only presentation surface for Home Stack. Home
Stack remains authoritative for registry membership, routes, lifecycle, health,
Admin, Caddy, launchd, and secrets. Portal stores only local presentation
preferences (theme, density, favorites, and recents) and contains no privileged
actions or credentials.

## Contract boundary

Home Stack owns two versioned, sanitized, same-origin projections:

- `/.well-known/home-stack/catalog.json` lists every registry service and only
  its public identity, launch URL, scope, lifecycle, kind, and launchability.
- `/.well-known/home-stack/status.json` contains summary state and sanitized
  process/network/route/HTTP signal states. It excludes targets, PIDs, paths,
  logs, errors, action descriptors, registry configuration, and credentials.

Fixtures live under `test/fixtures/` and are served only by the Vite development
server. They are never copied to `dist/`, and production has no sample fallback.

## Allowed files

Portal implementation may replace or add application, test, schema, PWA asset,
documentation, and tool configuration files within `home-portal`.

Home Stack integration is implemented and reviewed in the Home Stack
repository: projection handlers, registry-derived output, exact Caddy routes,
canonical schemas, tests, and infrastructure documentation remain outside this
Portal repository.

## Acceptance criteria

1. A production build fetches only the two same-origin well-known endpoints,
   validates schema version 1, and visibly reports unavailable or malformed
   data; it never requests or embeds fixtures.
2. Every catalog service is displayed by default. Concrete routed services are
   launchable; headless, task, wildcard, and unknown services remain visible in
   System without broken links.
3. Hermes, when registered, is discovered from catalog data and launches at
   the installation's catalog-provided URL; fictional legacy fixture services
   do not appear in production.
4. Search/command palette, keyboard navigation, full-card launching, favorites,
   recents, details, categories, status summary, theme, density, refresh/retry,
   Admin links, and stale/offline states work by keyboard and touch.
5. The UI has visible focus, non-color-only status, reduced-motion behavior,
   semantic headings/announcements, 44px controls where practical, safe-area
   padding, and no horizontal overflow at 390px or 430px.
6. The PWA has an installable manifest, local icons, standalone layout, cached
   shell/catalog behavior, and network-first status whose cached results become
   visibly stale.
7. JSON Schemas, runtime validators, unit/component/accessibility tests, and
   Playwright desktop/390px/430px projects cover malformed data, offline/stale
   recovery, search, favorites, unknown services, and Hermes discovery.
8. Home Stack tests and Caddy validation pass before deployment. The live Portal
   is inspected on desktop and iPhone-sized viewports, and Portal, Hermes,
   Admin, OpenCode, and OpenChamber health is verified after deployment.
9. Development, integration, deployment, verification, security exclusions,
   performance budget, and rollback steps are documented.

## Performance budget

The initial application JavaScript (compressed transfer total) should remain
under 180 KiB. Large icon libraries, runtime icon CDNs, and dashboard component
frameworks are intentionally excluded.
