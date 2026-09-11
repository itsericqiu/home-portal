import { afterEach, describe, expect, it, vi } from "vitest";

import catalogFixture from "./fixtures/catalog.v1.json";
import { loadCatalog, ProjectionError } from "../src/api";

afterEach(() => vi.unstubAllGlobals());

function response(body: string, contentType = "application/json", status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": contentType } });
}

describe("projection loading", () => {
  it("accepts a valid schema document", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(JSON.stringify(catalogFixture))));
    await expect(loadCatalog()).resolves.toMatchObject({ schema_version: 1 });
  });

  it("rejects SPA HTML instead of silently falling back", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("<!doctype html>", "text/html")));
    await expect(loadCatalog()).rejects.toMatchObject<Partial<ProjectionError>>({ kind: "content" });
  });

  it("reports malformed and schema-invalid data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response("{")));
    await expect(loadCatalog()).rejects.toMatchObject<Partial<ProjectionError>>({ kind: "content" });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(JSON.stringify({ services: [] }))));
    await expect(loadCatalog()).rejects.toMatchObject<Partial<ProjectionError>>({ kind: "schema" });
  });

  it("reports unavailable endpoints", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("missing", "text/plain", 404)));
    await expect(loadCatalog()).rejects.toMatchObject<Partial<ProjectionError>>({ kind: "http" });
  });
});
