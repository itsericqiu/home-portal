type DiagnosticEntry = {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  value?: number;
};

export function startPerformanceDiagnostics(): void {
  if (!new URLSearchParams(window.location.search).has("debug-performance")) return;

  const entries: DiagnosticEntry[] = [];
  const supported = new Set(PerformanceObserver.supportedEntryTypes);
  const requested = ["paint", "largest-contentful-paint", "layout-shift", "longtask", "event"]
    .filter((type) => supported.has(type));

  for (const type of requested) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const candidate = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (candidate.entryType === "layout-shift" && candidate.hadRecentInput) continue;
          entries.push({
            name: candidate.name,
            entryType: candidate.entryType,
            startTime: Math.round(candidate.startTime),
            duration: Math.round(candidate.duration),
            value: candidate.value
          });
        }
      });
      const options = type === "event"
        ? ({ type, buffered: true, durationThreshold: 16 } as PerformanceObserverInit)
        : { type, buffered: true };
      observer.observe(options);
    } catch {
      // Safari versions expose different observer types. Unsupported metrics
      // should not affect the application or the remaining diagnostics.
    }
  }

  window.addEventListener("pagehide", () => {
    console.table(entries);
  }, { once: true });
}
