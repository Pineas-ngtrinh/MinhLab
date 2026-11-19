#!/usr/bin/env python3
"""Read-only check of the reviewed ERD subset against repository SQL migrations.

This deliberately checks the SQL forms used here, not arbitrary PostgreSQL. It
does not infer an application workflow from the existence of a database table.
"""
from pathlib import Path
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
columns, foreign_keys = {}, []
for source in sorted((ROOT/'database/migrations').glob('*.sql')):
    text = source.read_text()
    for table, body in re.findall(r'CREATE TABLE(?: IF NOT EXISTS)?\s+"?(\w+)"?\s*\((.*?)\n\);', text, re.S):
        for line in body.splitlines():
            m = re.match(r'\s*"?(\w+)"?\s+(.+)', line)
            if not m or m[1].upper() in {'CONSTRAINT','PRIMARY','UNIQUE','CHECK','FOREIGN'}:
                continue
            definition = m[2]
            columns[table,m[1]] = {'nullable':'NOT NULL' not in definition and 'PRIMARY KEY' not in definition,
                                  'unique':'UNIQUE' in definition or 'PRIMARY KEY' in definition}
            parent = re.search(r'REFERENCES\s+"?(\w+)"?\s*\(', definition)
            if parent:
                foreign_keys.append((parent[1],table,m[1],str(source.relative_to(ROOT))))
    for child, column, parent in re.findall(r'ALTER TABLE\s+"?(\w+)"?\s+ADD FOREIGN KEY\s*\("?(\w+)"?\)\s+REFERENCES\s+"?(\w+)"?',text):
        foreign_keys.append((parent,child,column,str(source.relative_to(ROOT))))

file = ROOT/'docs/ooad/exports/MinhLab_Elaboration_Reviewed.drawio'
diagram = ET.parse(file).getroot()
results, errors = [], []
markers = {'ERmandOne':'1','ERzeroToOne':'0..1','ERzeroToMany':'0..*','ERoneToMany':'1..*'}
for page in diagram:
    if page.get('id') not in {'minhlab-erd01','minhlab-erd02','elab-12'}:
        continue
    for edge in page.findall('.//mxCell[@edge="1"]'):
        parent, child = edge.get('source'),edge.get('target')
        style = dict(x.split('=',1) for x in edge.get('style','').split(';') if '=' in x)
        observed = (markers.get(style.get('startArrow')),markers.get(style.get('endArrow')))
        candidates = [(column,source) for a,b,column,source in foreign_keys if (a,b)==(parent,child)]
        matches=[]
        for column,source in candidates:
            constraints = columns[child,column]
            expected = ('0..1' if constraints['nullable'] else '1',
                        '0..1' if constraints['unique'] else '0..*')
            if observed==expected:
                matches.append({'column':column,'migration':source})
        item={'page':page.get('id'),'parent':parent,'child':child,'cardinality':observed,'evidence':matches}
        results.append(item)
        if not matches:
            errors.append(item)
print(json.dumps({'checked':len(results),'errors':errors,'relations':results},ensure_ascii=False,indent=2))
raise SystemExit(bool(errors))
