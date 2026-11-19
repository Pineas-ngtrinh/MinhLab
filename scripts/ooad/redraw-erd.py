#!/usr/bin/env python3
"""Draw three Elaboration ERDs as compact Crow's Foot entity boxes.

Only fields needed for the Elaboration view appear in each box. Each drawn
relationship has a visible FK; omitted columns stay in migrations.
The selected source, other diagrams and prior reviewed versions are untouched.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
EXPORT = ROOT / 'docs/ooad/exports'
TARGET = EXPORT / 'MinhLab_Elaboration_Reviewed.drawio'
spec = importlib.util.spec_from_file_location('entity_enrichment', Path(__file__).with_name('enrich-entity-pages.py'))
enrich = importlib.util.module_from_spec(spec)
spec.loader.exec_module(enrich)

# Ordered, concise fields for an analysis ERD. PK/FK completeness is asserted.
FIELDS = {
    'minhlab-erd01': {
        'categories': ['id', 'parent_id', 'name', 'slug', 'is_active'],
        'products': ['id', 'category_id', 'product_code', 'name', 'slug',
                     'publication_status', 'revision'],
        'product_variants': ['id', 'product_id', 'default_material_id', 'sku',
                             'variant_name', 'color_name', 'sale_price', 'status'],
        'materials': ['id', 'material_code', 'technology', 'material_type',
                      'color_name', 'unit_cost', 'status'],
        'product_images': ['id', 'product_id', 'url', 'alt_text', 'sort_order'],
    },
    'minhlab-erd02': {
        'users': ['id', 'email_normalized', 'full_name', 'status'],
        'orders': ['id', 'customer_id', 'order_number', 'order_status',
                   'payment_status', 'payment_timing', 'grand_total',
                   'shipping_address_line', 'checkout_key_hash'],
        'order_items': ['id', 'order_id', 'product_variant_id', 'item_type', 'quantity',
                        'unit_price', 'line_total'],
        'product_variants': ['id', 'product_id', 'sku',
                             'sale_price', 'status'],
        'products': ['id', 'product_code', 'name'],
        'shipments': ['id', 'order_id', 'shipment_number', 'tracking_number', 'status'],
        'payments': ['id', 'order_id', 'payment_number',
                     'payment_method', 'amount', 'verification_status'],
        'order_tracking_tokens': ['id', 'order_id', 'token_hash', 'expires_at'],
        'refunds': ['id', 'payment_id', 'refund_number',
                    'amount', 'status'],
    },
    'elab-12': {
        'order_items': ['id', 'item_type', 'quantity'],
        'production_jobs': ['id', 'order_item_id', 'assigned_printer_id',
                            'assigned_material_id', 'assigned_operator_id',
                            'job_number', 'status'],
        'printers': ['id', 'printer_code', 'name', 'technology', 'status'],
        'users': ['id', 'email_normalized', 'full_name'],
        'quality_inspections': ['id', 'production_job_id', 'inspected_by',
                                'result', 'quantity_passed', 'quantity_failed'],
        'production_attempts': ['id', 'production_job_id', 'printer_id',
                                'material_id', 'operator_id', 'source_attachment_id',
                                'attempt_number', 'result'],
        'materials': ['id', 'material_code', 'technology', 'color_name', 'status'],
        'attachments': ['id', 'file_asset_id', 'entity_type',
                        'entity_id', 'purpose'],
        'file_assets': ['id', 'storage_provider', 'object_key',
                        'sha256', 'access_level'],
    },
}

POSITIONS = {
    'minhlab-erd01': {
        'categories': (100, 250), 'products': (1140, 275),
        'product_variants': (2190, 240), 'materials': (3240, 270),
        'product_images': (2160, 1080),
    },
    'minhlab-erd02': {
        'users': (100, 240), 'orders': (1080, 265),
        'order_items': (2070, 240), 'product_variants': (3050, 270),
        'products': (4040, 245), 'shipments': (100, 1100),
        'payments': (2070, 1100), 'order_tracking_tokens': (1080, 1640),
        'refunds': (3050, 1100),
    },
    'elab-12': {
        'order_items': (100, 240), 'production_jobs': (1120, 265),
        'printers': (2140, 245), 'users': (100, 1120),
        'quality_inspections': (100, 2560),
        'production_attempts': (1120, 1600),
        'materials': (2140, 1600), 'attachments': (1120, 2560),
        'file_assets': (2140, 2560),
    },
}

WIDTH = 900
HEADER = 108
ROW = 84


def add(root, ident, value, x, y, w, h, *, header=False, marker=False):
    if header:
        style = ('rounded=0;html=1;whiteSpace=wrap;align=center;verticalAlign=middle;'
                 'fontFamily=Arial;fontSize=58;fontStyle=1;strokeColor=#000000;'
                 'strokeWidth=1.6;fillColor=#FFFFFF;fontColor=#000000;')
    else:
        style = ('shape=text;html=1;whiteSpace=wrap;align=left;verticalAlign=middle;'
                 'fontFamily=Arial;fontSize=50;fontStyle=%s;strokeColor=none;'
                 'fillColor=none;fontColor=#000000;spacingLeft=5;'
                 % (1 if marker else 0))
    cell = ET.SubElement(root, 'mxCell', {'id': ident, 'value': value,
                         'vertex': '1', 'connectable': '0', 'parent': '1', 'style': style})
    ET.SubElement(cell, 'mxGeometry', {'x': str(x), 'y': str(y),
                  'width': str(w), 'height': str(h), 'as': 'geometry'})


def draw_page(page, tables, foreign):
    ident = page.get('id')
    root = page.find('./mxGraphModel/root')
    positions = POSITIONS[ident]
    for name, chosen in FIELDS[ident].items():
        assert name in tables
        actual = tables[name]
        assert all(field in actual for field in chosen), (ident, name, 'unknown column')
        keys = {field for field, spec in actual.items() if spec['pk']}
        assert keys.issubset(chosen), (ident, name, 'missing PK', keys - set(chosen))
        for old in list(root):
            old_id = old.get('id', '')
            if old_id.startswith('detail_' + name + '_') or old_id.startswith('erd_box_' + name + '_'):
                root.remove(old)
        x, y = positions[name]
        box = root.find(f"mxCell[@id='{name}']")
        assert box is not None
        height = HEADER + len(chosen) * ROW + 12
        geo = box.find('mxGeometry')
        for prop, value in {'x':x, 'y':y, 'width':WIDTH, 'height':height}.items():
            geo.set(prop, str(value))
        box.set('value', '')
        enrich.set_style(box, rounded=0, strokeColor='#000000', fillColor='#FFFFFF',
                         strokeWidth=2, fontSize=28)
        add(root, f'erd_box_{name}_head', name, x, y, WIDTH, HEADER, header=True)
        for index, field in enumerate(chosen):
            mark = 'PK' if actual[field]['pk'] else 'FK' if (name, field) in foreign else ''
            row_y = y + HEADER + index * ROW
            if mark:
                add(root, f'erd_box_{name}_mark_{index}', mark,
                    x + 20, row_y, 100, ROW, marker=True)
            add(root, f'erd_box_{name}_field_{index}', field,
                x + 124, row_y, WIDTH - 142, ROW)
    rects = {}
    for name in positions:
        g = root.find(f"mxCell[@id='{name}']/mxGeometry")
        rects[name] = tuple(float(g.get(a)) for a in ('x','y','width','height'))
    edges = [e for e in root if e.get('edge') == '1' and e.get('source') in rects
             and e.get('target') in rects]
    for edge in edges:
        parent, child = edge.get('source'), edge.get('target')
        assert any(table == child and target.split('.')[0] == parent and field in FIELDS[ident][child]
                   for (table, field), target in foreign.items()), (ident, parent, child, 'FK not visible')
    grouped = {}
    for edge in edges:
        a, b = edge.get('source'), edge.get('target')
        enrich.set_style(edge, edgeStyle='none', rounded=0, strokeWidth=2.1,
                         startSize=24, endSize=24, startFill=0, endFill=0)
        if a == b:
            x,y,w,h=rects[a]
            enrich.set_style(edge, edgeStyle='orthogonalEdgeStyle', exitX=.2, exitY=0,
                             entryX=.8, entryY=0, exitPerimeter=0, entryPerimeter=0)
            geom=edge.find('mxGeometry')
            for points in list(geom.findall('Array')): geom.remove(points)
            array=ET.SubElement(geom,'Array',{'as':'points'})
            for px in (x+.2*w,x+.8*w):
                ET.SubElement(array,'mxPoint',{'x':str(px),'y':str(y-72)})
            continue
        for own, other, end in ((a,b,'exit'),(b,a,'entry')):
            x,y,w,h=rects[own];xx,yy,ww,hh=rects[other]
            dx,dy=xx+ww/2-x-w/2,yy+hh/2-y-h/2
            side=('right' if dx>0 else 'left') if abs(dx)/w>=abs(dy)/h else ('bottom' if dy>0 else 'top')
            order=yy+hh/2 if side in ('left','right') else xx+ww/2
            grouped.setdefault((own,side),[]).append((order,edge,end))
    for (_,side), members in grouped.items():
        for i,(_,edge,end) in enumerate(sorted(members,key=lambda row:row[0])):
            t=.5 if len(members)==1 else .18+.64*i/(len(members)-1)
            px,py={'left':(0,t),'right':(1,t),'top':(t,0),'bottom':(t,1)}[side]
            enrich.set_style(edge, **{end+'X':px,end+'Y':py,end+'Perimeter':0})
    if ident == 'elab-12':
        for edge in edges:
            a,b=edge.get('source'),edge.get('target')
            if (a,b)==('users','production_jobs'):
                enrich.set_style(edge,exitX=1,exitY=0,entryX=0,entryY=1,
                                 exitPerimeter=0,entryPerimeter=0)
            if (a,b)==('production_jobs','quality_inspections'):
                enrich.set_style(edge,exitX=0,exitY=1,exitPerimeter=0)
    model=page.find('mxGraphModel')
    model.set('pageWidth',str(max(x+w for x,y,w,h in rects.values())+130))
    model.set('pageHeight',str(max(y+h for x,y,w,h in rects.values())+130))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--file',type=Path,default=TARGET)
    args=parser.parse_args()
    doc=ET.parse(args.file)
    tables,foreign,_,_=enrich.schema()
    for page in doc.getroot().findall('diagram'):
        if page.get('id') in FIELDS:
            draw_page(page,tables,foreign)
    ET.indent(doc.getroot(),space='  ')
    doc.write(args.file,encoding='utf-8',xml_declaration=True)
    if args.file.resolve()==TARGET.resolve():
        path=EXPORT/'elaboration-page-map.json'
        mapping=json.loads(path.read_text())
        mapping['output_sha256']=hashlib.sha256(args.file.read_bytes()).hexdigest()
        mapping['visual_inspection']='NOT VERIFIED — ba ERD vừa được vẽ lại'
        path.write_text(json.dumps(mapping,ensure_ascii=False,indent=2)+'\n')
    print('Redrew ERD01, ERD02 and EL12 with compact native entity boxes')


if __name__=='__main__':
    main()
