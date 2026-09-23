import zipfile
import xml.etree.ElementTree as ET

xlsx_path = "balance/waves_enemies.xlsx"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

with zipfile.ZipFile(xlsx_path, 'r') as z:
    s4 = z.read("xl/worksheets/sheet4.xml")
    root = ET.fromstring(s4)
    print("--- Enemies (sheet4) ---")
    for row in root.findall(".//m:row", NS):
        r_idx = row.attrib.get('r')
        cells = []
        for c in row.findall('m:c', NS):
            r = c.attrib.get('r')
            t = c.attrib.get('t')
            v = c.findtext('m:v', default='', namespaces=NS)
            if t == 'inlineStr':
                is_text = c.findtext('.//m:t', default='', namespaces=NS)
                cells.append((r, t, is_text))
            else:
                cells.append((r, t, v))
        print(f"Row {r_idx}: {cells}")
