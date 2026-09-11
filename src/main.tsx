import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import App from "./App";
import { startPerformanceDiagnostics } from "./performance";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true
    }
  }
});

performance.mark("portal-script-start");
startPerformanceDiagnostics();

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    document.documentElement.dataset.updateReady = "true";
    window.dispatchEvent(new Event("portal:update-ready"));
  },
  onOfflineReady() {
    // The first catalog request can race service-worker activation. Refresh
    // once the shell is ready so this session's authoritative projections are
    // also available to the runtime caches.
    void queryClient.invalidateQueries({ queryKey: ["catalog"] });
    void queryClient.invalidateQueries({ queryKey: ["status"] });
  }
});

window.addEventListener("portal:apply-update", () => {
  void updateSW(true);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
