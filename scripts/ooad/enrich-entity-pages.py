#!/usr/bin/env python3
"""Add editable table rows and UML compartments to the reviewed Elaboration copy.

The SQL migration files are the source for the three physical ERD pages. The
two planned class pages use their reviewed domain model, not fictitious tables.
Run after review-elaboration.py. The original 29-page source is never written.
"""
from collections import OrderedDict
from pathlib import Path
import argparse
import hashlib
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
EXPORT = ROOT / 'docs/ooad/exports'
DEFAULT_FILE = EXPORT / 'MinhLab_Elaboration_Reviewed.drawio'


def schema():
    tables = {}
    foreign = {}
    composites = {}
    checks = {}
    for path in sorted((ROOT / 'database/migrations').glob('*.sql')):
        sql = path.read_text()
        for table, body in re.findall(r'CREATE TABLE(?: IF NOT EXISTS)?\s+"?(\w+)"?\s*\((.*?)\n\);', sql, re.S | re.I):
            fields = tables.setdefault(table, OrderedDict())
            for line in body.splitlines():
                match = re.match(r'\s*"?(\w+)"?\s+([A-Za-z]+(?:\([^)]+\))?)(.*)', line)
                if not match or match[1].upper() in {'PRIMARY', 'UNIQUE', 'CHECK', 'CONSTRAINT', 'FOREIGN'}:
                    continue
                name, typ, rest = match.groups()
                fields[name] = {'type': typ, 'pk': 'PRIMARY KEY' in rest.upper(),
                                'nn': 'NOT NULL' in rest.upper() or 'PRIMARY KEY' in rest.upper(),
                                'uq': 'UNIQUE' in rest.upper(), 'ck': 'CHECK' in rest.upper()}
                inline = re.search(r'REFERENCES\s+"?(\w+)"?\s*\(\s*"?(\w+)"?', rest, re.I)
                if inline:
                    foreign[table, name] = f'{inline[1]}.{inline[2]}'
            for clause in re.findall(r'\bUNIQUE\s*\(([^)]+)\)', body, re.I):
                cols = tuple(x.strip().strip('" ') for x in clause.split(','))
                if len(cols) > 1:
                    composites.setdefault(table, set()).add(cols)
        for table, body in re.findall(r'ALTER TABLE\s+"?(\w+)"?\s+(.*?);', sql, re.S | re.I):
            if 'ADD COLUMN' in body.upper():
                for name, typ, rest in re.findall(r'ADD COLUMN\s+"?(\w+)"?\s+([A-Za-z]+(?:\([^)]+\))?)([^,;\n]*)', body, re.I):
                    tables.setdefault(table, OrderedDict())[name] = {
                        'type': typ, 'pk': False, 'nn': 'NOT NULL' in rest.upper(),
                        'uq': 'UNIQUE' in rest.upper(), 'ck': 'CHECK' in rest.upper()}
            for name, parent, parent_col in re.findall(r'ADD FOREIGN KEY\s*\(\s*"?(\w+)"?\s*\)\s*REFERENCES\s+"?(\w+)"?\s*\(\s*"?(\w+)"?', body, re.I):
                foreign[table, name] = f'{parent}.{parent_col}'
        for table, cols in re.findall(r'CREATE UNIQUE INDEX\s+\w+\s+ON\s+"?(\w+)"?\s*\(([^)]+)\)', sql, re.I):
            names = tuple(x.strip().strip('" ').split()[0] for x in cols.split(','))
            if len(names) > 1:
                composites.setdefault(table, set()).add(names)
            elif names and table in tables and names[0] in tables[table]:
                tables[table][names[0]]['uq'] = True
        for table, name in re.findall(r'ALTER TABLE\s+"?(\w+)"?\s+ADD CONSTRAINT\s+"?(\w+)"?\s+CHECK\b', sql, re.I):
            checks.setdefault(table, set()).add(name)
    return tables, foreign, composites, checks


