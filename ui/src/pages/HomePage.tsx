import { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import {
  Loader2,
  Home,
  ChevronRight,
  Plus,
  Menu,
  X,
  Layers,
  DoorOpen,
} from "lucide-react";
import { useZones } from "../store/useZones";
import { useEquipments } from "../store/useEquipments";
import { useAuth } from "../store/useAuth";
import { useZoneAggregation } from "../store/useZoneAggregation";
import { executeZoneOrder, getHistoryStatus } from "../api";
import { ZoneEquipmentsView } from "../components/home/ZoneEquipmentsView";
import { ZoneAggregationPills } from "../components/home/ZoneAggregationPills";
import { ZoneCommands, type ZoneOrder } from "../components/home/ZoneCommands";
import { ZoneRecipesSection } from "../components/recipes/ZoneRecipesSection";
import { ZoneModesSection } from "../components/home/ZoneModesSection";
import { EquipmentForm } from "../components/equipments/EquipmentForm";
import { autoCreateBindings } from "../components/equipments/bindingUtils";
import { buildBoundOrderKeysByDevice } from "../lib/binding-utils";
import { useWsSubscription } from "../hooks/useWsSubscription";
import type { EquipmentType, ZoneAggregatedData, ZoneWithChildren } from "../types";

export function HomePage() {
  useWsSubscription(["zones", "equipments", "modes", "recipes"]);
  const { t } = useTranslation();
  const { zoneId } = useParams();
  const navigate = useNavigate();
  const tree = useZones((s) => s.tree);
  const zonesLoading = useZones((s) => s.loading);
  const fetchZones = useZones((s) => s.fetchZones);
  const equipments = useEquipments((s) => s.equipments);
  const equipmentsLoading = useEquipments((s) => s.loading);
  const fetchEquipments = useEquipments((s) => s.fetchEquipments);
  const executeOrder = useEquipments((s) => s.executeOrder);
  const createEquipment = useEquipments((s) => s.createEquipment);
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === "admin";
  const aggregationData = useZoneAggregation((s) => s.data);
  const fetchAggregation = useZoneAggregation((s) => s.fetchAggregation);
  const [showEquipmentForm, setShowEquipmentForm] = useState(false);

  // Check if history (InfluxDB) is enabled — used for sparklines
  const [historyEnabled, setHistoryEnabled] = useState(false);

  useEffect(() => {
    fetchZones();
    fetchEquipments();
    fetchAggregation();
    getHistoryStatus()
      .then((s) => setHistoryEnabled(s.enabled && s.connected))
      .catch(() => setHistoryEnabled(false));
  }, [fetchZones, fetchEquipments, fetchAggregation]);

  // If no zoneId in URL, redirect to first zone
  useEffect(() => {
    if (!zoneId && !zonesLoading && tree.length > 0) {
      const firstZone = getFirstLeafZone(tree);
      if (firstZone) {
        navigate(`/home/${firstZone.id}`, { replace: true });
      }
    }
  }, [zoneId, zonesLoading, tree, navigate]);

  // Find the current zone in tree
  const currentZone = useMemo(() => {
    if (!zoneId) return null;
    return findZoneById(tree, zoneId);
  }, [tree, zoneId]);

  // Filter equipments for this zone
  const zoneEquipments = useMemo(() => {
    if (!zoneId) return [];
    return equipments.filter((eq) => eq.zoneId === zoneId);
  }, [equipments, zoneId]);

  const aggData = zoneId ? aggregationData[zoneId] : undefined;
  const [commandLoading, setCommandLoading] = useState<ZoneOrder | null>(null);

  const handleZoneCommand = useCallback(async (orderKey: ZoneOrder) => {
    if (!zoneId) return;
    setCommandLoading(orderKey);
    try {
      await executeZoneOrder(zoneId, orderKey);
    } catch {
      // Silently handle — the user sees the result via live updates
    } finally {
      setCommandLoading(null);
    }
  }, [zoneId]);

  const [drawerOpen, setDrawerOpen] = useState(false);

  const loading = zonesLoading || equipmentsLoading;

  // No zone ID and no zones exist
  if (!zoneId && !zonesLoading && tree.length === 0) {
    return <NoZonesState />;
  }

  // Loading
  if (loading && !currentZone) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  // Zone not found (may have been deleted)
  if (zoneId && !currentZone && !zonesLoading) {
    return <ZoneNotFound />;
  }

  if (!currentZone) return null;

  return (
    <div className="p-4 sm:p-6">
      {/* Mobile zone drawer */}
      {drawerOpen && (
        <MobileZoneDrawer
          tree={tree}
          currentZoneId={zoneId}
          onSelect={(id) => { navigate(`/home/${id}`); setDrawerOpen(false); }}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      {/* Zone header + status bar */}
      <div className="max-w-[1200px] mb-5">
        <div className="flex items-center gap-1.5">
          {/* Mobile burger button */}
          {tree.length > 0 && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="md:hidden p-1 -ml-1 rounded-[6px] text-text-secondary hover:bg-border-light transition-colors"
            >
              <Menu size={18} strokeWidth={1.5} />
            </button>
          )}
          <h1 className="text-[28px] sm:text-[42px] font-bold text-text leading-[1.1] tracking-tight">
            {currentZone.name}
          </h1>
        </div>
        {/* Hero lead — description or computed summary, matches mock .hero__lead (spec 100) */}
        <ZoneHeroLead zone={currentZone} aggData={aggData} />
        {zoneId && aggregationData[zoneId] && (
          <div className="mt-3">
            <ZoneAggregationPills data={aggregationData[zoneId]} zoneId={zoneId} historyEnabled={historyEnabled} />
          </div>
        )}
        {/* Zone command buttons */}
        {aggData && (aggData.lightsTotal > 0 || aggData.shuttersTotal > 0) && (
          <div className="mt-3">
            <ZoneCommands
              hasLights={aggData.lightsTotal > 0}
              hasShutters={aggData.shuttersTotal > 0}
              loading={commandLoading}
              onCommand={handleZoneCommand}
            />
          </div>
        )}
      </div>

      {/* Sections: Equipments (left) + Behaviors (right) — 2-col on desktop, stacked on mobile (spec 100).
          min-w-0 on each column prevents intrinsic content (long recipe descriptions, etc.) from
          overriding the 1.5fr/1fr ratio. */}
      <div className="max-w-[1200px] grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
        {/* Left column — Équipements */}
        <Panel
          title={t("equipments.title")}
          className="min-w-0"
          headerRight={isAdmin ? (
            <button
              onClick={() => setShowEquipmentForm(true)}
              className="p-0.5 rounded text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors duration-150"
              title={t("equipments.createEquipment")}
            >
              <Plus size={16} strokeWidth={1.5} />
            </button>
          ) : undefined}
        >
          <ZoneEquipmentsView
            zoneName={currentZone.name}
            equipments={zoneEquipments}
            onExecuteOrder={executeOrder}
            onAdd={isAdmin ? () => setShowEquipmentForm(true) : undefined}
          />
        </Panel>

        {/* Right column — Comportements + future Activity feed (spec 101 slot) */}
        <div className="space-y-6 min-w-0">
          {zoneId && (
            <Panel title={t("behaviors.title")}>
              <ZoneModesSection zoneId={zoneId} />
              <ZoneRecipesSection zoneId={zoneId} zoneName={currentZone.name} />
            </Panel>
          )}
          {/* TODO spec 101: ActivityPanel slot */}
        </div>
      </div>

      {showEquipmentForm && zoneId && (
        <EquipmentForm
          title={t("equipments.createEquipment")}
          defaultZoneId={zoneId}
          zones={tree}
          excludeTypes={(() => {
            const exclude = new Set<EquipmentType>();
            if (equipments.some((eq) => eq.type === "main_energy_meter")) exclude.add("main_energy_meter");
            if (equipments.some((eq) => eq.type === "energy_production_meter")) exclude.add("energy_production_meter");
            return exclude;
          })()}
          boundOrderKeysByDevice={buildBoundOrderKeysByDevice(equipments)}
          onSubmit={async (data) => {
            const equipment = await createEquipment({
              name: data.name,
              type: data.type,
              zoneId: data.zoneId,
            });
            if (data.selectedDeviceIds.length > 0) {
              await autoCreateBindings(
                equipment.id,
                data.selectedDeviceIds,
                data.type,
                data.candidateByDevice,
              );
              await fetchEquipments();
            }
          }}
          onClose={() => setShowEquipmentForm(false)}
        />
      )}
    </div>
  );
}

function NoZonesState() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-border-light flex items-center justify-center mb-4">
        <Home size={28} strokeWidth={1.5} className="text-text-tertiary" />
      </div>
      <h3 className="text-[16px] font-medium text-text mb-1">{t("home.welcome")}</h3>
      <p className="text-[13px] text-text-secondary max-w-[320px]">
        {t("home.noZones")}
      </p>
    </div>
  );
}

