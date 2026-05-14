import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Square } from "lucide-react";
import type { EquipmentWithDetails } from "../../types";
import { useSliderOverride } from "../../hooks/useSliderOverride";

interface ShutterControlProps {
  equipment: EquipmentWithDetails;
  onExecuteOrder: (alias: string, value: unknown) => Promise<void>;
  compact?: boolean;
}

export function ShutterControl({ equipment, onExecuteOrder, compact }: ShutterControlProps) {
  const { t } = useTranslation();
  const [executing, setExecuting] = useState(false);
  const slider = useSliderOverride();

  const positionBinding = equipment.dataBindings.find(
    (db) => db.category === "shutter_position" || db.alias === "position",
  );
  const devicePosition = positionBinding && typeof positionBinding.value === "number"
    ? positionBinding.value
    : null;

  const position = slider.displayValue(devicePosition);

  const hasState = equipment.orderBindings.some((ob) => ob.alias === "state");
  const hasPositionOrder = equipment.orderBindings.some((ob) => ob.alias === "position");

  // Pool covers slide horizontally → ←/→ arrows. Window shutters keep ↑/↓.
  const isHorizontal = equipment.type === "pool_cover";
  const OpenIcon = isHorizontal ? ChevronLeft : ChevronUp;
  const CloseIcon = isHorizontal ? ChevronRight : ChevronDown;

  const handleCommand = async (command: "OPEN" | "STOP" | "CLOSE", e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (executing || !hasState) return;
    setExecuting(true);
    try {
      await onExecuteOrder("state", command);
    } finally {
      setExecuting(false);
    }
  };

  const handlePositionCommit = () =>
    slider.onCommit((v) => onExecuteOrder("position", v));

  if (compact) {
    // Layout: slider (80px) → state pill → 3 bordered 24×24 buttons (.shutter-btn).
    const sttClass =
      "w-[24px] h-[24px] inline-flex items-center justify-center border border-border-light bg-surface text-text-tertiary rounded-[4px] transition-colors duration-150 cursor-pointer hover:bg-shutter-50 hover:text-shutter-500 hover:border-shutter-500 disabled:opacity-50 disabled:cursor-not-allowed";
    return (
      <div
        className="flex items-center gap-2 flex-shrink-0"
        onClick={(e) => e.preventDefault()}
      >
        {hasPositionOrder && position !== null && (
          <input
            type="range"
            min={0}
            max={100}
            value={position}
            onPointerDown={(e) => { e.stopPropagation(); slider.onStart(); }}
            onChange={(e) => { e.stopPropagation(); slider.onChange(Number(e.target.value)); }}
            onMouseUp={handlePositionCommit}
            onTouchEnd={handlePositionCommit}
            onClick={(e) => e.stopPropagation()}
            className="hidden sm:block w-[80px]"
            style={{ "--fill-pct": `${position}%`, "--fill-color": "var(--shutter-500)" } as React.CSSProperties}
          />
        )}
        {position !== null && (
          position === 100 ? (
            <span className="text-[11px] font-semibold text-success px-[7px] py-[1px] rounded-full bg-success/10">
              {t("controls.opened")}
            </span>
          ) : position === 0 ? (
            <span className="text-[11px] font-semibold text-shutter-500 px-[7px] py-[1px] rounded-full bg-shutter-50">
              {t("controls.closed")}
            </span>
          ) : (
            <span className="text-[11px] text-text-tertiary tabular-nums w-8 text-right">
              {position}%
            </span>
          )
        )}
        {hasState && (
          <>
            <div className="w-px h-5 bg-border" />
            <div className="inline-flex items-center gap-[2px]">
            <button
              onClick={(e) => handleCommand("OPEN", e)}
              disabled={executing}
              className={sttClass}
              title={t("controls.open")}
            >
              <OpenIcon size={10} strokeWidth={2} />
            </button>
            <button
              onClick={(e) => handleCommand("STOP", e)}
              disabled={executing}
              className={sttClass}
              title={t("controls.stop")}
            >
              <Square size={9} strokeWidth={0} fill="currentColor" />
            </button>
            <button
              onClick={(e) => handleCommand("CLOSE", e)}
              disabled={executing}
              className={sttClass}
              title={t("controls.close")}
            >
              <CloseIcon size={10} strokeWidth={2} />
            </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Position slider or display */}
      {position !== null && (
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-text-tertiary w-16">{t("controls.position")}</span>
          {hasPositionOrder ? (
            <input
              type="range"
              min={0}
              max={100}
              value={position}
              onPointerDown={slider.onStart}
              onChange={(e) => slider.onChange(Number(e.target.value))}
              onMouseUp={handlePositionCommit}
              onTouchEnd={handlePositionCommit}
              className="flex-1"
              style={{ "--fill-pct": `${position}%`, "--fill-color": "var(--shutter-500)" } as React.CSSProperties}
            />
          ) : (
            <div className="flex-1 h-1.5 bg-border-light rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${position}%` }}
              />
            </div>
          )}
          <span className="text-[12px] text-text-secondary w-auto text-right tabular-nums">
            {position === 0 ? t("controls.closed") : position === 100 ? t("controls.opened") : `${position}%`}
          </span>
        </div>
      )}

      {/* Command buttons */}
      {hasState && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCommand("OPEN")}
            disabled={executing}
            className="flex items-center gap-2 px-4 py-2 rounded-[6px] text-[13px] font-medium transition-colors duration-150 bg-border-light text-text-secondary hover:bg-border hover:text-text disabled:opacity-50"
          >
            <OpenIcon size={16} strokeWidth={1.5} />
            {t("controls.open")}
          </button>
          <button
            onClick={() => handleCommand("STOP")}
            disabled={executing}
            className="flex items-center gap-2 px-4 py-2 rounded-[6px] text-[13px] font-medium transition-colors duration-150 bg-border-light text-text-secondary hover:bg-border hover:text-text disabled:opacity-50"
          >
            <Square size={12} strokeWidth={2} />
            {t("controls.stop")}
          </button>
          <button
            onClick={() => handleCommand("CLOSE")}
            disabled={executing}
            className="flex items-center gap-2 px-4 py-2 rounded-[6px] text-[13px] font-medium transition-colors duration-150 bg-border-light text-text-secondary hover:bg-border hover:text-text disabled:opacity-50"
          >
            <CloseIcon size={16} strokeWidth={1.5} />
            {t("controls.close")}
          </button>
        </div>
      )}
    </div>
  );
}
