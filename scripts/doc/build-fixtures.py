#!/usr/bin/env python3
"""
Build documentation fixtures from a prod Sowel backup ZIP.

Pipeline:
  prod-backup.zip
    -> anonymize personal data
    -> strip integrations / credentials / live data
    -> showroom-fr.zip (FR base)
    -> apply FR -> EN translation map
    -> showroom-en.zip
"""
import json
import sys
import zipfile
from pathlib import Path

# -------- Anonymization (FR) --------
ZONE_RENAME_FR = {
    "Chambre Victor": "Chambre Enfant 1",
    "Chambre Lucile": "Chambre Enfant 2",
    "Chambre Elise": "Chambre Enfant 3",
}
EQUIPMENT_RENAME_FR = {
    "PIR Marc": "PIR Bureau",
    "PIR Elodie": "PIR Couloir",
    "Remote Marc": "Télécommande 1",
    "Remote Elodie": "Télécommande 2",
}
EQUIPMENT_DELETE_FR = {"Lave-linge"}

NEUTRAL_HOME_NAME_FR = "Ma Maison"
NEUTRAL_LAT = "48.8566"
NEUTRAL_LON = "2.3522"

# -------- FR -> EN translation --------
HOME_NAME_EN = "My Home"

ZONE_TRANSLATE = {
    "Maison": "Home",
    "Extérieur": "Outdoor",
    "Sous-sol": "Basement",
    "RDC": "Ground Floor",
    "Etage 1": "First Floor",
    "Etage 2": "Second Floor",
    "Jardin": "Garden",
    "Piscine": "Pool",
    "Terrasse": "Terrace",
    "Atelier": "Workshop",
    "Cave": "Cellar",
    "Garage": "Garage",
    "Entrée": "Entrance",
    "Bureau": "Office",
    "Cuisine": "Kitchen",
    "Séjour": "Living Room",
    "Chambre Parents": "Master Bedroom",
    "Chambre Enfant 1": "Kids Room 1",
    "Chambre Enfant 2": "Kids Room 2",
    "Chambre Enfant 3": "Kids Room 3",
    "Salle de Bain": "Bathroom",
    "Escalier": "Stairs",
}

EQUIPMENT_TRANSLATE = {
    # lights
    "Lumière": "Light",
    "Lumiere Terrasse": "Terrace Light",
    "Circulation - Escalier Piscine": "Pool Stairs Lighting",
    "Oliviers": "Olive Trees",
    "Spot Piscine": "Pool Spot",
    "Spots": "Spots",
    "Applique x 1": "Sconce x 1",
    "Appliques x 2": "Sconces x 2",
    "Végétations": "Vegetation",
    # shutters
    "Volet": "Shutter",
    "Volet Ouest": "West Shutter",
    "Volet Sud": "South Shutter",
    "Volet Sud Ouest": "South-West Shutter",
    "Volet Piscine": "Pool Cover",
    "Porte Fenêtre": "Patio Door",
    # gates
    "Portail": "Gate",
    "Porte Garage": "Garage Door",
    # sensors
    "PIR": "Motion Sensor",
    "PIR Bureau": "Office Motion Sensor",
    "PIR Couloir": "Hallway Motion Sensor",
    "PIR Entrée Cave": "Cellar Entrance Motion",
    "PIR Escalier": "Stairs Motion Sensor",
    "PIR Fond Cave": "Cellar Back Motion",
    "PIR 00": "Motion Sensor 00",
    "PIR 01": "Motion Sensor 01",
    "PIR 02": "Motion Sensor 02",
    "PIR_00": "Motion Sensor A",
    "PIR_01": "Motion Sensor B",
    "PIRL": "PIRL",
    "Présence": "Presence",
    "THR": "THR",
    # heating / cooling
    "Radiateur": "Radiator",
    "Poele": "Stove",
    "PAC": "Heat Pump",
    "PAC Piscine": "Pool Heat Pump",
    "Pompe Piscine": "Pool Pump",
    # energy
    "Compteur PAC": "Heat Pump Meter",
    "Compteur Piscine": "Pool Meter",
    "Shelly Grid": "Shelly Grid",
    "Shelly Solar": "Shelly Solar",
    # weather
    "Prévisions Météo": "Weather Forecast",
    "Station Météo": "Weather Station",
    # buttons / switches
    "Switch 4 buttons": "4-Button Switch",
    "Switch Appliques": "Sconce Switch",
    "Switch Cocoon": "Cocoon Switch",
    "Switch Lumière": "Light Switch",
    "Switch Sonos": "Sonos Switch",
    "Bouton Garage": "Garage Button",
    "Bouton Table de Nuit": "Bedside Button",
    "Télécommande 1": "Remote 1",
    "Télécommande 2": "Remote 2",
    # other
    "TV": "TV",
    "Vanne Pelouse": "Lawn Valve",
    "Vanne Plantations": "Plants Valve",
}

