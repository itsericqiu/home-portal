# Home Portal

Portal v2 is the calm, read-only front door to Home Stack. It discovers every
registered service from sanitized Home Stack projections, makes user-facing
applications easy to launch, and keeps infrastructure and headless services
visible without pretending they are apps.

The application is a static React + TypeScript + Vite PWA. `dist/` is the entire
runtime; there is no Portal server, credential, privileged action, service
allowlist, or infrastructure authority in this repository.

## Ownership boundary

Home Stack owns the service registry, lifecycle, health checks, Caddy, launchd,
Admin, profiles, secrets, and the two sanitized projections. Portal owns only
presentation, search, categories, local preferences, responsive/PWA behavior,
and client-side validation.

Portal may enhance known service IDs with descriptions, categories, order, and
local SVG icons. Those overrides are never used as a visibility allowlist. An
unknown service is always rendered from contract data.

## Install with Home Stack

Portal consumes the two sanitized projections that
[home-stack](https://github.com/itsericqiu/home-stack) publishes on the Portal
origin (`/.well-known/home-stack/catalog.json` and `status.json`). The canonical
schemas live in that repository under `schemas/portal/`; this repository mirrors
them in `schemas/` and `npm run check:schema-sync` compares the two when a
sibling `../home-stack` checkout exists.


Portal does not require a per-installation frontend configuration file. At
runtime it requests the catalog and status from fixed, same-origin well-known
paths, discovers launch URLs—including Admin—from the catalog, and renders
unknown services automatically.

To use it with another Home Stack installation:

```bash
npm ci
cp .home-stack.example.yaml .home-stack.yaml
# Edit only the local host value in .home-stack.yaml.
npm run check
npm run build
```

The local `.home-stack.yaml` is intentionally ignored so an installation's
hostname is not published. Home Stack must serve the resulting `dist/` and
route the two schema-v1 projections through the same Portal origin. See the
complete [installation guide](docs/INSTALLATION.md) for registry, routing,
customization, compatibility, and security requirements.

## Product behavior

- Full-card launch targets for launchable applications.
- A `/` or `⌘K` command palette with fuzzy search and keyboard navigation.
- Application and quieter System views, plus favorites and recents.
- Service details with sanitized health signals, copy URL, launch, and Admin.
- Live summary, manual refresh, and explicit unavailable, malformed, offline,
  and stale states. Healthy status is withheld after 60 seconds without a
  successful status document.
- System/light/dark themes and comfortable/compact density stored locally.
- Installable standalone PWA with safe-area layout and local icons.
- Immediate theme-correct launch shell and schema-validated local projection
  hydration, followed by background refresh on launch and resume.
- iPhone thumb navigation, history/edge-swipe-compatible transient views,
  drag-to-dismiss details, session scroll restoration, and controlled updates.
- Scope-aware HTTPS launch links that leave the installed Portal for external
  service origins while preserving iOS Universal Link routing to native apps.
- A restrained, dependency-free Liquid Glass treatment using CSS translucency,
  specular highlights, native press feedback, and momentum scrolling, with
  solid-color fallbacks and reduced-motion support.
- Cached shell and last catalog; network-first status remains visibly stale
  when a cached response is the only available response.

The implementation decisions, physical-device release checklist, local
performance diagnostics, and the boundary between a pure PWA and a packaged
native container are documented in [`docs/IPHONE_PWA.md`](docs/IPHONE_PWA.md).

## Data interfaces

Production requests only:

```text
/.well-known/home-stack/catalog.json
/.well-known/home-stack/status.json
```

Both documents must be schema version 1 and pass the runtime Zod validator.
Checked-in JSON Schemas live in [`schemas/`](schemas/), with the complete
contract and security exclusions in [`docs/DATA_CONTRACT.md`](docs/DATA_CONTRACT.md).

Development fixtures live under `test/fixtures/`. A development-only Vite
middleware exposes them at `/__fixtures/*`; Vite never copies that directory to
`dist/`. They use reserved example domains and are not installation defaults.
Production has no fixture URL and no fallback service data.

Home Stack implements the exact same-origin routes as host-gated, sanitized,
read-only projections. If either route is unavailable, Portal intentionally
discloses the failure instead of loading sample infrastructure.

## Requirements

- Node.js 22.12 or newer
- npm 10 or newer
- Chromium installed through Playwright for browser tests

All dependency versions are exact in `package.json` and `package-lock.json`.

## Development

```bash
npm ci
npm run dev
```

The development server listens on `http://127.0.0.1:31520/` and uses the
dev-only v1 fixtures by default. To exercise honest endpoint failure locally:

```bash
VITE_USE_FIXTURES=false npm run dev
```

## Verification

```bash
npm test
npm run check
npm run test:browser
npm run check:schema-sync
```

`npm run check` runs unit/component/accessibility tests, TypeScript, the
production build, fixture-exclusion checks, PWA asset checks, and the 180 KiB
initial JavaScript gzip budget. Playwright runs desktop, 390px, and 430px
projects and covers discovery, search, favorites, details, malformed data,
validated instant startup, history dismissal, mobile thumb navigation, stale
recovery, offline caching, reduced motion, compositing guardrails, and
serious/critical axe violations.

Home Stack owns the canonical JSON Schemas under `schemas/portal/`; this repo
keeps consumer mirrors under `schemas/`. `npm run check:schema-sync` compares
the two sibling checkouts when Home Stack is available at `../home-stack`.
Portal's standalone CI validates its mirrors and fixtures without requiring a
second private checkout. CI runs unit, contract, build, distribution, and
browser checks; Dependabot proposes pinned npm and GitHub Actions updates
weekly.

## Deployment and rollback

The reviewed Home Stack integration, cutover checklist, live verification, and
recoverable rollback procedure are in
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Copy
`.home-stack.example.yaml` to the ignored `.home-stack.yaml` for local
descriptive metadata; the authoritative production route stays in Home Stack’s
registry and generated Caddyfile.

## Security

Portal is read-only. It contains no Admin credential or mutation transport,
does not proxy arbitrary targets, and never receives raw registry configuration
or Admin diagnostics. Exact projection exclusions are treated as contract
requirements and covered by Home Stack tests.

## License

MIT — see `LICENSE`.
