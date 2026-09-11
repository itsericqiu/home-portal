import { describe, expect, it, vi } from "vitest";

import catalogFixture from "./fixtures/catalog.v1.json";
import statusFixture from "./fixtures/status.v1.json";
import { catalogSchema, statusSchema } from "../src/contracts";
import { cacheCatalog, cacheStatus, readCachedCatalog, readCachedStatus } from "../src/projection-cache";

describe("validated projection startup cache", () => {
  it("round-trips catalog and status documents that satisfy the contracts", () => {
    const catalog = catalogSchema.parse(catalogFixture);
    const status = statusSchema.parse(statusFixture);
    cacheCatalog(catalog);
    cacheStatus(status);
    expect(readCachedCatalog()).toEqual(catalog);
    expect(readCachedStatus()).toEqual(status);
  });

  it("removes malformed data instead of rendering it", () => {
    localStorage.setItem("home-portal.catalog.v1", JSON.stringify({ services: [{ id: "fiction" }] }));
    localStorage.setItem("home-portal.status.v1", "not-json");
    expect(readCachedCatalog()).toBeUndefined();
    expect(readCachedStatus()).toBeUndefined();
    expect(localStorage.getItem("home-portal.catalog.v1")).toBeNull();
    expect(localStorage.getItem("home-portal.status.v1")).toBeNull();
  });

  it("does not block startup when browser storage is unavailable", () => {
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });
    const remove = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });

    expect(readCachedCatalog()).toBeUndefined();
    expect(readCachedStatus()).toBeUndefined();

    read.mockRestore();
    remove.mockRestore();
  });
});
