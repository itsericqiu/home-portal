# Agent Guidance

This repo is the rich personal portal for Home Stack.

## Core Boundary
- `home-portal` owns presentation: UI, navigation, directory views, search, categories, favorites, mobile/PWA polish, and client-side rendering.
- `home-stack` owns infrastructure: Caddy routing, launchd services, service registry, generated `catalog.json`/`status.json`, profiles, secrets policy, and admin/control-plane primitives.
- Do not move infrastructure authority into this repo.

## Interfaces With Home Stack
- Development fixtures: `test/fixtures/*.json`, served only by Vite middleware under `/__fixtures/`.
- Production catalog URL: `/.well-known/home-stack/catalog.json`.
- Production status URL: `/.well-known/home-stack/status.json`.
- Project-local deployment metadata: `.home-stack.yaml`.
- Home Stack implements and owns both versioned, sanitized production projections.

## Implementation Guidance
- Keep the app buildable as a static artifact in `dist/` unless there is a clear reason to add a server runtime.
- Prefer simple, direct client-side code until the portal needs more structure.
- Keep Home Stack URLs and interface paths centralized if they become reused.
- Avoid adding secrets, tokens, private keys, machine logs, or generated runtime state.
- Do not edit `home-stack` from this repo unless explicitly asked; coordinate route/interface changes in the `home-stack` repo.

## Admin Boundary
- Admin/control-plane UX should remain separate from the personal portal. Discover its launch URL from the catalog service with ID `admin`; do not hardcode an installation hostname.
- This repo may link to admin surfaces or display read-only status when provided.
- This repo should not execute privileged actions or arbitrary shell commands.

## Validation
- Run `npm run check` after functional changes.
- If responsive or interaction behavior changes, also run `npm run test:browser`.
- If catalog rendering changes, test the v1 fixtures under `test/fixtures/`; production must never load them.

## Verification & Development

### Setup and Workflow
- **Install dependencies**: `npm install`
- **Development server**: `npm run dev` — starts local dev server at `http://127.0.0.1:31520/`
- **Production build**: `npm run build` — writes static output to `dist/`

### Catalog Fallback Behavior
- **Development fixtures**: Vite serves checked-in v1 fixtures from `test/fixtures/`; they are excluded from `dist/`.
- **Production source**: Home Stack serves the sanitized catalog at `/.well-known/home-stack/catalog.json`.
- **Failure behavior**: production discloses unavailable or malformed data and never substitutes sample infrastructure.
- **Build fallback**: Home Stack may serve `portable/home-stack/portal-www` only when `dist/` does not exist.

### Interface Implementation Status

- **Catalog**: implemented by Home Stack as a schema-v1 sanitized projection.
- **Status**: implemented by Home Stack as a schema-v1 sanitized live projection.
- **Admin/Control Plane**: implemented separately by Home Stack and remains authenticated; Portal only links to the catalog-provided Admin URL.

### Free-Model Implementation Guidelines
Implementation using free-model or similar approaches is acceptable **only when**:
- **Scope is clearly defined** — specific features or components are outlined
- **Allowed files are listed** — which files may be created or modified is explicit
- **Acceptance criteria are documented** — measurable conditions for completion are stated

Avoid open-ended free-model implementation without boundaries. Document the scope, file boundaries, and acceptance criteria before proceeding.
