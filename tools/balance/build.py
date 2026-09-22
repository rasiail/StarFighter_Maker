"""Convert local balance workbooks into engine-neutral JSON and web ES modules.

Uses only Python's standard library so the same pipeline can run on a clean
checkout without installing spreadsheet packages.
"""
from __future__ import annotations

import csv
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "balance"
CSV_DIR = SOURCE_DIR / "generated"
OUTPUT_DIR = ROOT / "src" / "data" / "generated"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
PKG_NS = {"p": "http://schemas.openxmlformats.org/package/2006/relationships"}


def cell_column(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference).group(0)
    result = 0
    for char in letters:
        result = result * 26 + ord(char) - 64
    return result - 1


def read_workbook(path: Path) -> dict[str, list[list[object]]]:
    with zipfile.ZipFile(path) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = ["".join(node.text or "" for node in si.findall(".//m:t", NS)) for si in root.findall("m:si", NS)]
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {rel.attrib["Id"]: rel.attrib["Target"].lstrip("/") for rel in rels.findall("p:Relationship", PKG_NS)}
        result = {}
        for entry in workbook.findall("m:sheets/m:sheet", NS):
            name = entry.attrib["name"]
            target = targets[entry.attrib[f"{{{NS['r']}}}id"]]
            if not target.startswith("xl/"):
                target = "xl/" + target
            root = ET.fromstring(archive.read(target))
            rows = []
            for row_node in root.findall("m:sheetData/m:row", NS):
                row_index = int(row_node.attrib["r"]) - 1
                while len(rows) < row_index:
                    rows.append([])
                values = []
                for cell in row_node.findall("m:c", NS):
                    index = cell_column(cell.attrib["r"])
                    values.extend([None] * (index - len(values)))
                    kind = cell.attrib.get("t")
                    raw = cell.findtext("m:v", default="", namespaces=NS)
                    if kind == "s": value = shared[int(raw)]
                    elif kind == "inlineStr": value = "".join(n.text or "" for n in cell.findall(".//m:t", NS))
                    elif kind == "b": value = raw == "1"
                    elif kind in {"str", "e"}: value = raw
                    elif raw == "": value = None
                    else:
                        number = float(raw)
                        value = int(number) if number.is_integer() else number
                    values.append(value)
                rows.append(values)
            result[name] = rows
        return result


def records(rows: list[list[object]], header_row: int = 3) -> list[dict[str, object]]:
    if len(rows) <= header_row:
        return []
    headers = [str(value or "").strip() for value in rows[header_row]]
    output = []
    for row in rows[header_row + 2:]:
        padded = row + [None] * (len(headers) - len(row))
        record = {header: padded[i] for i, header in enumerate(headers) if header}
        if any(value not in (None, "") for value in record.values()):
            output.append(record)
    return output


def require_unique(rows, key, label):
    values = [row.get(key) for row in rows]
    if any(value in (None, "") for value in values):
        raise ValueError(f"{label}: empty {key}")
    duplicates = sorted({value for value in values if values.count(value) > 1}, key=str)
    if duplicates:
        raise ValueError(f"{label}: duplicate {key}: {duplicates}")


def require_positive(rows, keys, label, allow_zero=False):
    for row in rows:
        for key in keys:
            value = row.get(key)
            if value in (None, ""): continue
            if not isinstance(value, (int, float)) or (value < 0 if allow_zero else value <= 0):
                raise ValueError(f"{label}: {key} must be {'nonnegative' if allow_zero else 'positive'}: {row}")


def camel(record):
    return {re.sub(r"_([a-z])", lambda m: m.group(1).upper(), key): value for key, value in record.items() if value not in (None, "")}


def export_csv(workbook_name, sheet_name, rows):
    directory = CSV_DIR / workbook_name
    directory.mkdir(parents=True, exist_ok=True)
    output = directory / f"{re.sub(r'(?<!^)(?=[A-Z])', '-', sheet_name).lower()}.csv"
    if not rows: return
    headers = list(rows[0].keys())
    with output.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=headers)
        writer.writeheader(); writer.writerows(rows)


