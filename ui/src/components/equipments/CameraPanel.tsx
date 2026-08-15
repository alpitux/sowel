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
  WifiOff,
} from "lucide-react";
import type {
  DataBindingWithValue,
  OrderBindingWithDetails,
  DataCategory,
  OrderCategory,
} from "../../types";
import { getCameraStreamUrl, getCameraMjpegStreamUrl, getAccessToken } from "../../api";
import { useCameraSnapshot } from "../../hooks/useCameraSnapshot";
import { RelativeTime } from "../RelativeTime";

interface CameraPanelProps {
  dataBindings: DataBindingWithValue[];
  orderBindings: OrderBindingWithDetails[];
  equipmentId: string;
  onExecuteOrder: (alias: string, value: unknown) => Promise<void>;
}

const SNAPSHOT_REFRESH_MS = 30_000;
// How long to wait for the first frame before treating live view as
// failed, even if neither hls.js nor the <video> element raised an
// error — added 2026-08-04 after live view stayed on an indefinite black
// frame on Android Chrome with no error signal at all.
const LIVE_START_TIMEOUT_MS = 12_000;
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
  const streamBinding = dataByCategory.get("camera_stream_url");
  const hasStream = streamBinding !== undefined;
  // Test-only (2026-08-13, not yet proposed upstream): spec 133 flagged
  // `unit` as the signal for stream kind once a plugin needed it — see
  // sowel-plugin-foscam-camera spec 001.
  const isMjpegStream = streamBinding?.unit === "mjpeg";
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
        <CameraView
          equipmentId={equipmentId}
          hasSnapshot={hasSnapshot}
          hasStream={hasStream}
          isMjpegStream={isMjpegStream}
        />
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
  isMjpegStream: boolean;
}

/**
 * Snapshot thumbnail (blob-fetched — a plain <img src> can't carry the
 * Authorization header) + an on-demand live view (hls.js, header injected
 * per-request via xhrSetup). Live view is opt-in per view (not autostart)
 * to stay polite on bandwidth — matches spec 133's "no server-side
 * transcoding, revisit if a vendor needs it" stance.
 */
