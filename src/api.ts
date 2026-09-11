import type { ZodType } from "zod";

import { catalogSchema, statusSchema, type Catalog, type PortalStatus } from "./contracts";
import { catalogURL, statusURL } from "./config";

export class ProjectionError extends Error {
  constructor(
    message: string,
    readonly kind: "network" | "http" | "content" | "schema",
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "ProjectionError";
  }
}

async function fetchProjection<T>(url: string, schema: ZodType<T>, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal
    });
  } catch (error) {
    throw new ProjectionError("Home Stack could not be reached.", "network", error);
  }

  if (!response.ok) {
    throw new ProjectionError(`Home Stack returned HTTP ${response.status}.`, "http");
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new ProjectionError("Home Stack returned a non-JSON response.", "content");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new ProjectionError("Home Stack returned malformed JSON.", "content", error);
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    const issue = result.error.issues[0];
    const location = issue.path.length ? issue.path.join(".") : "document";
    throw new ProjectionError(`Home Stack data failed validation at ${location}.`, "schema", result.error);
  }

  return result.data;
}

export function loadCatalog(signal?: AbortSignal): Promise<Catalog> {
  return fetchProjection(catalogURL, catalogSchema, signal);
}

export function loadStatus(signal?: AbortSignal): Promise<PortalStatus> {
  return fetchProjection(statusURL, statusSchema, signal);
}
