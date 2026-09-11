import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

import catalogFixture from "./fixtures/catalog.v1.json";
import statusFixture from "./fixtures/status.v1.json";
import catalogJSONSchema from "../schemas/catalog.v1.schema.json";
import statusJSONSchema from "../schemas/status.v1.schema.json";
import { catalogSchema, statusSchema } from "../src/contracts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateCatalogJSON = ajv.compile(catalogJSONSchema);
const validateStatusJSON = ajv.compile(statusJSONSchema);

describe("portal v1 contracts", () => {
  it("accepts the checked-in catalog and status fixtures", () => {
    expect(catalogSchema.parse(catalogFixture).services).toHaveLength(9);
    expect(statusSchema.parse(statusFixture).services.hermes.state).toBe("healthy");
    expect(validateCatalogJSON(catalogFixture), JSON.stringify(validateCatalogJSON.errors)).toBe(true);
    expect(validateStatusJSON(statusFixture), JSON.stringify(validateStatusJSON.errors)).toBe(true);
  });

  it("rejects duplicate service identifiers", () => {
    const duplicate = {
      ...catalogFixture,
      services: [...catalogFixture.services, catalogFixture.services[0]]
    };
    expect(catalogSchema.safeParse(duplicate).success).toBe(false);
  });

  it("rejects unknown fields and unsupported schema versions", () => {
    expect(catalogSchema.safeParse({ ...catalogFixture, schema_version: 2 }).success).toBe(false);
    expect(statusSchema.safeParse({ ...statusFixture, secret: "must not pass" }).success).toBe(false);
  });

  it("rejects infrastructure details in the sanitized status projection", () => {
    const unsafe = structuredClone(statusFixture) as Record<string, unknown>;
    const services = unsafe.services as Record<string, Record<string, unknown>>;
    services.hermes.pid = "123";
    expect(statusSchema.safeParse(unsafe).success).toBe(false);
    expect(validateStatusJSON(unsafe)).toBe(false);
  });

  it("keeps runtime validators and canonical schema mirrors equally strict", () => {
    const unsafeCatalog = { ...catalogFixture, root: "/private/path" };
    const unsafeStatus = { ...statusFixture, action: "service.restart" };
    expect(catalogSchema.safeParse(unsafeCatalog).success).toBe(false);
    expect(statusSchema.safeParse(unsafeStatus).success).toBe(false);
    expect(validateCatalogJSON(unsafeCatalog)).toBe(false);
    expect(validateStatusJSON(unsafeStatus)).toBe(false);
  });
});
