import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type DensityPreference = "comfortable" | "compact";
export type ViewPreference = "all" | "applications" | "system";

export type Preferences = {
  theme: ThemePreference;
  density: DensityPreference;
  favorites: string[];
  recents: string[];
};

const STORAGE_KEY = "home-portal.preferences.v2";
const SESSION_KEY = "home-portal.session.v1";
const defaultPreferences: Preferences = {
  theme: "system",
  density: "comfortable",
  favorites: [],
  recents: []
};

function readPreferences(): Preferences {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultPreferences;
    const parsed = JSON.parse(stored) as Partial<Preferences>;
    return {
      theme: ["system", "light", "dark"].includes(parsed.theme ?? "")
        ? (parsed.theme as ThemePreference)
        : "system",
      density: ["comfortable", "compact"].includes(parsed.density ?? "")
        ? (parsed.density as DensityPreference)
        : "comfortable",
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter((item): item is string => typeof item === "string") : [],
      recents: Array.isArray(parsed.recents) ? parsed.recents.filter((item): item is string => typeof item === "string").slice(0, 8) : []
    };
  } catch {
    return defaultPreferences;
  }
}

export type PortalSession = {
  view: ViewPreference;
  query: string;
  scrollY: number;
};

const defaultSession: PortalSession = { view: "all", query: "", scrollY: 0 };

export function readPortalSession(): PortalSession {
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    if (!stored) return defaultSession;
    const parsed = JSON.parse(stored) as Partial<PortalSession>;
    return {
      view: ["all", "applications", "system"].includes(parsed.view ?? "")
        ? (parsed.view as ViewPreference)
        : "all",
      query: typeof parsed.query === "string" ? parsed.query.slice(0, 200) : "",
      scrollY: typeof parsed.scrollY === "number" && Number.isFinite(parsed.scrollY)
        ? Math.max(0, parsed.scrollY)
        : 0
    };
  } catch {
    return defaultSession;
  }
}

export function writePortalSession(session: PortalSession): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Session restoration is progressive enhancement.
  }
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Preferences still work for the current session when persistent
      // storage is unavailable or full.
    }
  }, [preferences]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const resolved = preferences.theme === "system" ? (systemDark ? "dark" : "light") : preferences.theme;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.density = preferences.density;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute(
      "content",
      resolved === "dark" ? "#111714" : "#f2f5f1"
    );
  }, [preferences.density, preferences.theme, systemDark]);

  const toggleFavorite = useCallback((id: string) => {
    setPreferences((current) => ({
      ...current,
      favorites: current.favorites.includes(id)
        ? current.favorites.filter((favorite) => favorite !== id)
        : [...current.favorites, id]
    }));
  }, []);

  const recordRecent = useCallback((id: string) => {
    setPreferences((current) => ({
      ...current,
      recents: [id, ...current.recents.filter((recent) => recent !== id)].slice(0, 8)
    }));
  }, []);

  return { preferences, setPreferences, toggleFavorite, recordRecent };
}
