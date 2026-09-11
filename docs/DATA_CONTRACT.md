# Home Stack Portal data contract

## Versioning

Catalog and status are independent schema-versioned JSON documents. Portal v2
supports only `schema_version: 1`; an unsupported or malformed document is a
visible error, never a reason to load fixtures.

The canonical machine-readable definitions are owned by Home Stack at
`schemas/portal/`. Consumer mirrors in this repository are:

- `schemas/catalog.v1.schema.json`
- `schemas/status.v1.schema.json`

The schema `$id` values are canonical identifiers owned by Home Stack; Portal
does not fetch those URLs at runtime. An installation should not rewrite the
namespace independently, because the mirrors must stay byte-equivalent to the
schema owner.

Home Stack owns generation, schema authority, and same-origin routing. Portal
owns mirrored JSON Schemas plus duplicate Zod validation at the trust boundary.
Ajv exercises the mirrors against fixtures, and `npm run check:schema-sync`
detects cross-repository drift when the sibling Home Stack checkout is present.

## Catalog v1

`GET /.well-known/home-stack/catalog.json`

```json
{
  "schema_version": 1,
  "generated_at": "2026-08-08T00:00:00Z",
  "services": [
    {
      "id": "hermes",
      "display_name": "Hermes Agent",
      "kind": "agent",
      "url": "https://hermes.home.example.com/",
      "scope": "tailnet",
      "lifecycle": "managed",
      "launchable": true
    }
  ]
}
```

The catalog is a projection of Home Stack’s sync-generated registry snapshot,
not the raw generated catalog file. Every snapshot service is included.
Concrete routed static/proxy/split services receive an HTTPS URL; wildcard,
headless, scheduled, and system-only services receive `url: null` and
`launchable: false`.

`generated_at` is the generated snapshot modification time, not a request-time
claim. Catalog responses may be privately cached for a short interval.

## Status v1

`GET /.well-known/home-stack/status.json`

```json
{
  "schema_version": 1,
  "generated_at": "2026-08-08T00:00:10Z",
  "overall_state": "healthy",
  "services": {
    "hermes": {
      "state": "healthy",
      "checked_at": "2026-08-08T00:00:10Z",
      "signals": {
        "process": "running",
        "network": "reachable",
        "route": "ready",
        "http": "healthy"
      }
    }
  }
}
```

State is one of `healthy`, `degraded`, `unavailable`, or `unknown`. Signal
values are deliberately coarse. Portal marks the entire status document stale
60 seconds after `generated_at`, when offline, or after a failed refresh with
cached data. A stale healthy result is rendered as stale/unknown.

Status is network-first and `private, no-store` at the origin. The PWA may keep
one last response solely for explicit offline/stale presentation.

## Security exclusions

Neither projection may include or encode:

- Admin credentials, authentication state, or mutation capability;
- environment variables, secrets, tokens, hashes, keys, or action bodies;
- upstreams, raw ports/targets, roots, working directories, binaries, args,
  plist paths, PIDs, exit codes, or process program paths;
- logs, stdout/stderr paths or contents, error details, incident explanations,
  action descriptors, deployment diffs, or arbitrary registry fields;
- Caddy Admin API data or raw loaded configuration.

Projection failure responses contain only a generic message and status code.
The two exact GET paths are public only through the Tailnet Portal origin. The
rest of Admin remains authenticated, and Caddy’s native Admin API remains
loopback-only.

## Compatibility policy

Adding optional fields requires schema and Portal validator updates. Removing
or changing existing fields, enum values, or semantics requires a new schema
version. Portal must continue default-displaying unknown service IDs; local
presentation metadata cannot become an allowlist.