def build():
    sources = {
        "levels": ("levels.xlsx", ["Levels"]),
        "weapons": ("weapons.xlsx", ["Weapons"]),
        "waves": ("waves_enemies.xlsx", ["Stages", "Waves", "Enemies", "SpawnRules"]),
        "cards": ("cards.xlsx", ["Cards", "Conditions"]),
    }
    data = {}
    raw = {}
    for group, (filename, sheets) in sources.items():
        path = SOURCE_DIR / filename
        if not path.exists(): raise FileNotFoundError(path)
        book = read_workbook(path)
        raw[group] = {}
        for sheet in sheets:
            rows = records(book.get(sheet, []))
            if not rows: raise ValueError(f"{filename}: missing or empty {sheet} sheet")
            raw[group][sheet] = rows

    levels = raw["levels"]["Levels"]
    require_unique(levels, "current_level", "Levels")
    require_positive(levels, ["current_level", "xp_to_next"], "Levels")
    ordered_levels = sorted(levels, key=lambda x: x["current_level"])
    if [row["current_level"] for row in ordered_levels] != list(range(1, len(ordered_levels) + 1)):
        raise ValueError("Levels: current_level must be continuous from 1")

    weapons = raw["weapons"]["Weapons"]
    require_unique(weapons, "weapon_id", "Weapons")
    require_positive(weapons, ["damage", "fire_interval_sec", "ready_slots", "reload_sec", "lock_range_m", "projectile_speed_mps", "max_speed_mps", "acceleration_mps2", "turn_rate_rad_sec", "lifetime_sec"], "Weapons")

    stages, waves = raw["waves"]["Stages"], raw["waves"]["Waves"]
    enemies, spawn_rules = raw["waves"]["Enemies"], raw["waves"]["SpawnRules"]
    require_unique(stages, "stage_id", "Stages"); require_unique(enemies, "enemy_id", "Enemies"); require_unique(spawn_rules, "rule_id", "SpawnRules")
    require_unique(waves, "stage_id", "Waves stage/wave") if False else None
    stage_ids = {row["stage_id"] for row in stages}
    pairs = [(row["stage_id"], row["wave_index"]) for row in waves]
    if len(pairs) != len(set(pairs)): raise ValueError("Waves: duplicate stage_id + wave_index")
    if any(row["stage_id"] not in stage_ids for row in waves): raise ValueError("Waves: unknown stage_id")
    require_positive(stages, ["stage_id","max_active","attack_budget","aircraft_health","boss_health"], "Stages")
    require_positive(stages, ["xp_reward_multiplier"], "Stages")
    for stage_id in stage_ids:
        indices = sorted(row["wave_index"] for row in waves if row["stage_id"] == stage_id)
        if not indices or indices != list(range(1, len(indices) + 1)):
            raise ValueError("Waves: each stage needs continuous wave_index from 1")
    require_positive(waves, ["stage_id","wave_index","target_kills"], "Waves")
    require_positive(enemies, ["health","xp_reward","score_reward","hit_radius_m"], "Enemies", allow_zero=True)
    rules = {row["rule_id"]: row["value"] for row in spawn_rules}
    probability = rules.get("ground_or_ship_probability")
    if not isinstance(probability, (int, float)) or not 0 <= probability <= 1: raise ValueError("SpawnRules: probability must be between 0 and 1")
    if rules.get("spawn_range_min", 0) >= rules.get("spawn_range_max", 0): raise ValueError("SpawnRules: spawn_range_min must be lower than max")

    cards, conditions = raw["cards"]["Cards"], raw["cards"]["Conditions"]
    require_unique(cards, "card_id", "Cards")
    card_ids = {row["card_id"] for row in cards}
    if any(row["card_id"] not in card_ids for row in conditions): raise ValueError("Cards: condition references unknown card_id")
    if any(row.get("max_rank") is not None and row["max_rank"] <= 0 for row in cards): raise ValueError("Cards: max_rank must be positive or blank")
    if any(row.get("draw_weight", 0) < 0 for row in cards): raise ValueError("Cards: draw_weight must be nonnegative")

    # Write outputs only after every workbook has passed validation.
    for group, sheets in raw.items():
        for sheet_name, rows in sheets.items():
            export_csv(group, sheet_name, rows)

    level_data = [{"currentLevel": row["current_level"], "xpToNext": row["xp_to_next"]} for row in ordered_levels]
    weapon_data = {row["weapon_id"]: camel(row) for row in weapons}
    stage_data = []
    for stage in sorted(stages, key=lambda x: x["stage_id"]):
        item = camel(stage)
        item["waves"] = [row["target_kills"] for row in sorted((w for w in waves if w["stage_id"] == stage["stage_id"]), key=lambda x: x["wave_index"])]
        item["eliteRatios"] = [row.get("elite_ratio", 0) for row in sorted((w for w in waves if w["stage_id"] == stage["stage_id"]), key=lambda x: x["wave_index"])]
        stage_data.append(item)
    enemy_data = {row["enemy_id"]: camel(row) for row in enemies}
    card_data = []
    for card in cards:
        item = camel(card)
        effects = []
        for i in range(1, 4):
            key = card.get(f"e{i}_key")
            if not key: continue
            effects.append({
                "effectKey": key,
                "operation": card.get(f"e{i}_op"),
                "value": card.get(f"e{i}_val"),
                "unitOrRule": card.get(f"e{i}_unit")
            })
            item.pop(f"e{i}Key", None)
            item.pop(f"e{i}Op", None)
            item.pop(f"e{i}Val", None)
            item.pop(f"e{i}Unit", None)
        item["effects"] = effects
        item["conditions"] = [camel(row) for row in conditions if row["card_id"] == card["card_id"]]
        card_data.append(item)

    data = {
        "schemaVersion": 1,
        "levels": level_data,
        "weapons": weapon_data,
        "stages": stage_data,
        "enemies": enemy_data,
        "spawnRules": {row["rule_id"]: {"value": row["value"], "unit": row["unit"]} for row in spawn_rules},
        "cards": card_data,
    }
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    json_text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    (OUTPUT_DIR / "balance.json").write_text(json_text, encoding="utf-8")
    js = "// AUTO-GENERATED from balance/*.xlsx. Do not edit directly.\n" + "export const BALANCE = deepFreeze(" + json_text.rstrip() + ");\n\nfunction deepFreeze(value) {\n    if (value && typeof value === 'object' && !Object.isFrozen(value)) {\n        Object.freeze(value);\n        for (const child of Object.values(value)) deepFreeze(child);\n    }\n    return value;\n}\n"
    (OUTPUT_DIR / "balance.js").write_text(js, encoding="utf-8")
    print(f"Balance build complete: {len(level_data)} levels, {len(weapon_data)} weapons, {len(stage_data)} stages, {len(card_data)} cards")


if __name__ == "__main__":
    try: build()
    except Exception as error:
        print(f"Balance build failed: {error}", file=sys.stderr)
        raise
