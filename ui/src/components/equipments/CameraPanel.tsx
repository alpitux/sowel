import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Hls from "hls.js";
import {
  Camera,
  RefreshCw,
  Video,
  VideoOff,
  ShieldCheck,
  ShieldOff,
  Siren,
  Lightbulb,
} from "lucide-react";
import type {
  DataBindingWithValue,
  OrderBindingWithDetails,
  DataCategory,
  OrderCategory,
} from "../../types";
import { getCameraStreamUrl, getAccessToken } from "../../api";
import { useCameraSnapshot } from "../../hooks/useCameraSnapshot";
import { RelativeTime } from "../RelativeTime";

interface CameraPanelProps {
  dataBindings: DataBindingWithValue[];
  orderBindings: OrderBindingWithDetails[];
  equipmentId: string;
  onExecuteOrder: (alias: string, value: unknown) => Promise<void>;
}

const SNAPSHOT_REFRESH_MS = 30_000;
// Static browser capability check — doesn't change during the session, so
// it's computed once at module scope rather than inside the effect (an
// unsupported browser must not be reported via a synchronous setState in
// an effect body — react-hooks/set-state-in-effect).
const HLS_SUPPORTED = Hls.isSupported();

export function CameraPanel({
  dataBindings,
  orderBindings,
  equipmentId,
  onExecuteOrder,
}: CameraPanelProps) {
  const { t } = useTranslation();

  const dataByCategory = new Map<DataCategory, DataBindingWithValue>();
  for (const b of dataBindings) {
    if (!dataByCategory.has(b.category)) dataByCategory.set(b.category, b);
  }
  const orderByCategory = new Map<OrderCategory, OrderBindingWithDetails>();
  for (const o of orderBindings) {
    if (o.category && !orderByCategory.has(o.category)) orderByCategory.set(o.category, o);
  }

  const hasSnapshot = dataByCategory.has("camera_snapshot_url");
  const hasStream = dataByCategory.has("camera_stream_url");
  const monitoringBinding = dataByCategory.get("camera_monitoring");
  const monitoringOrder = orderByCategory.get("set_camera_monitoring");
  const lightModeBinding = dataByCategory.get("camera_light_mode");
  const lightModeOrder = orderByCategory.get("set_camera_light_mode");
  const sirenOrder = orderByCategory.get("trigger_camera_siren");
  const detectionBinding = dataByCategory.get("camera_detection");

  const hasAnything =
    hasSnapshot || hasStream || monitoringBinding || lightModeBinding || sirenOrder || detectionBinding;

  if (!hasAnything) {
    return (
      <div className="bg-surface rounded-[10px] border border-border p-4 mb-6">
        <h3 className="text-[14px] font-semibold text-text flex items-center gap-2 mb-2">
          <Camera size={16} strokeWidth={1.5} className="text-text-tertiary" />
          {t("cameras.panel.title")}
        </h3>
        <p className="text-[13px] text-text-tertiary">{t("cameras.panel.noData")}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-[10px] border border-border p-4 mb-6 space-y-4">
      <h3 className="text-[14px] font-semibold text-text flex items-center gap-2">
        <Camera size={16} strokeWidth={1.5} className="text-text-tertiary" />
        {t("cameras.panel.title")}
      </h3>

      {(hasSnapshot || hasStream) && (
        <CameraView equipmentId={equipmentId} hasSnapshot={hasSnapshot} hasStream={hasStream} />
      )}

      {(monitoringOrder || (lightModeOrder && lightModeBinding) || sirenOrder) && (
        <div className="flex flex-wrap items-center gap-2">
          {monitoringOrder && (
            <button
              onClick={() =>
                void onExecuteOrder(monitoringOrder.alias, !(monitoringBinding?.value === true))
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium border transition-colors duration-150 ${
                monitoringBinding?.value === true
                  ? "bg-success/10 text-success border-success/30"
                  : "bg-border-light text-text-secondary border-border"
              }`}
            >
              {monitoringBinding?.value === true ? (
                <ShieldCheck size={14} strokeWidth={1.5} />
              ) : (
                <ShieldOff size={14} strokeWidth={1.5} />
              )}
              {monitoringBinding?.value === true
                ? t("cameras.monitoring.on")
                : t("cameras.monitoring.off")}
            </button>
          )}

          {lightModeOrder && lightModeBinding && (
            <div className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary">
              <Lightbulb size={14} strokeWidth={1.5} className="text-text-tertiary" />
              <select
                value={String(lightModeBinding.value ?? "auto")}
                onChange={(e) => void onExecuteOrder(lightModeOrder.alias, e.target.value)}
                className="bg-bg border border-border rounded-[6px] px-2 py-1.5"
              >
                <option value="auto">{t("cameras.lightMode.auto")}</option>
                <option value="on">{t("cameras.lightMode.on")}</option>
                <option value="off">{t("cameras.lightMode.off")}</option>
              </select>
            </div>
          )}

          {sirenOrder && (
            <button
              onClick={() => void onExecuteOrder(sirenOrder.alias, true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium border border-error/30 bg-error/10 text-error transition-colors duration-150 hover:bg-error/20"
            >
              <Siren size={14} strokeWidth={1.5} />
              {t("cameras.siren.trigger")}
            </button>
          )}
        </div>
      )}

      {detectionBinding && detectionBinding.value != null && (
        <p className="text-[13px] text-text-secondary">
          {t("cameras.lastDetection")}{": "}
          <span className="font-mono font-medium text-text">{String(detectionBinding.value)}</span>
          {detectionBinding.lastUpdated && (
            <>
              {" · "}
              <RelativeTime iso={detectionBinding.lastUpdated} />
            </>
          )}
        </p>
      )}
    </div>
  );
}

interface CameraViewProps {
  equipmentId: string;
  hasSnapshot: boolean;
  hasStream: boolean;
}

/**
 * Snapshot thumbnail (blob-fetched — a plain <img src> can't carry the
 * Authorization header) + an on-demand live view (hls.js, header injected
 * per-request via xhrSetup). Live view is opt-in per view (not autostart)
 * to stay polite on bandwidth — matches spec 133's "no server-side
 * transcoding, revisit if a vendor needs it" stance.
 */
function CameraView({ equipmentId, hasSnapshot, hasStream }: CameraViewProps) {
  const { t } = useTranslation();
  const [live, setLive] = useState(false);
  const [liveError, setLiveError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const {
    url: snapshotUrl,
    error: snapshotError,
    refresh: refreshSnapshot,
  } = useCameraSnapshot(equipmentId, hasSnapshot && !live, SNAPSHOT_REFRESH_MS);

  useEffect(() => {
    if (!live || !videoRef.current || !HLS_SUPPORTED) return;

    const hls = new Hls({
      xhrSetup: (xhr) => {
        const token = getAccessToken();
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      },
    });
    hlsRef.current = hls;
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) setLiveError(true);
    });
    hls.loadSource(getCameraStreamUrl(equipmentId));
    hls.attachMedia(videoRef.current);

    return () => {
      hls.destroy();
      hlsRef.current = null;
    };
  }, [equipmentId, live]);

  return (
    <div className="space-y-2">
      <div className="relative bg-black rounded-[6px] overflow-hidden aspect-video flex items-center justify-center">
        {live ? (
          liveError || !HLS_SUPPORTED ? (
            <p className="text-[13px] text-white/70 px-4 text-center">
              {t("cameras.live.error")}
            </p>
          ) : (
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-contain" />
          )
        ) : snapshotUrl ? (
          <img src={snapshotUrl} alt="" className="w-full h-full object-contain" />
        ) : snapshotError ? (
          <p className="text-[13px] text-white/70 px-4 text-center">{t("cameras.snapshot.error")}</p>
        ) : (
          <Camera size={28} strokeWidth={1.5} className="text-white/40" />
        )}
      </div>

      <div className="flex items-center gap-2">
        {hasSnapshot && !live && (
          <button
            onClick={refreshSnapshot}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium text-text-secondary border border-border hover:bg-border-light transition-colors duration-150"
          >
            <RefreshCw size={14} strokeWidth={1.5} />
            {t("cameras.snapshot.refresh")}
          </button>
        )}
        {hasStream && (
          <button
            onClick={() => {
              if (!live) setLiveError(false);
              setLive((v) => !v);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium border transition-colors duration-150 ${
              live
                ? "bg-error/10 text-error border-error/30"
                : "bg-primary/10 text-primary border-primary/30"
            }`}
          >
            {live ? <VideoOff size={14} strokeWidth={1.5} /> : <Video size={14} strokeWidth={1.5} />}
            {live ? t("cameras.live.stop") : t("cameras.live.start")}
          </button>
        )}
      </div>
    </div>
  );
}
