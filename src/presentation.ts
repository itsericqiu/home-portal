import type { CatalogService } from "./contracts";

export type ServiceIcon =
  | "admin"
  | "agent"
  | "code"
  | "gateway"
  | "home"
  | "rotate"
  | "server"
  | "spark";

type PresentationOverride = {
  category?: string;
  description?: string;
  featured?: boolean;
  icon?: ServiceIcon;
  order?: number;
  tags?: string[];
};

const overrides: Record<string, PresentationOverride> = {
  hermes: {
    category: "Agents",
    description: "Personal AI agent, conversations, and automations.",
    featured: true,
    icon: "agent",
    order: 10,
    tags: ["ai", "assistant", "chat"]
  },
  openchamber: {
    category: "AI tools",
    description: "A focused web workspace for the central OpenCode server.",
    featured: true,
    icon: "spark",
    order: 20,
    tags: ["ai", "code", "workspace"]
  },
  admin: {
    category: "Control plane",
    description: "Inspect health, deployments, events, and managed services.",
    icon: "admin",
    order: 10,
    tags: ["health", "deploy", "control"]
  },
  opencode: {
    category: "Runtime",
    description: "Headless OpenCode backend serving the shared AI workspace.",
    icon: "code",
    order: 20
  },
  caddy: {
    category: "Networking",
    description: "Tailnet ingress, TLS termination, and service routing.",
    icon: "gateway",
    order: 30
  },
  "dev-gateway": {
    category: "Networking",
    description: "Development host routing for temporary local applications.",
    icon: "gateway",
    order: 40
  },
  logrotate: {
    category: "Maintenance",
    description: "Scheduled retention and rotation for Home Stack logs.",
    icon: "rotate",
    order: 50
  },
  portal: {
    category: "Home Stack",
    description: "This read-only directory and health surface.",
    icon: "home",
    order: 60
  }
};

const systemKinds = new Set(["backend", "control", "ingress", "scheduled", "system", "task"]);

export type PresentedService = CatalogService & {
  category: string;
  description: string;
  featured: boolean;
  icon: ServiceIcon;
  order: number;
  tags: string[];
  system: boolean;
};

function titleCase(value: string): string {
  return value
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function presentService(service: CatalogService): PresentedService {
  const override = overrides[service.id] ?? {};
  const system = !service.launchable || systemKinds.has(service.kind) || service.id === "portal";

  return {
    ...service,
    category: override.category ?? titleCase(service.kind || "Service"),
    description: override.description ?? `${service.display_name} is registered with Home Stack.`,
    featured: override.featured ?? false,
    icon: override.icon ?? (service.launchable ? "spark" : "server"),
    order: override.order ?? 100,
    tags: override.tags ?? [],
    system
  };
}

export function presentServices(services: CatalogService[]): PresentedService[] {
  return services
    .map(presentService)
    .sort((left, right) => left.order - right.order || left.display_name.localeCompare(right.display_name));
}

function fuzzyScore(haystack: string, needle: string): number | null {
  if (!needle) return 0;
  const direct = haystack.indexOf(needle);
  if (direct >= 0) return direct;

  let score = 0;
  let cursor = 0;
  for (const character of needle) {
    const index = haystack.indexOf(character, cursor);
    if (index < 0) return null;
    score += index - cursor + 1;
    cursor = index + 1;
  }
  return score + 20;
}

export function searchServices(services: PresentedService[], query: string): PresentedService[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return services;

  return services
    .map((service) => {
      const fields = [
        service.display_name,
        service.id,
        service.kind,
        service.category,
        service.scope,
        service.description,
        ...service.tags
      ].map((field) => field.toLowerCase());
      const scores = fields
        .map((field) => fuzzyScore(field, needle))
        .filter((score): score is number => score !== null);
      return { service, score: scores.length ? Math.min(...scores) : null };
    })
    .filter((result): result is { service: PresentedService; score: number } => result.score !== null)
    .sort((left, right) => left.score - right.score || left.service.order - right.service.order)
    .map(({ service }) => service);
}
