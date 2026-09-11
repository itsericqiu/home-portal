# Install Portal with Home Stack

Portal is a static consumer of Home Stack's sanitized catalog and status
projections. It does not need database credentials, Admin credentials, a
server-side runtime, or a second service registry.

## Compatibility

The installation must provide schema version 1 at these exact paths on the
Portal origin:

```text
/.well-known/home-stack/catalog.json
/.well-known/home-stack/status.json
```

Portal validates both responses at runtime. A missing, malformed, or
unsupported response is shown as an error; development fixtures are never used
in a production build.

Home Stack owns the canonical schemas under `schemas/portal/`. This repository
keeps consumer mirrors under `schemas/`. When the repositories are sibling
checkouts, verify compatibility with:

```bash
npm run check:schema-sync
```

## Build

Node.js 22.12 or newer and npm 10 or newer are required.

```bash
npm ci
npm run check
npm run build
```

The complete deployable application is written to `dist/`. Do not serve the
repository root, test fixtures, source maps from another directory, or
`node_modules/` as the Portal document root.

## Registry entry

Register the built `dist/` in your Home Stack profile (`profiles/<name>/services.yaml`)
as a static service. The entry **must be named `portal`**: Home Stack's engine
attaches the two projection routes to that service name and no other.

```yaml
  portal:
    display_name: "Portal"
    kind: "static"
    type: "static"
    subdomain: portal
    root: "~/github/home-portal/dist"
    health:
      http_url: "https://portal.<your-domain>/"
```

Then `hs deploy --preview`, `hs sync`, and Home Stack's documented reload
procedure. Nothing in this repository configures the hostname; it comes from
your Home Stack profile.

## Home Stack integration

In Home Stack, register Portal as a static, SPA-routed service whose root is
this checkout's `dist/` directory. The Home Stack integration must:

- serve the Portal application only from its selected Portal hostname;
- proxy only the two exact well-known projection paths to the sanitized,
  read-only handlers;
- keep Admin authentication and all mutation routes separate;
- include every registered service in the catalog projection;
- mark non-launchable services explicitly instead of inventing URLs; and
- expose only coarse status signals allowed by the v1 contract.

Because both documents are same-origin, no CORS configuration or Portal-held
credential is needed. The generated Home Stack Caddy configuration remains the
authority for routing and TLS.

After building Portal, follow Home Stack's own preview, sync, validation, and
service-reload procedure. Infrastructure changes should be reviewed in Home
Stack rather than copied into this repository.

## Admin discovery

Portal does not contain a configured Admin hostname. If the catalog includes a
launchable service with ID `admin`, Portal uses that service URL for its header,
footer, and detail links. If no launchable Admin service is published, those
links are omitted.

## Presentation customization

Known service descriptions, categories, icons, tags, and ordering live in
`src/presentation.ts` and `src/icons.tsx`. They are optional presentation
enhancements. A service absent from those files still appears using its
contract-provided display name and a generic icon.

Brand text, manifest colors, and local PWA icons can be customized in
`index.html`, `vite.config.ts`, and `public/icons/`. Avoid runtime icon CDNs so
the installed and offline experience remains self-contained.

## Production verification

Use HTTPS and verify:

- the Portal origin serves `dist/index.html`, `manifest.json`, and `sw.js`;
- both well-known documents return JSON with `schema_version: 1`;
- Admin links, if present, match the catalog rather than a frontend setting;
- an unknown registry service appears without a presentation override;
- invalid and stale data is disclosed;
- no development fixture name appears in `dist/`; and
- Admin credentials, actions, logs, paths, PIDs, upstreams, and secrets are
  absent from both projections.

The reusable verification commands and rollback procedure are documented in
`docs/DEPLOYMENT.md`.
