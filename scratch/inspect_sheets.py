import zipfile
import xml.etree.ElementTree as ET

xlsx_path = "balance/waves_enemies.xlsx"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

with zipfile.ZipFile(xlsx_path, 'r') as z:
    # sheet2 is Stages
    s2 = z.read("xl/worksheets/sheet2.xml")
    root2 = ET.fromstring(s2)
    print("--- Stages (sheet2) rows ---")
    for row in root2.findall(".//m:row", NS):
        r_idx = row.attrib.get('r')
        cells = [(c.attrib.get('r'), c.attrib.get('t'), c.findtext('m:v', default='', namespaces=NS)) for c in row.findall('m:c', NS)]
        print(f"Row {r_idx}: {cells}")

    # sheet3 is Waves
    s3 = z.read("xl/worksheets/sheet3.xml")
    root3 = ET.fromstring(s3)
    print("--- Waves (sheet3) rows ---")
    for row in root3.findall(".//m:row", NS):
        r_idx = row.attrib.get('r')
        cells = [(c.attrib.get('r'), c.attrib.get('t'), c.findtext('m:v', default='', namespaces=NS)) for c in row.findall('m:c', NS)]
        print(f"Row {r_idx}: {cells}")
