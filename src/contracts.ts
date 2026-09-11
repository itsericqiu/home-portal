import { z } from "zod";

const timestamp = z.iso.datetime({ offset: true });

export const catalogServiceSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  display_name: z.string().min(1),
  kind: z.string().min(1),
  url: z.url().nullable(),
  scope: z.enum(["tailnet", "local", "external"]),
  lifecycle: z.enum(["managed", "external", "static", "system"]),
  launchable: z.boolean()
}).strict();

export const catalogSchema = z.object({
  schema_version: z.literal(1),
  generated_at: timestamp,
  services: z.array(catalogServiceSchema)
    .refine(
      (services) => new Set(services.map((service) => service.id)).size === services.length,
      "Service IDs must be unique"
    )
}).strict();

export const serviceStateSchema = z.enum(["healthy", "degraded", "unavailable", "unknown"]);

export const statusServiceSchema = z.object({
  state: serviceStateSchema,
  checked_at: timestamp,
  signals: z.object({
    process: z.enum(["running", "scheduled", "stopped", "not_managed", "unknown"]).optional(),
    network: z.enum(["reachable", "unreachable", "not_checked", "unknown"]).optional(),
    route: z.enum(["ready", "missing", "not_applicable", "unknown"]).optional(),
    http: z.enum(["healthy", "unhealthy", "not_checked", "unknown"]).optional()
  }).strict()
}).strict();

export const statusSchema = z.object({
  schema_version: z.literal(1),
  generated_at: timestamp,
  overall_state: serviceStateSchema,
  services: z.record(z.string(), statusServiceSchema)
}).strict();

export type Catalog = z.infer<typeof catalogSchema>;
export type CatalogService = z.infer<typeof catalogServiceSchema>;
export type PortalStatus = z.infer<typeof statusSchema>;
export type ServiceStatus = z.infer<typeof statusServiceSchema>;
export type ServiceState = z.infer<typeof serviceStateSchema>;

export type SignalName = keyof ServiceStatus["signals"];
