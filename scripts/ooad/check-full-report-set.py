#!/usr/bin/env python3
"""Validate this report's native cells, source preservation and goal evidence.

Mechanical checks complement, but never replace, visual and semantic review.
"""
from pathlib import Path
import argparse
import collections
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from PIL import ImageFont

ROOT=Path(__file__).resolve().parents[2]
DEFAULT=ROOT/'docs/ooad/exports/minhlab-ooad-day-du-theo-mau-2026-11-07.drawio'


def style(cell):
    return dict(part.split('=',1) for part in cell.get('style','').split(';') if '=' in part)


def inspect(artifact):
    manifest=json.loads(artifact.with_suffix('.manifest.json').read_text())
    source=Path(manifest['source']);errors=[];points=0;totals=collections.Counter();fonts={};text_count=0
    document=ET.parse(artifact).getroot();pages=document.findall('diagram');by_page={p.get('id'):p for p in pages}
    def need(condition,message):
        if not condition:errors.append(message)
    need(hashlib.sha256(source.read_bytes()).hexdigest()==manifest['source_sha256'],'Source hash changed')
    need(hashlib.sha256(artifact.read_bytes()).hexdigest()==manifest['artifact_sha256'],'Artifact hash differs from manifest')
    original=ET.parse(source).getroot().findall('diagram')
    need([p.get('id') for p in pages[:len(original)]]==[p.get('id') for p in original],'Source page order/IDs changed')
    need(len(by_page)==len(pages),'Duplicate page IDs')
    records={x['id']:x for x in manifest['pages']}
    for page in pages:
        name=page.get('name');pid=page.get('id');model=page.find('mxGraphModel')
        need(model is not None,f'{name}: flattened or missing native model')
        cells=model.findall('.//mxCell');counts=collections.Counter(c.get('id') for c in cells);by={c.get('id'):c for c in cells}
        need(all(n==1 for n in counts.values()),f'{name}: duplicate cell IDs')
        need('0' in by and '1' in by,f'{name}: missing root layers')
        typ=records[pid]['type'];totals[typ]+=1
        width=float(model.get('pageWidth'));height=float(model.get('pageHeight'))
        for cell in cells:
            key=cell.get('id');sty=style(cell);raw=cell.get('style','')
            need('shape=image' not in raw and 'image=' not in raw,f'{name}: raster/flattened image cell {key}')
            if cell.get('vertex')=='1' and cell.get('parent')=='1':
                geo=cell.find('mxGeometry');x,y,w,h=(float(geo.get(v,0)) for v in ['x','y','width','height'])
                need(x>=0 and y>=0 and x+w<=width+1 and y+h<=height+1,f'{name}: out of page {key}')
                if cell.get('value'):
                    text_count+=1;size=int(sty.get('fontSize',24))
                    need(size>=42,f'{name}: small text {key} ({size}px)')
                    font=fonts.setdefault(size,ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',size))
                    lines=cell.get('value').split('\n')
                    need(max(font.getlength(line) for line in lines)<=w-8,f'{name}: label wider than native box {key}')
                    if key.endswith(('-attrs','-ops')):
                        need(len(lines)*size*1.18<=h,f'{name}: compartment text taller than box {key}')
                if typ=='UseCase' and 'shape=umlActor' in raw:
                    boundary=by.get('system').find('mxGeometry');bx=float(boundary.get('x'));bw=float(boundary.get('width'))
                    need(x+w<=bx or x>=bx+bw,f'{name}: actor inside boundary {key}')
                if typ=='UseCase' and 'ellipse' in raw:
                    boundary=by['system'].find('mxGeometry');bx,byy,bw,bh=(float(boundary.get(v)) for v in ['x','y','width','height'])
                    need(x>=bx and y>=byy+40 and x+w<=bx+bw and y+h<=byy+bh,f'{name}: UC outside boundary {key}')
            if cell.get('edge')!='1':continue
            a=cell.get('source');b=cell.get('target')
            if a or b:need(a in by and b in by,f'{name}: unresolved endpoint {key}')
            else:
                geo=cell.find('mxGeometry')
                need(geo.find('mxPoint[@as="sourcePoint"]') is not None and geo.find('mxPoint[@as="targetPoint"]') is not None,
                     f'{name}: unexpected dangling edge {key}')
                points+=1
            if typ=='ERD':
                need(sty.get('startArrow','').startswith('ER') and sty.get('endArrow','').startswith('ER'),f'{name}: missing Crow foot marker {key}')
            if typ=='Class':need(not sty.get('startArrow','').startswith('ER') and not sty.get('endArrow','').startswith('ER'),f'{name}: Crow foot in class {key}')
            if '«include»' in cell.get('value','') or '«extend»' in cell.get('value',''):
                need(sty.get('dashed')=='1' and sty.get('endArrow')=='open',f'{name}: incorrect dependency notation {key}')
                need('Đăng nhập' not in by[b].get('value',''),f'{name}: mandatory login include')
        for rel in records[pid]['relations']:
            if rel['kind'] in ['include','extend']:
                need(bool(rel.get('condition_or_reason')),f'{name}: relation without reason/condition {rel["id"]}')
        if records[pid].get('decomposition'):
            base=records[pid]['decomposition']['base_cell']
            for edge in cells:
                if edge.get('edge')!='1':continue
                sty=style(edge)
                need(sty.get('edgeStyle')=='none' and sty.get('curved','0')=='0' and sty.get('rounded','0')=='0',
                     f'{name}: nonstraight edge {edge.get("id")}')
                need(edge.find('./mxGeometry/Array') is None,f'{name}: bent edge {edge.get("id")}')
            for rel in records[pid]['relations']:
                if rel['kind']=='include':need(rel['source']==base,f'{name}: include direction {rel["id"]}')
                if rel['kind']=='extend':
                    need(rel['target']==base,f'{name}: extend direction {rel["id"]}')
                    need(bool(rel.get('extension_point')),f'{name}: missing extension point {rel["id"]}')
                    need('[' in rel['label'] and ']' in rel['label'],f'{name}: missing visible guard {rel["id"]}')
            for ref in records[pid]['decomposition']['trace_views']:
                need(any(p.get('name','').startswith(ref+' -') for p in pages),f'{name}: missing evidence view {ref}')
    review=ROOT/'docs/ooad/RA_SOAT_VA_KHUNG_BAO_CAO_THEO_MAU_V10_2026-11-07.md'
    catalog=review.read_text().split('### 6.2 ')[1].split('### 6.3 ')[0]
    expected=set(re.findall(r'^\| (UC-\d\d(?:\.\d+)?) \|',catalog,re.M))
    evidence=manifest['direct_goal_evidence'];need(set(evidence)==expected,'Goal catalog mismatch')
    for key,ref in evidence.items():
        page=by_page[ref['page_id']];cell=page.find(f'.//mxCell[@id="{ref["cell_id"]}"]')
        need(cell is not None and 'ellipse' in cell.get('style',''),f'{key}: no actual UC oval')
        need(cell.get('value')==ref['label'],f'{key}: goal label drift')
    result={'artifact':str(artifact),'pages':len(pages),'preserved_source_pages':len(original),'types':dict(totals),
            'direct_goal_evidence':len(evidence),'expected_goal_count':len(expected),'intentional_point_edges':points,
            'native_text_boxes_checked':text_count,'minimum_native_text_px':42,
            'errors':errors,'visual_qa_is_separate':True}
    return result


def main():
    parser=argparse.ArgumentParser();parser.add_argument('artifact',type=Path,nargs='?',default=DEFAULT);parser.add_argument('--json-output',type=Path)
    args=parser.parse_args();result=inspect(args.artifact)
    if args.json_output:args.json_output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False,indent=2))
    raise SystemExit(1 if result['errors'] else 0)


if __name__=='__main__':main()