def rows_for_table(name, tables, foreign, composites, checks):
    assert name in tables, f'No SQL table: {name}'
    rows = []
    for column, spec in tables[name].items():
        marks = []
        if spec['pk']:
            marks.append('PK')
        if (name, column) in foreign:
            marks.append('FK')
        if spec['uq'] and not spec['pk']:
            marks.append('UQ')
        if spec['ck']:
            marks.append('CK')
        prefix = ' '.join(marks)
        target = f' → {foreign[name, column]}' if (name, column) in foreign else ''
        item = f'{prefix}  {column}{target}: {spec["type"]}' if prefix else f'{column}: {spec["type"]}'
        if spec['nn'] and not spec['pk']:
            item += '  NOT NULL'
        rows.append(item)
    for cols in sorted(composites.get(name, ())):
        rows.append('UQ (' + ', '.join(cols) + ')')
    for constraint in sorted(checks.get(name, ())):
        rows.append('CK ' + constraint)
    return rows


CLASS_ROWS = {
    'elab-05': {
        'User': ['id: UUID', 'email: String', 'fullName: String', 'status: String'],
        'Order': ['id: UUID', 'orderNumber: String', 'customerId: UUID?',
                  'orderStatus: OrderStatus', 'paymentStatus: PaymentStatus',
                  'currency: String', 'grandTotal: Decimal', 'placedAt: DateTime'],
        'OrderItem': ['id: UUID', 'orderId: UUID', 'productVariantId: UUID?',
                      'printSpecificationId: UUID?',
                      'itemType: String', 'quantity: Integer', 'unitPrice: Decimal',
                      'lineTotal: Decimal'],
        'ProductVariant': ['id: UUID', 'productId: UUID', 'sku: String',
                           'variantName: String', 'salePrice: Decimal', 'status: String'],
        'Product': ['id: UUID', 'categoryId: UUID', 'productCode: String',
                    'name: String', 'publicationStatus: String'],
        'Payment': ['id: UUID', 'orderId: UUID', 'paymentNumber: String',
                    'amount: Decimal', 'verificationStatus: String',
                    'verifiedAt: DateTime?'],
        'ShippingSnapshot': ['recipientName: String', 'recipientPhone: String',
                             'addressLine: String', 'provinceName: String',
                             'countryCode: String'],
        'OrderTrackingToken': ['id: UUID', 'orderId: UUID', 'tokenHash: String',
                               'expiresAt: DateTime'],
    },
    'elab-06': {
        'User': ['id: UUID', 'email: String'],
        'PrintRequest': ['id: UUID', 'requestNumber: String', 'customerId: UUID',
                         'status: String', 'rightsDeclarationAccepted: Boolean'],
        'PrintRequestItem': ['id: UUID', 'printRequestId: UUID', 'itemNumber: Integer',
                             'requestedQuantity: Integer', 'status: String'],
        'FileInspection': ['id: UUID', 'printRequestItemId: UUID',
                           'attachmentId: UUID', 'status: String',
                           'issueSummary: String?', 'inspectedAt: DateTime'],
        'CustomerApproval': ['id: UUID', 'customerId: UUID', 'quoteId: UUID',
                             'approvalStatus: String', 'termsHash: String',
                             'quoteSnapshot: JSON'],
        'Quote': ['id: UUID', 'quoteNumber: String', 'printRequestId: UUID',
                  'revisionNumber: Integer', 'grandTotal: Decimal',
                  'validUntil: DateTime?'],
        'QuoteItem': ['id: UUID', 'quoteId: UUID', 'lineType: String',
                      'quantity: Decimal', 'lineTotal: Decimal'],
        'PrintSpecification': ['id: UUID', 'printRequestItemId: UUID',
                               'revisionNumber: Integer', 'dimensions: Vector3',
                               'status: String'],
        'Order': ['id: UUID', 'orderNumber: String', 'status: String'],
        'OrderItem': ['id: UUID', 'orderId: UUID', 'itemType: String',
                      'specificationSnapshot: JSON?'],
        'FileAsset': ['id: UUID', 'sha256: String', 'byteSize: Integer',
                      'scanStatus: String'],
        'Attachment': ['id: UUID', 'fileAssetId: UUID', 'entityType: String',
                       'entityId: UUID', 'purpose: String?'],
        'Material': ['id: UUID', 'materialCode: String', 'unitCost: Decimal'],
    },
    'elab-07': {
        'ProductionPlan': ['id: UUID', 'status: PlanStatus', 'inputVersionHash: String',
                           'revision: Integer', 'approvedBy: UUID?',
                           'recordDecision(...)', 'markStale(...)'],
        'BatchCandidate': ['id: UUID', 'technology: Technology', 'materialId: UUID',
                           'color: String', 'profileIds: UUID[]',
                           'printerIds: UUID[]', 'layoutEvidenceHash: String?'],
        'CandidateAllocation': ['requirementId: UUID', 'componentRevisionId: UUID',
                                'specRevisionId: UUID', 'quantity: Integer'],
        'ProductionRequirement': ['orderItemId: UUID', 'bomLineId: UUID',
                                  'requiredQty: Integer', 'completedGoodG: Integer',
                                  'activeAllocationA: Integer', 'version: Integer'],
        'OrderItem': ['id: UUID', 'quantity: Integer', 'itemType: String'],
        'BomLine': [],
        'ProductionJob': ['id: UUID', 'status: JobStatus', 'plannedStartAt: DateTime?'],
        'JobAllocation': ['productionJobId: UUID', 'requirementId: UUID',
                          'quantity: Integer', 'quantityPassed: Integer',
                          'quantityFailed: Integer'],
    },
}

