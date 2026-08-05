import { useEffect, useState } from "react";
import { fetchCameraSnapshot } from "../api";

/**
 * Polls the camera media-proxy snapshot route and exposes it as an object
 * URL. A plain <img src="..."> can't carry the Authorization header the
 * route requires (spec 133), so every camera thumbnail goes through this
 * blob-fetch + createObjectURL dance instead.
 */
export function useCameraSnapshot(
  equipmentId: string,
  enabled: boolean,
  refreshMs: number,
): { url: string | null; error: boolean; refresh: () => void } {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let currentUrl: string | null = null;

    const load = async () => {
      try {
        const blob = await fetchCameraSnapshot(equipmentId);
        if (cancelled) return;
        const next = URL.createObjectURL(blob);
        const previous = currentUrl;
        currentUrl = next;
        setUrl(next);
        setError(false);
        if (previous) URL.revokeObjectURL(previous);
      } catch {
        if (!cancelled) setError(true);
      }
    };

    void load();
    const interval = setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [equipmentId, enabled, refreshMs, tick]);

  return { url, error, refresh: () => setTick((t) => t + 1) };
}
