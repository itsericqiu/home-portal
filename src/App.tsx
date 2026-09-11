import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";

import { loadCatalog, loadStatus, ProjectionError } from "./api";
import { STATUS_STALE_AFTER_MS } from "./config";
import type { ServiceState, ServiceStatus, SignalName } from "./contracts";
import {
  ArrowIcon,
  CloseIcon,
  CopyIcon,
  ExternalIcon,
  InfoIcon,
  RefreshIcon,
  SearchIcon,
  ServiceGlyph,
  StarIcon,
  SunIcon
} from "./icons";
import { presentServices, searchServices, type PresentedService } from "./presentation";
import { cacheCatalog, cacheStatus, readCachedCatalog, readCachedStatus } from "./projection-cache";
import {
  readPortalSession,
  usePreferences,
  writePortalSession,
  type DensityPreference,
  type ThemePreference,
  type ViewPreference
} from "./storage";

type ViewFilter = ViewPreference;
type OverlayHistoryState = { homePortalOverlay?: "palette" | "detail"; serviceId?: string };

const stateLabels: Record<ServiceState, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  unavailable: "Unavailable",
  unknown: "Unknown"
};

const signalLabels: Record<SignalName, string> = {
  process: "Process",
  network: "Network",
  route: "Route",
  http: "HTTP"
};

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);
  return online;
}

function useClock(interval = 5_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(timer);
  }, [interval]);
  return now;
}