# The class pages are not physical ERDs. Their rows are attributes/methods;
# no PK/FK constraint is asserted for a class that has no implemented table.
LAYOUTS = {
    'minhlab-erd01': {
        'categories': (100, 225), 'products': (1300, 270),
        'product_variants': (2600, 240), 'materials': (3900, 295),
        'product_images': (2600, 1470),
    },
    'minhlab-erd02': {
        'users': (100, 240), 'orders': (1350, 260),
        'order_items': (2600, 235), 'product_variants': (3850, 280),
        'products': (5100, 250), 'shipments': (100, 1370),
        'payments': (2600, 1320), 'order_tracking_tokens': (1350, 2220),
        'refunds': (3850, 1280),
    },
    'elab-12': {
        'order_items': (100, 250), 'production_jobs': (1400, 250),
        'printers': (2700, 250), 'users': (100, 1200),
        'quality_inspections': (100, 3000),
        'production_attempts': (1400, 1800),
        'materials': (2700, 1800), 'attachments': (1400, 3000),
        'file_assets': (2700, 3000),
    },
    'elab-05': {
        'User': (100, 240), 'Order': (1200, 265),
        'OrderItem': (2300, 225), 'ProductVariant': (3400, 270),
        'Product': (4500, 245), 'ShippingSnapshot': (100, 1160),
        'Payment': (1200, 1135), 'OrderTrackingToken': (2300, 1180),
    },
    'elab-06': {
        'User': (100, 250), 'PrintRequest': (1200, 250),
        'PrintRequestItem': (2300, 250), 'FileInspection': (3400, 250),
        'CustomerApproval': (100, 1050), 'Quote': (1200, 1050),
        'QuoteItem': (2300, 1050), 'PrintSpecification': (3400, 1050),
        'Order': (100, 1900), 'OrderItem': (1200, 1900),
        'FileAsset': (4500, 1900), 'Attachment': (4500, 1050),
        'Material': (3400, 1900),
    },
    'elab-07': {
        'ProductionPlan': (100, 250), 'BatchCandidate': (1300, 250),
        'CandidateAllocation': (2500, 250),
        'ProductionRequirement': (3700, 250),
        'ProductionJob': (100, 1200), 'JobAllocation': (1300, 1200),
        'OrderItem': (2500, 1200), 'BomLine': (3700, 1200),
    },
}