function ZoneNotFound() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mb-4">
        <Home size={28} strokeWidth={1.5} className="text-error" />
      </div>
      <h3 className="text-[16px] font-medium text-text mb-1">{t("home.zoneNotFound")}</h3>
      <p className="text-[13px] text-text-secondary max-w-[320px] mb-4">
        {t("home.zoneDeleted")}
      </p>
      <button
        onClick={() => navigate("/home")}
        className="px-4 py-2 bg-primary text-white text-[13px] font-medium rounded-[6px] hover:bg-primary-hover transition-colors duration-150"
      >
        {t("home.backToHome")}
      </button>
    </div>
  );
}

function ZoneHeroLead({
  zone,
  aggData,
}: {
  zone: ZoneWithChildren;
  aggData: ZoneAggregatedData | undefined;
}) {
  const { t } = useTranslation();
  // Compose lead segments: description (if set) + dynamic lights / shutters summary.
  const segments: string[] = [];

  if (zone.description) segments.push(zone.description);

  if (aggData) {
    if (aggData.lightsTotal > 0 && aggData.lightsOn > 0) {
      segments.push(t("zone.lead.lightsOn", { defaultValue: "{{count}} lumière allumée", count: aggData.lightsOn }));
    }
    if (aggData.shuttersTotal > 0) {
      if (aggData.shuttersOpen === aggData.shuttersTotal) {
        segments.push(t("zone.lead.allShuttersOpen", { defaultValue: "tous les volets ouverts" }));
      } else if (aggData.shuttersOpen > 0) {
        segments.push(t("zone.lead.shuttersOpen", { defaultValue: "{{count}} volet ouvert", count: aggData.shuttersOpen }));
      }
    }
  }

  if (segments.length === 0) return null;

  return (
    <div
      className="flex items-center gap-[0.6rem] mt-[0.55rem] text-[0.85rem] text-text-tertiary tabular-nums flex-wrap"
      aria-label={t("zone.lead.aria", { defaultValue: "Résumé de la zone" })}
    >
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-[0.6rem]">
          {i > 0 && <span className="w-1 h-1 rounded-full bg-text-tertiary/50 flex-shrink-0" />}
          <span>{seg}</span>
        </span>
      ))}
    </div>
  );
}

