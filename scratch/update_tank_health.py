import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
import shutil

xlsx_path = Path("balance/waves_enemies.xlsx")
temp_path = Path("balance/waves_enemies_temp.xlsx")

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
ET.register_namespace('', "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

def update_tank_health(xml_bytes):
    root = ET.fromstring(xml_bytes)
    for c in root.findall(".//m:c", NS):
        if c.attrib.get('r') == 'C7': # tank health
            v = c.find('m:v', NS)
            print(f"Updating C7 (tank health): {v.text} -> 100")
            v.text = '100'
    return ET.tostring(root, encoding='utf-8', xml_declaration=True)

with zipfile.ZipFile(xlsx_path, 'r') as zin:
    with zipfile.ZipFile(temp_path, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            content = zin.read(item.filename)
            if item.filename == "xl/worksheets/sheet4.xml":
                content = update_tank_health(content)
            zout.writestr(item, content)

shutil.move(temp_path, xlsx_path)
print("Updated tank health in waves_enemies.xlsx successfully!")
