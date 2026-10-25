import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
/** External changes never remount a dirty editor or interrupt a foreground operation. */
export function useExternalUpdates(
  campaignId: string | null,
  canRefresh: () => boolean,
  refresh: () => Promise<boolean>,
) {
  useEffect(() => {
    if (!isTauri() || !campaignId) return;
    let disposed = false,
      pending = false,
      running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function tick() {
      timer = undefined;
      if (disposed || !pending || running) return;
      if (!canRefresh()) {
        timer = setTimeout(() => void tick(), 500);
        return;
      }
      running = true;
      pending = false;
      try {
        if (!(await refresh())) pending = true;
      } catch {
        pending = false;
      } finally {
        // Existing app error handling owns storage diagnostics.
        running = false;
        if (!disposed && pending) timer = setTimeout(() => void tick(), 500);
      }
    }
    const stop = listen<string>("chronexus:external-change", (event) => {
      if (disposed || event.payload !== campaignId) return;
      pending = true;
      if (!timer && !running) timer = setTimeout(() => void tick(), 100);
    });
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      void stop.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [campaignId, canRefresh, refresh]);
}