function relativeTime(timestamp: string | undefined, now: number): string {
  if (!timestamp) return "Never";
  const seconds = Math.max(0, Math.round((now - new Date(timestamp).getTime()) / 1_000));
  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function errorMessage(error: unknown): string {
  if (error instanceof ProjectionError) return error.message;
  return "The Home Stack projection is unavailable.";
}

function serviceState(status: ServiceStatus | undefined): ServiceState {
  return status?.state ?? "unknown";
}

function trapDialogFocus(event: globalThis.KeyboardEvent, container: HTMLElement | null): void {
  if (event.key !== "Tab" || !container) return;
  const focusable = [...container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => element.getClientRects().length > 0);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function StateBadge({ state, stale = false }: { state: ServiceState; stale?: boolean }) {
  const displayedState = stale && state === "healthy" ? "unknown" : state;
  return (
    <span className={`state-badge state-${displayedState}`}>
      <span className="state-dot" aria-hidden="true" />
      {stale ? "Stale" : stateLabels[displayedState]}
    </span>
  );
}

function ServiceCard({
  service,
  status,
  stale,
  favorite,
  compact = false,
  onFavorite,
  onDetails,
  onLaunch
}: {
  service: PresentedService;
  status?: ServiceStatus;
  stale: boolean;
  favorite: boolean;
  compact?: boolean;
  onFavorite: () => void;
  onDetails: () => void;
  onLaunch: () => void;
}) {
  const launchable = service.launchable && Boolean(service.url);

  return (
    <article className={`service-card${compact ? " service-card-compact" : ""}`} data-service-id={service.id}>
      {launchable ? (
        <a
          className="card-launch-target"
          href={service.url ?? undefined}
          onClick={onLaunch}
          aria-label={`Open ${service.display_name}`}
        />
      ) : null}
      <div className="service-icon" aria-hidden="true">
        <ServiceGlyph name={service.icon} />
      </div>
      <div className="service-copy">
        <div className="service-title-line">
          <h3>{service.display_name}</h3>
          {launchable ? <ArrowIcon className="launch-arrow" /> : null}
        </div>
        {!compact ? <p>{service.description}</p> : null}
        <div className="service-meta">
          <StateBadge state={serviceState(status)} stale={stale} />
          <span>{service.category}</span>
          <span>{service.scope}</span>
        </div>
      </div>
      <div className="card-actions">
        <button
          className="icon-button"
          type="button"
          aria-label={`${favorite ? "Remove" : "Add"} ${service.display_name} ${favorite ? "from" : "to"} favorites`}
          aria-pressed={favorite}
          onClick={onFavorite}
        >
          <StarIcon filled={favorite} />
        </button>
        <button className="icon-button" type="button" aria-label={`View ${service.display_name} details`} onClick={onDetails}>
          <InfoIcon />
        </button>
      </div>
    </article>
  );
}

function ServiceGrid({
  services,
  statuses,
  stale,
  favorites,
  compact,
  onFavorite,
  onDetails,
  onLaunch
}: {
  services: PresentedService[];
  statuses: Record<string, ServiceStatus>;
  stale: boolean;
  favorites: string[];
  compact?: boolean;
  onFavorite: (id: string) => void;
  onDetails: (service: PresentedService) => void;
  onLaunch: (id: string) => void;
}) {
  return (
    <div className={`service-grid${compact ? " service-grid-system" : ""}`}>
      {services.map((service) => (
        <ServiceCard
          key={service.id}
          service={service}
          status={statuses[service.id]}
          stale={stale}
          favorite={favorites.includes(service.id)}
          compact={compact}
          onFavorite={() => onFavorite(service.id)}
          onDetails={() => onDetails(service)}
          onLaunch={() => onLaunch(service.id)}
        />
      ))}
    </div>
  );
}

function DetailSheet({
  service,
  status,
  stale,
  favorite,
  adminURL,
  onClose,
  onFavorite,
  onLaunch
}: {
  service: PresentedService;
  status?: ServiceStatus;
  stale: boolean;
  favorite: boolean;
  adminURL?: string;
  onClose: () => void;
  onFavorite: () => void;
  onLaunch: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const gestureRef = useRef<{ startY: number; startedAt: number } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      trapDialogFocus(event, sheetRef.current);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const copyURL = async () => {
    if (!service.url) return;
    await navigator.clipboard.writeText(service.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  };

  const beginDismiss = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    gestureRef.current = { startY: event.clientY, startedAt: performance.now() };
    event.currentTarget.setPointerCapture(event.pointerId);
    sheetRef.current?.classList.add("is-dragging");
  };

  const dragDismiss = (event: PointerEvent<HTMLDivElement>) => {
    if (!gestureRef.current || !sheetRef.current) return;
    const distance = Math.max(0, event.clientY - gestureRef.current.startY);
    sheetRef.current.style.setProperty("--sheet-drag", `${distance}px`);
  };

  const endDismiss = (event: PointerEvent<HTMLDivElement>) => {
    if (!gestureRef.current || !sheetRef.current) return;
    const distance = Math.max(0, event.clientY - gestureRef.current.startY);
    const velocity = distance / Math.max(1, performance.now() - gestureRef.current.startedAt);
    gestureRef.current = null;
    sheetRef.current.classList.remove("is-dragging");
    sheetRef.current.style.removeProperty("--sheet-drag");
    if (distance > 88 || velocity > 0.65) onClose();
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={sheetRef} className="detail-sheet" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div
          className="sheet-handle"
          aria-hidden="true"
          onPointerDown={beginDismiss}
          onPointerMove={dragDismiss}
          onPointerUp={endDismiss}
          onPointerCancel={endDismiss}
        />
        <header className="detail-header">
          <div className="service-icon service-icon-large" aria-hidden="true"><ServiceGlyph name={service.icon} /></div>
          <div>
            <span className="eyebrow">{service.category}</span>
            <h2 id="detail-title">{service.display_name}</h2>
          </div>
          <button ref={closeRef} className="icon-button close-button" type="button" aria-label="Close details" onClick={onClose}><CloseIcon /></button>
        </header>

        <p className="detail-description">{service.description}</p>
        <div className="detail-status">
          <StateBadge state={serviceState(status)} stale={stale} />
          <span>{stale ? "Live health has expired" : `Checked ${relativeTime(status?.checked_at, Date.now())}`}</span>
        </div>

        <dl className="detail-facts">
          <div><dt>Service ID</dt><dd>{service.id}</dd></div>
          <div><dt>Scope</dt><dd>{service.scope}</dd></div>
          <div><dt>Lifecycle</dt><dd>{service.lifecycle}</dd></div>
          <div><dt>Kind</dt><dd>{service.kind}</dd></div>
        </dl>

        <div className="signal-list" aria-label="Health signals">
          {(Object.entries(status?.signals ?? {}) as [SignalName, string][]).map(([name, value]) => (
            <div className="signal-row" key={name}>
              <span>{signalLabels[name]}</span>
              <strong>{value.replaceAll("_", " ")}</strong>
            </div>
          ))}
          {!status ? <p className="muted">No live signals are available for this service.</p> : null}
        </div>

        {service.url ? <p className="service-url">{service.url}</p> : <p className="muted">This service has no launch URL.</p>}
        <div className="detail-actions">
          {service.launchable && service.url ? (
            <a className="button button-primary" href={service.url} onClick={onLaunch}>Launch <ExternalIcon /></a>
          ) : null}
          {service.url ? <button className="button" type="button" onClick={copyURL}><CopyIcon /> {copied ? "Copied" : "Copy URL"}</button> : null}
          <button className="button" type="button" onClick={onFavorite}><StarIcon filled={favorite} /> {favorite ? "Favorited" : "Favorite"}</button>
          {adminURL ? <a className="button" href={`${adminURL}#service-${encodeURIComponent(service.id)}`}>View in Admin <ExternalIcon /></a> : null}
        </div>
      </section>
    </div>
  );
}

function CommandPalette({
  services,
  onClose,
  onDetails,
  onLaunch
}: {
  services: PresentedService[];
  onClose: () => void;
  onDetails: (service: PresentedService) => void;
  onLaunch: (service: PresentedService) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLElement>(null);
  const results = useMemo(() => searchServices(services, query).slice(0, 10), [query, services]);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    const keepFocus = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      trapDialogFocus(event, paletteRef.current);
    };
    document.addEventListener("keydown", keepFocus);
    return () => document.removeEventListener("keydown", keepFocus);
  }, [onClose]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && results[active]) {
      event.preventDefault();
      document.getElementById(`command-${results[active].id}`)?.click();
    }
  };

  return (
    <div className="palette-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={paletteRef} className="command-palette" role="dialog" aria-modal="true" aria-label="Search and launch services">
        <label className="palette-search">
          <SearchIcon />
          <span className="sr-only">Search services</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search apps, services, and tags…"
            role="combobox"
            aria-controls="command-results"
            aria-expanded="true"
            aria-activedescendant={results[active] ? `command-${results[active].id}` : undefined}
            autoComplete="off"
          />
          <kbd>esc</kbd>
        </label>
        <div id="command-results" className="palette-results" role="listbox">
          {results.map((service, index) => {
            const content = <>
              <span className="palette-icon"><ServiceGlyph name={service.icon} /></span>
              <span><strong>{service.display_name}</strong><small>{service.category} · {service.scope}</small></span>
              {service.launchable ? <ArrowIcon /> : <InfoIcon />}
            </>;
            const optionProps = {
              id: `command-${service.id}`,
              className: index === active ? "active" : "",
              role: "option",
              "aria-selected": index === active,
              onMouseEnter: () => setActive(index)
            } as const;
            return service.launchable && service.url ? (
              <a key={service.id} {...optionProps} href={service.url} onClick={() => onLaunch(service)}>{content}</a>
            ) : (
              <button key={service.id} {...optionProps} type="button" onClick={() => onDetails(service)}>{content}</button>
            );
          })}
          {!results.length ? <p className="palette-empty">No services match “{query}”.</p> : null}
        </div>
        <footer className="palette-help"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span></footer>
      </section>
    </div>
  );
}

