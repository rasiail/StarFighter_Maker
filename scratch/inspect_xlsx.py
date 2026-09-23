import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

xlsx_path = Path("balance/waves_enemies.xlsx")
with zipfile.ZipFile(xlsx_path, 'r') as z:
    for name in z.namelist():
        if "sheet" in name or "workbook" in name:
            print(name)

    # Read workbook to get sheet names and r:ids
    wb_xml = z.read("xl/workbook.xml")
    root = ET.fromstring(wb_xml)
    NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
    for sheet in root.findall(".//m:sheet", NS):
        print("Sheet:", sheet.attrib)

    # Read rels
    rels_xml = z.read("xl/_rels/workbook.xml.rels")
    r_root = ET.fromstring(rels_xml)
    PKG_NS = {"p": "http://schemas.openxmlformats.org/package/2006/relationships"}
    for rel in r_root.findall(".//p:Relationship", PKG_NS):
        print("Rel:", rel.attrib)
