import { describe, expect, it } from "vitest";

import type { CatalogService } from "../src/contracts";
import { presentService, presentServices, searchServices } from "../src/presentation";

const unknownService: CatalogService = {
  id: "brand-new-service",
  display_name: "Brand New Service",
  kind: "worker",
  url: null,
  scope: "local",
  lifecycle: "external",
  launchable: false
};

describe("service presentation", () => {
  it("default-displays unknown registry services without requiring an override", () => {
    const presented = presentService(unknownService);
    expect(presented.display_name).toBe("Brand New Service");
    expect(presented.system).toBe(true);
    expect(presented.description).toContain("registered with Home Stack");
  });

  it("does not create a broken launch target for a headless service", () => {
    expect(presentService(unknownService).launchable).toBe(false);
  });

  it("supports fuzzy name and tag matching", () => {
    const services = presentServices([
      unknownService,
      { ...unknownService, id: "hermes", display_name: "Hermes Agent", kind: "agent", url: "https://hermes.home.example.com/", scope: "tailnet", lifecycle: "managed", launchable: true }
    ]);
    expect(searchServices(services, "hrms")[0]?.id).toBe("hermes");
    expect(searchServices(services, "assistant")[0]?.id).toBe("hermes");
  });
});