# Tables to fully empty (credentials, live data, personal)
TABLES_TO_EMPTY = {
    "users",
    "api_tokens",
    "refresh_tokens",
    "device_data",
    "device_orders",
    "mqtt_brokers",
    "mqtt_publishers",
    "mqtt_publisher_mappings",
    "notification_publishers",
    "notification_publisher_mappings",
}

# Files in ZIP to drop (credentials + history)
ZIP_FILES_TO_DROP_PREFIXES = (
    "influx-",
    "data/.influx-token",
    "data/.jwt-secret",
    "data/legrand-",
    "data/netatmo-",
    "data/panasonic-",
)


def anonymize(backup: dict) -> dict:
    """Apply FR anonymization + strip personal/credentials from backup data."""
    t = backup["tables"]

    # 1) Zones renames
    for z in t["zones"]:
        if z["name"] in ZONE_RENAME_FR:
            z["name"] = ZONE_RENAME_FR[z["name"]]

    # 2) Equipments: delete some, rename others
    deleted_eq_ids = {e["id"] for e in t["equipments"] if e["name"] in EQUIPMENT_DELETE_FR}
    t["equipments"] = [e for e in t["equipments"] if e["id"] not in deleted_eq_ids]
    for e in t["equipments"]:
        if e["name"] in EQUIPMENT_RENAME_FR:
            e["name"] = EQUIPMENT_RENAME_FR[e["name"]]

    # 3) Cascade: drop bindings/widgets that point to deleted equipments
    if deleted_eq_ids:
        t["data_bindings"] = [
            b for b in t["data_bindings"]
            if b.get("equipment_id") not in deleted_eq_ids
        ]
        t["order_bindings"] = [
            b for b in t["order_bindings"]
            if b.get("equipment_id") not in deleted_eq_ids
        ]
        t["dashboard_widgets"] = [
            w for w in t["dashboard_widgets"]
            if w.get("entity_id") not in deleted_eq_ids
        ]
        t["recipe_instances"] = [
            r for r in t["recipe_instances"]
            if not _instance_refs_deleted(r, deleted_eq_ids)
        ]
        instance_ids = {r["id"] for r in t["recipe_instances"]}
        t["recipe_state"] = [s for s in t["recipe_state"] if s.get("instance_id") in instance_ids]
        t["button_action_bindings"] = [
            b for b in t["button_action_bindings"]
            if b.get("equipment_id") not in deleted_eq_ids
        ]

    # 4) Devices: keep but mark offline + strip credentials/raw expose
    for d in t["devices"]:
        d["status"] = "offline"
        d["last_seen"] = None
        d["raw_expose"] = None

    # 5) Settings: filter out integration/mqtt/z2m + tweak home.*
    new_settings = []
    for s in t["settings"]:
        k = s["key"]
        if k.startswith("integration.") or k.startswith("mqtt.") or k.startswith("z2m."):
            continue
        if k == "home.name":
            s = {**s, "value": NEUTRAL_HOME_NAME_FR}
        elif k == "home.latitude":
            s = {**s, "value": NEUTRAL_LAT}
        elif k == "home.longitude":
            s = {**s, "value": NEUTRAL_LON}
        new_settings.append(s)
    t["settings"] = new_settings

    # 6) Empty tables (credentials, live data, history)
    for tbl in TABLES_TO_EMPTY:
        if tbl in t:
            t[tbl] = []

    # 7) Plugins: keep entries but neutralize any token-like config (just safe scrub)
    for p in t.get("plugins", []):
        for fld in ("config", "secrets", "tokens"):
            if fld in p:
                p[fld] = None

    return backup


