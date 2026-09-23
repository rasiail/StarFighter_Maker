import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
import shutil

xlsx_path = Path("balance/waves_enemies.xlsx")
temp_path = Path("balance/waves_enemies_temp.xlsx")

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
ET.register_namespace('', "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

def fix_sheet4(xml_bytes):
    root = ET.fromstring(xml_bytes)
    for c in root.findall(".//m:c", NS):
        if c.attrib.get('r') == 'G11': # elite counts_as_target
            print(f"Fixing G11 from type={c.attrib.get('t')} to type='b'")
            c.attrib['t'] = 'b' # boolean type
            v = c.find('m:v', NS)
            if v is not None:
                v.text = '1'
            else:
                v = ET.SubElement(c, f"{{{NS['m']}}}v")
                v.text = '1'
    return ET.tostring(root, encoding='utf-8', xml_declaration=True)

with zipfile.ZipFile(xlsx_path, 'r') as zin:
    with zipfile.ZipFile(temp_path, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            content = zin.read(item.filename)
            if item.filename == "xl/worksheets/sheet4.xml":
                content = fix_sheet4(content)
            zout.writestr(item, content)

shutil.move(temp_path, xlsx_path)
print("Updated G11 in sheet4.xml successfully!")
