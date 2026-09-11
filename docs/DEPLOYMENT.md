# Portal v2 deployment and rollback

These steps preserve Home Stack as the infrastructure authority and keep
deployment recoverable. Inspect both worktrees immediately before every
integration or deployment action and never reset, overwrite, or broadly
restore unrelated work.

## Preflight

From `home-portal`:

```bash
npm ci
npm run check
npm run test:browser
npm run check:schema-sync
```

Confirm the build contains `manifest.json`, `sw.js`, local PNG icons,
and no fixture names or `/__fixtures/` URL. `npm run check:dist` automates these
checks and enforces the 180 KiB initial JavaScript gzip budget.

From `home-stack`, after reviewing the current diff:

```bash
make test
CLOUDFLARE_API_TOKEN=dummy portable/home-stack/bin/caddy-cloudflare \
  adapt --config portable/home-stack/Caddyfile
portable/home-stack/scripts/hs deploy --preview
```

The reviewed Portal-integration diff must remain limited to the versioned
schemas, sanitized Admin GET handlers, their tests/docs, and exact Portal-host
well-known routing. It must not expose the raw catalog, Admin API, Caddy Admin
API, or new mutation paths. If a coordinated release also includes another
approved service change, review and verify that scope separately.

## Recoverable cutover

1. Record both repository commit IDs and `git status --short` output without
   modifying either worktree.
2. Preserve the currently served Portal build outside `dist/`, for example as
   a timestamped directory under `/tmp`, before replacing it.
3. Run `npm run build` in `home-portal`.
4. Build the reviewed Home Stack Admin binary in
   `portable/home-stack/admin/`.
5. Run `portable/home-stack/scripts/hs deploy --preview` again and review only
   the expected Caddy projection route change.
6. Run `portable/home-stack/scripts/hs sync`; validate its generated Caddyfile
   before or as part of the established reload workflow.
7. Restart only the Home Stack Admin service so the new read-only handlers are
   active. Do not restart other services for a static Portal cutover.

Routing and Admin changes require Home Stack’s documented infrastructure
review. No Portal deployment step reads or prints secrets.

## Live verification

Set the origins for the Home Stack profile being verified:

```bash
PORTAL_ORIGIN=https://portal.home.example.com
ADMIN_ORIGIN=https://admin.home.example.com
```

Verify the catalog and status content types, HTTP status, schema version, and
security exclusions at the Portal origin. Then verify:

- `$PORTAL_ORIGIN` loads without a sample fallback.
- Every launch URL, including Hermes when registered, comes from catalog data
  and uses the installation's configured domain.
- Metrics, Media Server, Future API, and Home Assistant are absent.
- OpenChamber is launchable; OpenCode, Caddy, Log Rotate, and Dev Gateway are in
  System without broken targets.
- Status timestamps and stale behavior are honest.
- Search, favorites, details, theme, density, focus, and touch targets work.
- Manifest, service worker, icons, standalone safe areas, and offline shell/
  catalog work on an iPhone-sized viewport.
- `$ADMIN_ORIGIN` remains authenticated and contains the privileged controls;
  Portal has no mutation request or credential.
- Portal, Admin, Caddy, and every other registered service remain healthy after
  cutover.

Inspect the live UI in a desktop viewport and at both 390px and 430px. Confirm
`document.body.scrollWidth === document.documentElement.clientWidth` at mobile
sizes.

## Rollback

If the Portal UI fails but Caddy/Admin are healthy, move the failed `dist/`
aside and restore the preserved previous build directory atomically, then
reload the Portal page. This rollback does not touch service state.

If a projection handler or route fails, revert only the responsible committed
Home Stack change, rebuild Admin, run `hs sync`, validate the generated
Caddyfile, restart Admin, and recheck existing services. Do not reset the Home
Stack worktree or overwrite unrelated service changes.

Retain the failed build and captured non-secret validation output until the
cause is understood. A rollback is complete only when the previous Portal is
served and Admin, Hermes, OpenCode, OpenChamber, and Caddy health are unchanged.