function Panel({
  title,
  headerRight,
  className = "",
  children,
}: {
  title: string;
  headerRight?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`bg-surface border border-border-light rounded-lg overflow-hidden ${className}`}>
      {/* Panel head — strict alignment with design-system .panel__head (spec 100) */}
      <div className="flex items-center gap-[0.55rem] px-[1.1rem] py-[0.55rem] min-h-[44px] bg-primary-light border-b border-primary-mid">
        <h2 className="text-[11.5px] font-bold text-primary uppercase tracking-[0.12em]">
          {title}
        </h2>
        {headerRight && <div className="ml-auto flex-shrink-0">{headerRight}</div>}
      </div>
      {children}
    </section>
  );
}

function MobileZoneDrawer({
  tree,
  currentZoneId,
  onSelect,
  onClose,
}: {
  tree: ZoneWithChildren[];
  currentZoneId: string | undefined;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      {/* Drawer panel */}
      <div className="fixed inset-y-0 left-0 w-[280px] bg-surface border-r border-border shadow-lg animate-slide-left overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Home size={18} strokeWidth={1.5} className="text-primary" />
            <span className="text-[15px] font-semibold text-text">{t("nav.maison")}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[6px] text-text-tertiary hover:text-text-secondary hover:bg-border-light transition-colors"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <nav className="py-2">
          {tree.map((zone) => (
            <ZoneTreeItem
              key={zone.id}
              zone={zone}
              currentZoneId={currentZoneId}
              onSelect={onSelect}
              depth={0}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}

function ZoneTreeItem({
  zone,
  currentZoneId,
  onSelect,
  depth,
}: {
  zone: ZoneWithChildren;
  currentZoneId: string | undefined;
  onSelect: (id: string) => void;
  depth: number;
}) {
  const isActive = zone.id === currentZoneId;
  const hasChildren = zone.children.length > 0;
  const [expanded, setExpanded] = useState(true);
  const Icon = hasChildren ? Layers : DoorOpen;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) {
            setExpanded(!expanded);
          }
          onSelect(zone.id);
        }}
        className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${
          isActive
            ? "bg-primary/8 text-primary font-medium"
            : "text-text hover:bg-border-light"
        }`}
        style={{ paddingLeft: `${16 + depth * 16}px` }}
      >
        {hasChildren && (
          <ChevronRight
            size={14}
            strokeWidth={2}
            className={`text-text-tertiary transition-transform duration-200 flex-shrink-0 ${expanded ? "rotate-90" : ""}`}
          />
        )}
        {!hasChildren && <span className="w-[14px] flex-shrink-0" />}
        <Icon size={16} strokeWidth={1.5} className={isActive ? "text-primary" : "text-text-tertiary"} />
        <span className="text-[14px] truncate">{zone.name}</span>
      </button>
      {hasChildren && expanded && (
        <div>
          {zone.children.map((child) => (
            <ZoneTreeItem
              key={child.id}
              zone={child}
              currentZoneId={currentZoneId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function findZoneById(zones: ZoneWithChildren[], id: string): ZoneWithChildren | null {
  for (const zone of zones) {
    if (zone.id === id) return zone;
    const found = findZoneById(zone.children, id);
    if (found) return found;
  }
  return null;
}

function getFirstLeafZone(zones: ZoneWithChildren[]): ZoneWithChildren | null {
  if (zones.length === 0) return null;
  return zones[0];
}
