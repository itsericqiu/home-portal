import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axe from "axe-core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import catalogFixture from "./fixtures/catalog.v1.json";
import statusFixture from "./fixtures/status.v1.json";
import App from "../src/App";
import { cacheCatalog, cacheStatus } from "../src/projection-cache";
import { catalogSchema, statusSchema } from "../src/contracts";

afterEach(() => vi.unstubAllGlobals());

function freshStatus() {
  const now = new Date().toISOString();
  return {
    ...statusFixture,
    generated_at: now,
    services: Object.fromEntries(
      Object.entries(statusFixture.services).map(([id, service]) => [id, { ...service, checked_at: now }])
    )
  };
}

function json(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
}

function renderPortal(options: { catalog?: unknown; status?: unknown } = {}) {
  const catalog = options.catalog ?? { ...catalogFixture, generated_at: new Date().toISOString() };
  const status = options.status ?? freshStatus();
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    return Promise.resolve(json(url.includes("catalog") ? catalog : status));
  }));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>);
}

describe("Portal v2", () => {
  it("renders validated saved projections before a network refresh finishes", () => {
    cacheCatalog(catalogSchema.parse(catalogFixture));
    cacheStatus(statusSchema.parse(statusFixture));
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>);
    expect(screen.getByRole("heading", { name: "Hermes Agent" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Finding your services…" })).not.toBeInTheDocument();
  });

  it("discovers Hermes and unknown services from catalog data", async () => {
    renderPortal();
    expect(await screen.findByRole("heading", { name: "Hermes Agent" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Open Hermes Agent" })).toHaveAttribute("href", "https://hermes.home.example.com/");
    expect(screen.getByRole("link", { name: "Admin", exact: true })).toHaveAttribute("href", "https://admin.home.example.com/");
    expect(screen.getByRole("heading", { name: "Unknown Tool" })).toBeVisible();
    expect(screen.queryByText("Future API")).not.toBeInTheDocument();
    expect(screen.queryByText("Media Server")).not.toBeInTheDocument();
  });

  it("filters services, opens details, and persists favorites", async () => {
    const user = userEvent.setup();
    renderPortal();
    await screen.findByRole("heading", { name: "Hermes Agent" });

    await user.type(screen.getByPlaceholderText("Filter services…"), "hrms");
    expect(screen.getByRole("heading", { name: "Hermes Agent" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "OpenChamber" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add Hermes Agent to favorites" }));
    expect(JSON.parse(window.localStorage.getItem("home-portal.preferences.v2") ?? "{}").favorites).toContain("hermes");

    const detailsButton = screen.getByRole("button", { name: "View Hermes Agent details" });
    await user.click(detailsButton);
    expect(screen.getByRole("dialog", { name: "Hermes Agent" })).toBeVisible();
    expect(screen.getByText("https://hermes.home.example.com/")).toBeVisible();
    expect(screen.getByRole("link", { name: "View in Admin" })).toHaveAttribute("href", "https://admin.home.example.com/#service-hermes");
    await user.click(screen.getByRole("button", { name: "Close details" }));
    await waitFor(() => expect(detailsButton).toHaveFocus());
  });

  it("supports the command shortcut and keyboard launch results", async () => {
    const user = userEvent.setup();
    renderPortal();
    await screen.findByRole("heading", { name: "Hermes Agent" });
    await user.keyboard("{Meta>}k{/Meta}");
    const palette = screen.getByRole("dialog", { name: "Search and launch services" });
    expect(palette).toBeVisible();
    await user.type(screen.getByPlaceholderText("Search apps, services, and tags…"), "Hermes");
    const launchOption = screen.getByRole("option", { name: /Hermes Agent/ });
    expect(launchOption).toHaveAttribute("href", "https://hermes.home.example.com/");
    const activateLink = vi.spyOn(launchOption, "click").mockImplementation(() => undefined);
    await user.keyboard("{Enter}");
    expect(activateLink).toHaveBeenCalledOnce();
  });

  it("omits Admin navigation when the registry has no launchable Admin service", async () => {
    const catalog = {
      ...catalogFixture,
      services: catalogFixture.services.filter((service) => service.id !== "admin")
    };
    renderPortal({ catalog });
    expect(await screen.findByRole("heading", { name: "Hermes Agent" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Admin", exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Admin", exact: true })).not.toBeInTheDocument();
  });

  it("withholds healthy status when cached status is stale", async () => {
    const oldStatus = { ...freshStatus(), generated_at: "2026-01-01T00:00:00Z" };
    renderPortal({ status: oldStatus });
    expect(await screen.findByText("Status is stale.")).toBeVisible();
    expect(screen.getAllByText("Stale").length).toBeGreaterThan(0);
  });

  it("renders without automated accessibility violations", async () => {
    const { container } = renderPortal();
    await screen.findByRole("heading", { name: "Hermes Agent" });
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations).toEqual([]);
  });

  it("shows an honest error instead of fixtures when catalog validation fails", async () => {
    renderPortal({ catalog: { services: [] } });
    expect(await screen.findByRole("heading", { name: "Your services can’t be shown yet." }, { timeout: 4_000 })).toBeVisible();
    expect(screen.getByText("Portal does not substitute sample data in production.")).toBeVisible();
    await waitFor(() => expect(screen.queryByText("Hermes Agent")).not.toBeInTheDocument());
  });
});
