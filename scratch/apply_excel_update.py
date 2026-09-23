import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
import os
import shutil

xlsx_path = Path("balance/waves_enemies.xlsx")
temp_path = Path("balance/waves_enemies_temp.xlsx")
backup_path = Path("balance/waves_enemies_backup.xlsx")

# Backup original
if not backup_path.exists():
    shutil.copy2(xlsx_path, backup_path)

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
ET.register_namespace('', "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

stage_updates = {
    'G6': '60',  # Stage 1 aircraft_health: 80 -> 60
}

wave_updates = {
    'C6': '16',  # S1 W1: 10 -> 16
    'C7': '24',  # S1 W2: 16 -> 24
    'C8': '31',  # S1 W3: 22 -> 31
    'C9': '29',  # S2 W1: 18 -> 29
    'C10': '37', # S2 W2: 24 -> 37
    'C11': '44', # S2 W3: 30 -> 44
    'C12': '50', # S2 W4: 36 -> 50
    'C13': '40', # S3 W1: 25 -> 40
    'C14': '47', # S3 W2: 30 -> 47
    'C15': '54', # S3 W3: 36 -> 54
    'C16': '61', # S3 W4: 42 -> 61
    'C17': '67', # S3 W5: 48 -> 67
}

def update_sheet_xml(xml_bytes, updates):
    root = ET.fromstring(xml_bytes)
    for c in root.findall(".//m:c", NS):
        cell_ref = c.attrib.get('r')
        if cell_ref in updates:
            new_val = updates[cell_ref]
            v = c.find('m:v', NS)
            if v is not None:
                print(f"Updating {cell_ref}: {v.text} -> {new_val}")
                v.text = new_val
            else:
                v = ET.SubElement(c, f"{{{NS['m']}}}v")
                v.text = new_val
                print(f"Setting {cell_ref} -> {new_val}")
    return ET.tostring(root, encoding='utf-8', xml_declaration=True)

with zipfile.ZipFile(xlsx_path, 'r') as zin:
    with zipfile.ZipFile(temp_path, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            content = zin.read(item.filename)
            if item.filename == "xl/worksheets/sheet2.xml":
                content = update_sheet_xml(content, stage_updates)
            elif item.filename == "xl/worksheets/sheet3.xml":
                content = update_sheet_xml(content, wave_updates)
            zout.writestr(item, content)

# Replace original
shutil.move(temp_path, xlsx_path)
print("waves_enemies.xlsx updated successfully!")