def _instance_refs_deleted(instance: dict, deleted_eq_ids: set) -> bool:
    params = instance.get("parameters") or instance.get("params") or {}
    if isinstance(params, str):
        try:
            params = json.loads(params)
        except (json.JSONDecodeError, TypeError):
            return False
    if not isinstance(params, dict):
        return False
    for v in params.values():
        if isinstance(v, str) and v in deleted_eq_ids:
            return True
        if isinstance(v, list) and any(isinstance(x, str) and x in deleted_eq_ids for x in v):
            return True
    return False


def translate_to_en(backup: dict) -> dict:
    """Apply FR -> EN translation to zones, equipments, and home.name."""
    t = backup["tables"]
    for z in t["zones"]:
        if z["name"] in ZONE_TRANSLATE:
            z["name"] = ZONE_TRANSLATE[z["name"]]
    for e in t["equipments"]:
        if e["name"] in EQUIPMENT_TRANSLATE:
            e["name"] = EQUIPMENT_TRANSLATE[e["name"]]
    for s in t["settings"]:
        if s["key"] == "home.name":
            s["value"] = HOME_NAME_EN
    return backup


def build_zip(backup: dict, source_zip: Path, out_path: Path) -> None:
    """Repack the source ZIP with the filtered JSON, dropping credentials/influx."""
    json_blob = json.dumps(backup, ensure_ascii=False, indent=2).encode("utf-8")
    with zipfile.ZipFile(source_zip, "r") as src, zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as dst:
        # Write filtered JSON first
        dst.writestr("sowel-backup.json", json_blob)
        # Copy other files except drop list
        for info in src.infolist():
            if info.filename == "sowel-backup.json":
                continue
            if any(info.filename.startswith(p) for p in ZIP_FILES_TO_DROP_PREFIXES):
                continue
            with src.open(info) as f:
                dst.writestr(info, f.read())


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: build-fixtures.py <prod-backup.zip>", file=sys.stderr)
        sys.exit(1)

    src_zip = Path(sys.argv[1])
    out_dir = src_zip.parent

    with zipfile.ZipFile(src_zip, "r") as z:
        raw = z.read("sowel-backup.json").decode("utf-8")
    backup = json.loads(raw)

    # FR fixture
    fr = anonymize(json.loads(json.dumps(backup)))
    fr_path = out_dir / "showroom-fr.zip"
    build_zip(fr, src_zip, fr_path)
    print(f"WROTE {fr_path}")

    # EN fixture (apply translate on top of FR)
    en = translate_to_en(json.loads(json.dumps(fr)))
    en_path = out_dir / "showroom-en.zip"
    build_zip(en, src_zip, en_path)
    print(f"WROTE {en_path}")

    # Diagnostics
    print("\n--- FR fixture summary ---")
    _summary(fr)
    print("\n--- EN fixture summary ---")
    _summary(en)


def _summary(backup: dict) -> None:
    t = backup["tables"]
    print(f"  zones: {len(t['zones'])}")
    print(f"  equipments: {len(t['equipments'])}")
    print(f"  settings: {len(t['settings'])}")
    print(f"  users: {len(t.get('users', []))}")
    print(f"  recipe_instances: {len(t.get('recipe_instances', []))}")
    print(f"  dashboard_widgets: {len(t.get('dashboard_widgets', []))}")
    home_name = next((s["value"] for s in t["settings"] if s["key"] == "home.name"), "?")
    home_lat = next((s["value"] for s in t["settings"] if s["key"] == "home.latitude"), "?")
    print(f"  home.name = {home_name!r}, lat = {home_lat}")
    print(f"  sample zones: {[z['name'] for z in t['zones'][:6]]}")


if __name__ == "__main__":
    main()