function CameraView({ equipmentId, hasSnapshot, hasStream, isMjpegStream }: CameraViewProps) {
  const { t } = useTranslation();
  const [live, setLive] = useState(false);
  const [liveError, setLiveError] = useState(false);
  const [liveRetryTick, setLiveRetryTick] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const {
    url: snapshotUrl,
    error: snapshotError,
    refresh: refreshSnapshot,
  } = useCameraSnapshot(equipmentId, hasSnapshot && !live, SNAPSHOT_REFRESH_MS);

  useEffect(() => {
    // MJPEG live view is a plain <img src>, not hls.js — see the render
    // branch below. Test-only (2026-08-13, not yet proposed upstream).
    if (!live || isMjpegStream || !videoRef.current || !HLS_SUPPORTED) return;

    const video = videoRef.current;
    let startedPlaying = false;

    const hls = new Hls({
      // Test-only (2026-08-15, not yet proposed upstream, see
      // sowel-plugin-foscam-camera spec 001): hls.js's default buffering
      // targets ~30s ahead, which on a relay backed by go2rtc's HLS output
      // (0.5s segments here) means it downloads dozens of segments in a
      // burst, then goes quiet for the tens of seconds it takes to play
      // through that buffer. go2rtc tears down its RTSP-to-HLS session
      // ~5s after the last segment fetch (confirmed empirically against
      // this camera's relay, not documented by go2rtc) — that quiet
      // period kills the session, and the live view goes black shortly
      // after starting. Capping the buffer target keeps segment requests
      // frequent enough to never leave a gap that long.
      maxBufferLength: 4,
      maxMaxBufferLength: 4,
      xhrSetup: (xhr) => {
        const token = getAccessToken();
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      },
    });
    hlsRef.current = hls;

    // Log every hls.js error, not just fatal ones — on Android this
    // reportedly stays on a black frame with no visible error at all,
    // which only happens if hls.js is hitting something it doesn't
    // consider fatal (or the video never starts for an unrelated
    // reason the ERROR event never fires for). Logging non-fatal errors
    // costs nothing and is the only lead we have without direct device
    // console access.
    // Test-only (2026-08-15, not yet proposed upstream): a fatal hls.js
    // error here is almost always the go2rtc relay session dying mid-view
    // (see the buffer-size comment above) rather than something a
    // "retry" button materially fixes differently from just going live
    // again — falling back to the snapshot view (setLive(false), same as
    // the user hitting "stop") is a quieter failure than an error banner,
    // and re-enables the auto-refreshing snapshot immediately instead of
    // leaving a dead black frame up.
    hls.on(Hls.Events.ERROR, (_event, data) => {
      console.warn("[camera] hls.js error", {
        equipmentId,
        type: data.type,
        details: data.details,
        fatal: data.fatal,
        reason: (data as { response?: { code?: number } }).response?.code,
      });
      if (data.fatal) setLive(false);
    });

    // The <video> element's own error event catches failures below
    // hls.js's abstraction (e.g. a codec/decode error MSE surfaces
    // directly on the element) that the ERROR event above might not.
    const onVideoError = () => {
      console.error("[camera] <video> element error", {
        equipmentId,
        code: video.error?.code,
        message: video.error?.message,
      });
      setLive(false);
    };
    video.addEventListener("error", onVideoError);

    const onPlaying = () => {
      startedPlaying = true;
    };
    video.addEventListener("playing", onPlaying);

    hls.loadSource(getCameraStreamUrl(equipmentId));
    hls.attachMedia(video);

    // Belt-and-suspenders: if nothing has actually started playing within
    // this window, treat it as failed even if neither hls.js nor the
    // <video> element ever raised an error — better an explicit retry
    // affordance than an indefinite black frame.
    const startTimeout = setTimeout(() => {
      if (!startedPlaying) {
        console.warn("[camera] live view: no frame started playing within timeout", {
          equipmentId,
          timeoutMs: LIVE_START_TIMEOUT_MS,
        });
        setLive(false);
      }
    }, LIVE_START_TIMEOUT_MS);

    return () => {
      clearTimeout(startTimeout);
      video.removeEventListener("error", onVideoError);
      video.removeEventListener("playing", onPlaying);
      hls.destroy();
      hlsRef.current = null;
    };
  }, [equipmentId, live, liveRetryTick, isMjpegStream]);

  return (
    <div className="space-y-2">
      <div className="relative bg-black rounded-[6px] overflow-hidden aspect-video flex items-center justify-center">
        {live ? (
          liveError || (!isMjpegStream && !HLS_SUPPORTED) ? (
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              <WifiOff size={28} strokeWidth={1.5} className="text-error" />
              <p className="text-[13px] font-medium text-white">{t("cameras.live.error")}</p>
              <button
                onClick={() => {
                  setLiveError(false);
                  setLiveRetryTick((n) => n + 1);
                }}
                className="text-[12px] font-medium text-primary hover:underline"
              >
                {t("cameras.live.retry")}
              </button>
            </div>
          ) : isMjpegStream ? (
            // Test-only (2026-08-13, not yet proposed upstream): the
            // browser natively parses multipart/x-mixed-replace MJPEG
            // through a plain <img src>, no client library needed. The
            // token-in-query-string URL is what makes this possible
            // without an Authorization header — see getCameraMjpegStreamUrl.
            <img
              key={liveRetryTick}
              src={getCameraMjpegStreamUrl(equipmentId)}
              onError={() => setLiveError(true)}
              alt=""
              className="w-full h-full object-contain"
            />
          ) : (
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-contain" />
          )
        ) : snapshotUrl ? (
          <img src={snapshotUrl} alt="" className="w-full h-full object-contain" />
        ) : snapshotError ? (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <WifiOff size={28} strokeWidth={1.5} className="text-error" />
            <p className="text-[13px] font-medium text-white">{t("cameras.snapshot.error")}</p>
            <button
              onClick={refreshSnapshot}
              className="text-[12px] font-medium text-primary hover:underline"
            >
              {t("cameras.snapshot.retry")}
            </button>
          </div>
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