export default function App() {
  const online = useOnline();
  const now = useClock();
  const { preferences, setPreferences, toggleFavorite, recordRecent } = usePreferences();
  const restoredSession = useRef(readPortalSession()).current;
  const [query, setQuery] = useState(restoredSession.query);
  const [view, setView] = useState<ViewFilter>(restoredSession.view);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [detailService, setDetailService] = useState<PresentedService | null>(null);
  const [updateReady, setUpdateReady] = useState(() => document.documentElement.dataset.updateReady === "true");
  const searchRef = useRef<HTMLInputElement>(null);
  const directoryRef = useRef<HTMLElement>(null);
  const restoredScroll = useRef(false);
  const lastFocused = useRef<HTMLElement | null>(null);
  const scrollFrame = useRef<number | null>(null);
  const cachedCatalog = useRef(readCachedCatalog()).current;
  const cachedStatus = useRef(readCachedStatus()).current;

  const catalogQuery = useQuery({
    queryKey: ["catalog"],
    queryFn: async ({ signal }) => {
      const catalog = await loadCatalog(signal);
      cacheCatalog(catalog);
      return catalog;
    },
    initialData: cachedCatalog,
    initialDataUpdatedAt: cachedCatalog ? 0 : undefined,
    staleTime: 5 * 60_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 3_000)
  });
  const statusQuery = useQuery({
    queryKey: ["status"],
    queryFn: async ({ signal }) => {
      const status = await loadStatus(signal);
      cacheStatus(status);
      return status;
    },
    initialData: cachedStatus,
    initialDataUpdatedAt: cachedStatus ? 0 : undefined,
    enabled: Boolean(catalogQuery.data),
    refetchInterval: 30_000,
    staleTime: 20_000,
    retry: 1,
    retryDelay: 500
  });

  const services = useMemo(() => presentServices(catalogQuery.data?.services ?? []), [catalogQuery.data]);
  const adminURL = services.find((service) => service.id === "admin" && service.launchable && service.url)?.url ?? undefined;
  const statuses = statusQuery.data?.services ?? {};
  const statusAge = statusQuery.data ? now - new Date(statusQuery.data.generated_at).getTime() : Number.POSITIVE_INFINITY;
  const statusStale = !online || statusAge > STATUS_STALE_AFTER_MS || (statusQuery.isError && Boolean(statusQuery.data));
  const filtered = useMemo(() => {
    const searched = searchServices(services, query);
    if (view === "applications") return searched.filter((service) => !service.system);
    if (view === "system") return searched.filter((service) => service.system);
    return searched;
  }, [query, services, view]);
  const apps = filtered.filter((service) => !service.system);
  const system = filtered.filter((service) => service.system);
  const favorites = services.filter((service) => preferences.favorites.includes(service.id));
  const recents = preferences.recents
    .map((id) => services.find((service) => service.id === id))
    .filter((service): service is PresentedService => Boolean(service));

  const counts = useMemo(() => {
    const initial: Record<ServiceState, number> = { healthy: 0, degraded: 0, unavailable: 0, unknown: 0 };
    for (const service of services) initial[serviceState(statuses[service.id])] += 1;
    return initial;
  }, [services, statuses]);

  const restoreFocus = useCallback(() => {
    const target = lastFocused.current;
    lastFocused.current = null;
    window.setTimeout(() => target?.focus({ preventScroll: true }), 0);
  }, []);
  const clearOverlay = useCallback(() => {
    setPaletteOpen(false);
    setDetailService(null);
    restoreFocus();
  }, [restoreFocus]);
  const closeOverlay = useCallback(() => {
    const state = window.history.state as OverlayHistoryState | null;
    clearOverlay();
    if (state?.homePortalOverlay) {
      window.history.back();
    } else if (window.location.hash === "#search" || window.location.hash.startsWith("#service/")) {
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
    }
  }, [clearOverlay]);
  const openPalette = useCallback(() => {
    if (paletteOpen) return;
    lastFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.history.pushState({ homePortalOverlay: "palette" } satisfies OverlayHistoryState, "", "#search");
    setDetailService(null);
    setPaletteOpen(true);
  }, [paletteOpen]);
  const openDetails = useCallback((service: PresentedService, replace = false) => {
    // Replacing the palette with details is one overlay journey. Preserve the
    // element that opened the palette so closing details has a live target.
    if (!replace) {
      lastFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    const method = replace ? "replaceState" : "pushState";
    window.history[method]({ homePortalOverlay: "detail", serviceId: service.id } satisfies OverlayHistoryState, "", `#service/${encodeURIComponent(service.id)}`);
    setPaletteOpen(false);
    setDetailService(service);
  }, []);
  const launch = useCallback((id: string) => recordRecent(id), [recordRecent]);
  const launchFromPalette = useCallback((service: PresentedService) => recordRecent(service.id), [recordRecent]);

  useEffect(() => {
    const syncOverlay = () => {
      const state = window.history.state as OverlayHistoryState | null;
      if (state?.homePortalOverlay === "palette" || window.location.hash === "#search") {
        setDetailService(null);
        setPaletteOpen(true);
        return;
      }
      const serviceId = state?.serviceId ?? (window.location.hash.startsWith("#service/") ? decodeURIComponent(window.location.hash.slice(9)) : undefined);
      if (serviceId) {
        setPaletteOpen(false);
        setDetailService(services.find((service) => service.id === serviceId) ?? null);
        return;
      }
      clearOverlay();
    };
    syncOverlay();
    window.addEventListener("popstate", syncOverlay);
    return () => window.removeEventListener("popstate", syncOverlay);
  }, [clearOverlay, services]);

  useEffect(() => {
    const markReady = () => setUpdateReady(true);
    window.addEventListener("portal:update-ready", markReady);
    return () => window.removeEventListener("portal:update-ready", markReady);
  }, []);

  useEffect(() => {
    if (!paletteOpen && !detailService) return;
    const previousOverflow = document.body.style.overflow;
    const background = [...document.querySelectorAll<HTMLElement>(
      ".app-shell > :not(.modal-backdrop):not(.palette-backdrop)"
    )];
    const priorInert = background.map((element) => element.inert);
    document.body.style.overflow = "hidden";
    background.forEach((element) => { element.inert = true; });
    return () => {
      document.body.style.overflow = previousOverflow;
      background.forEach((element, index) => { element.inert = priorInert[index]; });
    };
  }, [detailService, paletteOpen]);

  useEffect(() => {
    if (!("scrollRestoration" in window.history)) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useEffect(() => {
    const saveSession = () => writePortalSession({ view, query, scrollY: window.scrollY });
    const saveScroll = () => {
      if (scrollFrame.current !== null) return;
      scrollFrame.current = window.requestAnimationFrame(() => {
        scrollFrame.current = null;
        saveSession();
      });
    };
    saveSession();
    window.addEventListener("scroll", saveScroll, { passive: true });
    window.addEventListener("pagehide", saveSession);
    return () => {
      window.removeEventListener("scroll", saveScroll);
      window.removeEventListener("pagehide", saveSession);
      if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current);
    };
  }, [query, view]);

  useEffect(() => {
    if (!services.length || restoredScroll.current) return;
    restoredScroll.current = true;
    window.requestAnimationFrame(() => window.scrollTo(0, restoredSession.scrollY));
    performance.mark("portal-content-ready");
    try {
      performance.measure("portal-startup", "portal-script-start", "portal-content-ready");
    } catch {
      // Tests and older browsers may not have the initial script mark.
    }
  }, [restoredSession.scrollY, services.length]);

  useEffect(() => {
    const refreshOnResume = () => {
      if (document.visibilityState !== "visible") return;
      if (catalogQuery.isStale) void catalogQuery.refetch();
      void statusQuery.refetch();
    };
    document.addEventListener("visibilitychange", refreshOnResume);
    return () => document.removeEventListener("visibilitychange", refreshOnResume);
  }, [catalogQuery, statusQuery]);

  useEffect(() => {
    const shortcut = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches("input, textarea, select, [contenteditable=true]");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette();
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        openPalette();
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [openPalette]);

  const refresh = () => {
    void catalogQuery.refetch();
    void statusQuery.refetch();
  };

  if (catalogQuery.isPending) {
    return (
      <main className="center-state" aria-busy="true">
        <div className="brand-mark"><ServiceGlyph name="home" /></div>
        <p className="eyebrow">Home Stack</p>
        <h1>Finding your services…</h1>
        <div className="loading-bar" aria-hidden="true"><span /></div>
      </main>
    );
  }

  if (catalogQuery.isError && !catalogQuery.data) {
    return (
      <main className="center-state error-state">
        <div className="brand-mark"><ServiceGlyph name="gateway" /></div>
        <p className="eyebrow">Catalog unavailable</p>
        <h1>Your services can’t be shown yet.</h1>
        <p>{errorMessage(catalogQuery.error)}</p>
        <p className="muted">Portal does not substitute sample data in production.</p>
        <button className="button button-primary" type="button" onClick={() => void catalogQuery.refetch()}><RefreshIcon /> Try again</button>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Home Stack home">
          <span className="brand-mark"><ServiceGlyph name="home" /></span>
          <span><strong>Home Stack</strong><small>Private portal</small></span>
        </a>
        <div className="topbar-actions">
          <span className={`connection ${online ? "is-online" : "is-offline"}`}><span aria-hidden="true" />{online ? "Connected" : "Offline"}</span>
          <button className="icon-button" type="button" aria-label="Refresh catalog and status" onClick={refresh} disabled={catalogQuery.isFetching || statusQuery.isFetching}>
            <RefreshIcon className={catalogQuery.isFetching || statusQuery.isFetching ? "spinning" : ""} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label={`Theme: ${preferences.theme}. Change theme`}
            onClick={() => {
              const themes: ThemePreference[] = ["system", "light", "dark"];
              setPreferences((current) => ({ ...current, theme: themes[(themes.indexOf(current.theme) + 1) % themes.length] }));
            }}
          ><SunIcon /></button>
          {adminURL ? <a className="button admin-button" href={adminURL}>Admin <ExternalIcon /></a> : null}
        </div>
      </header>

      {!online ? <div className="notice notice-offline" role="status"><strong>You’re offline.</strong> Showing the last catalog available on this device; live health may be out of date.</div> : null}
      {online && catalogQuery.isError && catalogQuery.data ? <div className="notice notice-warning" role="status"><strong>Catalog refresh failed.</strong> Showing the last validated catalog saved on this device. <button type="button" onClick={() => void catalogQuery.refetch()}>Retry</button></div> : null}
      {online && statusQuery.isError ? <div className="notice notice-warning" role="status"><strong>Live status is unavailable.</strong> {errorMessage(statusQuery.error)} <button type="button" onClick={() => void statusQuery.refetch()}>Retry</button></div> : null}
      {online && statusStale && statusQuery.data ? <div className="notice notice-warning" role="status"><strong>Status is stale.</strong> Last successful check was {relativeTime(statusQuery.data.generated_at, now)}. Healthy indicators are withheld until refresh.</div> : null}
      {updateReady ? <div className="notice notice-update" role="status"><strong>A Portal update is ready.</strong> Apply it when convenient. <button type="button" onClick={() => window.dispatchEvent(new Event("portal:apply-update"))}>Update now</button></div> : null}

      <main id="main-content" className="main-content">
        <section className="intro" aria-labelledby="portal-title">
          <div>
            <p className="eyebrow">At home, everywhere</p>
            <h1 id="portal-title">Everything in its place.</h1>
            <p>Launch the apps you use, and see the systems keeping them ready.</p>
          </div>
          <dl className="refresh-meta">
            <div><dt>Catalog</dt><dd>{relativeTime(catalogQuery.data.generated_at, now)}</dd></div>
            <div><dt>Status</dt><dd>{statusQuery.data ? relativeTime(statusQuery.data.generated_at, now) : "Unavailable"}</dd></div>
          </dl>
        </section>

        <button className="command-trigger" type="button" onClick={openPalette}>
          <SearchIcon />
          <span>Search apps, services, and tags…</span>
          <kbd>⌘ K</kbd>
        </button>

        <section className="summary" aria-labelledby="summary-title">
          <div className="summary-heading">
            <div><p className="eyebrow">Live overview</p><h2 id="summary-title">Stack at a glance</h2></div>
            <StateBadge state={statusQuery.data?.overall_state ?? "unknown"} stale={statusStale} />
          </div>
          <div className="summary-grid">
            {(["healthy", "degraded", "unavailable", "unknown"] as ServiceState[]).map((state) => (
              <div key={state} className={`summary-stat state-${state}`}><strong>{counts[state]}</strong><span>{stateLabels[state]}</span></div>
            ))}
          </div>
        </section>

        {favorites.length && !query ? (
          <section className="service-section" aria-labelledby="favorites-title">
            <div className="section-heading"><div><p className="eyebrow">Pinned</p><h2 id="favorites-title">Favorites</h2></div><span>{favorites.length}</span></div>
            <ServiceGrid services={favorites} statuses={statuses} stale={statusStale} favorites={preferences.favorites} onFavorite={toggleFavorite} onDetails={openDetails} onLaunch={launch} />
          </section>
        ) : null}

        {recents.length && !query ? (
          <section className="service-section" aria-labelledby="recent-title">
            <div className="section-heading"><div><p className="eyebrow">Picked up lately</p><h2 id="recent-title">Recent</h2></div><span>{recents.length}</span></div>
            <ServiceGrid services={recents.slice(0, 4)} statuses={statuses} stale={statusStale} favorites={preferences.favorites} compact onFavorite={toggleFavorite} onDetails={openDetails} onLaunch={launch} />
          </section>
        ) : null}

        <section ref={directoryRef} className="directory" aria-labelledby="directory-title">
          <div className="section-heading directory-heading">
            <div><p className="eyebrow">Directory</p><h2 id="directory-title">Services</h2></div>
            <div className="density-control" aria-label="Display density">
              {(["comfortable", "compact"] as DensityPreference[]).map((density) => <button key={density} type="button" aria-pressed={preferences.density === density} onClick={() => setPreferences((current) => ({ ...current, density }))}>{density}</button>)}
            </div>
          </div>
          <div className="directory-controls">
            <label className="inline-search"><SearchIcon /><span className="sr-only">Filter services</span><input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter services…" /></label>
            <div className="segmented" aria-label="Service type">
              {(["all", "applications", "system"] as ViewFilter[]).map((filter) => <button key={filter} type="button" aria-pressed={view === filter} onClick={() => setView(filter)}>{filter}</button>)}
            </div>
          </div>

          {apps.length ? (
            <section className="service-section nested" aria-labelledby="applications-title">
              <div className="section-heading"><h2 id="applications-title">Applications</h2><span>{apps.length}</span></div>
              <ServiceGrid services={apps} statuses={statuses} stale={statusStale} favorites={preferences.favorites} onFavorite={toggleFavorite} onDetails={openDetails} onLaunch={launch} />
            </section>
          ) : null}
          {system.length ? (
            <section className="service-section nested system-section" aria-labelledby="system-title">
              <div className="section-heading"><div><h2 id="system-title">System</h2><p>Infrastructure and headless services</p></div><span>{system.length}</span></div>
              <ServiceGrid services={system} statuses={statuses} stale={statusStale} favorites={preferences.favorites} compact onFavorite={toggleFavorite} onDetails={openDetails} onLaunch={launch} />
            </section>
          ) : null}
          {!filtered.length ? <div className="empty-state"><SearchIcon /><h3>No services found</h3><p>Try a different name, category, tag, or view.</p><button className="button" type="button" onClick={() => { setQuery(""); setView("all"); searchRef.current?.focus(); }}>Clear filters</button></div> : null}
        </section>
      </main>

      <footer className="footer"><span>Read-only by design</span><span>{services.length} registered services</span>{adminURL ? <a href={adminURL}>Open Admin</a> : null}</footer>
      <nav className="mobile-tabbar" aria-label="Portal navigation">
        <button type="button" aria-pressed={view === "all" && !query} onClick={() => { setView("all"); setQuery(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}><ServiceGlyph name="home" /><span>Home</span></button>
        <button type="button" aria-pressed={paletteOpen} onClick={openPalette}><SearchIcon /><span>Search</span></button>
        <button type="button" aria-pressed={view === "system"} onClick={() => { setView("system"); setQuery(""); directoryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><ServiceGlyph name="gateway" /><span>System</span></button>
      </nav>
      <div className="sr-only" aria-live="polite">{statusQuery.isFetching ? "Refreshing Home Stack status" : ""}</div>

      {paletteOpen ? <CommandPalette services={services} onClose={closeOverlay} onDetails={(service) => openDetails(service, true)} onLaunch={launchFromPalette} /> : null}
      {detailService ? <DetailSheet service={detailService} status={statuses[detailService.id]} stale={statusStale} favorite={preferences.favorites.includes(detailService.id)} adminURL={adminURL} onClose={closeOverlay} onFavorite={() => toggleFavorite(detailService.id)} onLaunch={() => launch(detailService.id)} /> : null}
    </div>
  );
}