def set_style(cell, **changes):
    parts = [x for x in cell.get('style', '').split(';') if x]
    names = [x for x in parts if '=' not in x]
    values = dict(x.split('=', 1) for x in parts if '=' in x)
    values.update({k: str(v) for k, v in changes.items()})
    cell.set('style', ';'.join(names + [f'{k}={v}' for k, v in values.items()]) + ';')


def add_cell(root, ident, value, x, y, width, height, font=26, bold=False):
    style = ('rounded=0;html=1;whiteSpace=wrap;align=left;verticalAlign=middle;'
             'spacingLeft=16;fontFamily=Arial;fontSize=%s;fontStyle=%s;'
             'strokeColor=#000000;strokeWidth=1.2;fillColor=#FFFFFF;fontColor=#000000;'
             % (font, 1 if bold else 0))
    item = ET.SubElement(root, 'mxCell', {'id': ident, 'value': value,
                          'vertex': '1', 'parent': '1', 'style': style})
    ET.SubElement(item, 'mxGeometry', {'x': str(x), 'y': str(y),
                 'width': str(width), 'height': str(height), 'as': 'geometry'})


def enhance_page(page, fields):
    root = page.find('./mxGraphModel/root')
    positions = LAYOUTS[page.get('id')]
    if page.get('id') in {'elab-06', 'elab-07'}:
        page.set('name', re.sub(r'\s*[—-]\s*thiết kế$', '', page.get('name')) + ' — thiết kế')
        heading = root.find("mxCell[@id='heading']")
        if heading is not None:
            heading.set('value', heading.get('value', '').replace(' — thiết kế', '') + ' — thiết kế')
    for name, (x, y) in positions.items():
        item = root.find(f"mxCell[@id='{name}']")
        assert item is not None
        old_rows = [c for c in list(root) if c.get('id', '').startswith('detail_' + name + '_')]
        for row in old_rows:
            root.remove(row)
        rows = fields[name]
        width = 1120 if page.get('id').startswith('minhlab-erd') or page.get('id') == 'elab-12' else 920
        header_h, row_h = 66, 48
        height = header_h + len(rows) * row_h
        geometry = item.find('mxGeometry')
        geometry.set('x', str(x)); geometry.set('y', str(y))
        geometry.set('width', str(width)); geometry.set('height', str(height))
        item.set('value', '')
        set_style(item, rounded=0, fillColor='#FFFFFF', strokeColor='#000000',
                  strokeWidth=2, fontSize=26)
        add_cell(root, f'detail_{name}_head', name, x, y, width, header_h, 38, True)
        for index, value in enumerate(rows):
            row_id = f'detail_{name}_{index}'
            add_cell(root, row_id, value, x, y + header_h + index * row_h,
                     width, row_h, 28, value.startswith(('PK  ', 'FK  ')))
            if value.endswith('(...)') and (index == 0 or not rows[index-1].endswith('(...)')):
                set_style(root.find(f"mxCell[@id='{row_id}']"), strokeWidth=2.5)
    # Straight connections, with separate ports on busy sides of a table.
    edges = [e for e in root if e.get('edge') == '1' and e.get('source') in positions
             and e.get('target') in positions]
    by_side = {}
    rects = {key: (float(c.find('mxGeometry').get('x')),
                   float(c.find('mxGeometry').get('y')),
                   float(c.find('mxGeometry').get('width')),
                   float(c.find('mxGeometry').get('height')))
             for key in positions for c in [root.find(f"mxCell[@id='{key}']")]}
    for edge in edges:
        source, target = edge.get('source'), edge.get('target')
        if source == target:
            x, y, w, _ = rects[source]
            set_style(edge, exitX=.2, exitY=0, entryX=.8, entryY=0,
                      exitPerimeter=0, entryPerimeter=0, edgeStyle='orthogonalEdgeStyle')
            geom = edge.find('mxGeometry')
            for points in list(geom.findall('Array')): geom.remove(points)
            array = ET.SubElement(geom, 'Array', {'as': 'points'})
            for px in (x + .2*w, x + .8*w):
                ET.SubElement(array, 'mxPoint', {'x': str(px), 'y': str(y - 90)})
            continue
        for own, other, end in ((source, target, 'exit'), (target, source, 'entry')):
            x, y, w, h = rects[own]; ox, oy, ow, oh = rects[other]
            dx, dy = ox + ow/2 - x - w/2, oy + oh/2 - y - h/2
            side = ('right' if dx > 0 else 'left') if abs(dx)/w >= abs(dy)/h else ('bottom' if dy > 0 else 'top')
            order = oy + oh/2 if side in ('left', 'right') else ox + ow/2
            by_side.setdefault((own, side), []).append((order, edge, end))
    for (_, side), members in by_side.items():
        for index, (_, edge, end) in enumerate(sorted(members, key=lambda row: row[0])):
            t = .5 if len(members) == 1 else .15 + .7 * index/(len(members)-1)
            px, py = {'left': (0,t), 'right': (1,t), 'top': (t,0), 'bottom': (t,1)}[side]
            set_style(edge, **{end+'X':px, end+'Y':py, end+'Perimeter':0,
                               'edgeStyle':'none', 'rounded':0})
            # Multiplicities are separate editable cells on class diagrams.
            for suffix in ('left', 'right'):
                mark = root.find(f"mxCell[@id='{edge.get('id')}_{suffix}']")
                if mark is not None:
                    mark.find('mxGeometry').set('y', '28')
                    set_style(mark, fontSize=28)
    if page.get('id') == 'elab-12':
        # This FK runs between the user and attempt columns; it must not cut
        # through the production_attempts table.
        for relation in edges:
            if (relation.get('source'), relation.get('target')) == ('production_jobs', 'quality_inspections'):
                set_style(relation, exitX=0, exitY=1, exitPerimeter=0)
            if (relation.get('source'), relation.get('target')) == ('users', 'production_jobs'):
                set_style(relation, exitX=1, exitY=0, entryX=0, entryY=1,
                          exitPerimeter=0, entryPerimeter=0)
    model = page.find('mxGraphModel')
    model.set('pageWidth', str(max(x + rects[name][2] for name,(x,y) in positions.items()) + 140))
    model.set('pageHeight', str(max(y + rects[name][3] for name,(x,y) in positions.items()) + 140))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--file', type=Path, default=DEFAULT_FILE)
    args = parser.parse_args()
    doc = ET.parse(args.file)
    root = doc.getroot()
    tables, foreign, composites, checks = schema()
    for page in root.findall('diagram'):
        ident = page.get('id')
        if ident not in LAYOUTS:
            continue
        if ident.startswith('minhlab-erd') or ident == 'elab-12':
            fields = {name: rows_for_table(name, tables, foreign, composites, checks)
                      for name in LAYOUTS[ident]}
        else:
            fields = CLASS_ROWS[ident]
        enhance_page(page, fields)
    ET.indent(root, space='  ')
    doc.write(args.file, encoding='utf-8', xml_declaration=True)
    mapping = EXPORT / 'elaboration-page-map.json'
    if mapping.exists() and args.file.resolve() == DEFAULT_FILE.resolve():
        payload = json.loads(mapping.read_text())
        payload['output_sha256'] = hashlib.sha256(args.file.read_bytes()).hexdigest()
        payload['visual_inspection'] = 'NOT VERIFIED — bảng và lớp vừa được vẽ lại'
        names = {p.get('id'): p.get('name') for p in root.findall('diagram')}
        for entry in payload.get('pages', []):
            if entry.get('new_id') in names:
                entry['name'] = names[entry['new_id']]
        mapping.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    print(f'Updated 6 editable class/ERD pages in {args.file}')


if __name__ == '__main__':
    main()
