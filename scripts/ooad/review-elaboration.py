#!/usr/bin/env python3
"""Build an editable reviewed copy of the explicitly selected 29-page source.

No application, database or external service is invoked. Original page IDs/names
are retained; shared repository models supply only verified, traceable semantics.
"""
from pathlib import Path
import argparse
import copy
import hashlib
import importlib.util
import json
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
OOAD = ROOT / 'docs/ooad'
spec = importlib.util.spec_from_file_location('ooad_exporter', Path(__file__).with_name('export-ooad-drawio.py'))
exporter = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = exporter
spec.loader.exec_module(exporter)
exporter.INK = '#000000'


def model_root(page):
    model = page.find('mxGraphModel')
    if model is None:
        raise ValueError('Expected native uncompressed source; original is left untouched')
    return model.find('root')


def cell(page, key):
    return model_root(page).find(f"mxCell[@id='{key}']")


def label(page, key, text):
    cell(page, key).set('value', exporter.rich(text))


def style(page, key, **values):
    c = cell(page, key)
    parts = [x for x in c.get('style', '').split(';') if x]
    # Named styles (ellipse, rhombus, edgeLabel, ...) are meaningful mxGraph
    # tokens. Dropping them silently turns UML symbols into default rectangles.
    named = [x for x in parts if '=' not in x]
    entries = dict(x.split('=', 1) for x in parts if '=' in x)
    entries.update({k: str(v) for k, v in values.items()})
    c.set('style', ';'.join(named + [f'{k}={v}' for k, v in entries.items()]) + ';')


def remove(page, *keys):
    root = model_root(page)
    doomed = set(keys)
    for c in list(root):
        if c.get('source') in doomed or c.get('target') in doomed:
            doomed.add(c.get('id'))
    for c in list(root):
        if c.get('id') in doomed or c.get('parent') in doomed:
            root.remove(c)


def vertex(page, key, text, x, y, w=650, h=100, kind='action'):
    shapes = {'action': 'rounded=1;arcSize=10;', 'decision': 'rhombus;',
              'state': 'rounded=1;arcSize=16;', 'merge': 'rhombus;',
              'final': 'ellipse;fillColor=#FFFFFF;', 'start': 'ellipse;fillColor=#000000;'}
    c = ET.SubElement(model_root(page), 'mxCell', {
        'id': key, 'value': exporter.rich(text), 'vertex': '1', 'parent': '1',
        'style': 'html=1;whiteSpace=wrap;align=center;verticalAlign=middle;fontFamily=Arial;'
                 'fontSize=23;strokeColor=#000000;fillColor=#FFFFFF;fontColor=#000000;strokeWidth=1.6;' + shapes[kind],
    })
    ET.SubElement(c, 'mxGeometry', {'x': str(x), 'y': str(y), 'width': str(w), 'height': str(h), 'as': 'geometry'})
    if kind == 'final':
        inner = vertex(page, key + '_inner', '', x + w * .25, y + h * .25, w * .5, h * .5, 'start')
        return inner
    return c


def edge(page, key, source, target, text='', **markers):
    attrs = {'edgeStyle': 'orthogonalEdgeStyle', 'rounded': '0', 'html': '1',
             'strokeColor': '#000000', 'strokeWidth': '1.6', 'endArrow': 'open',
             'startArrow': 'none', 'fontFamily': 'Arial', 'fontSize': '21',
             'fontColor': '#000000', 'labelBackgroundColor': '#FFFFFF', **markers}
    c = ET.SubElement(model_root(page), 'mxCell', {'id': key, 'source': source, 'target': target,
        'value': exporter.rich(text), 'edge': '1', 'parent': '1',
        'style': ';'.join(f'{k}={v}' for k, v in attrs.items()) + ';'})
    ET.SubElement(c, 'mxGeometry', {'relative': '1', 'as': 'geometry'})
    return c


def multiplicity(page, key, left, right):
    for suffix, value, x in [('left', left, '-0.85'), ('right', right, '0.85')]:
        c = ET.SubElement(model_root(page), 'mxCell', {'id': f'{key}_{suffix}', 'value': value,
            'vertex': '1', 'connectable': '0', 'parent': key,
            'style': 'edgeLabel;html=1;fontFamily=Arial;fontSize=22;labelBackgroundColor=#FFFFFF;align=center;'})
        ET.SubElement(c, 'mxGeometry', {'x': x, 'y': '-20', 'relative': '1', 'as': 'geometry'})


def merge_before(page, action, key):
    target = cell(page, action).find('mxGeometry')
    x = float(target.get('x')) + float(target.get('width')) / 2 - 16
    y = float(target.get('y')) - 75
    incoming = [e for e in model_root(page) if e.get('edge') == '1' and e.get('target') == action]
    if len(incoming) > 1:
        vertex(page, key, '', x, y, 32, 32, 'merge')
        for e in incoming:
            e.set('target', key)
        edge(page, key + '_flow', key, action)


def use_cases(actors, goals, associations, includes=()):
    lines = ['@startuml', 'left to right direction']
    lines += [f'actor "{name}" as A{i}' for i, name in enumerate(actors)]
    lines += ['rectangle "MinhLab 3D" {']
    lines += [f'  usecase "{name}" as U{i}' for i, name in enumerate(goals)]
    lines += ['}']
    lines += [f'A{a} -- U{u}' for a, u in associations]
    lines += [f'U{a} ..> U{b} : <<include>>' for a, b in includes]
    return '\n'.join(lines + ['@enduml'])


def render(page, text, kind, status):
    row = {'ID': page.get('id'), 'Name': page.get('name') + ' — ' + status, 'Status': status}
    if kind == 'Use case':
        canvases = exporter.usecase_pages(exporter.parse_generic(text), row)
    elif kind == 'Class':
        canvases = exporter.class_pages(exporter.parse_generic(text), row)
    elif kind == 'Sequence':
        canvases = exporter.sequence_pages(exporter.parse_sequence(text), row, max_messages=1000)
    else:
        raise ValueError(kind)
    assert len(canvases) == 1
    generated = canvases[0].finish()
    page[:] = list(generated)


def erd(page, entities, relationships, status):
    c = exporter.Canvas(page.get('id'), page.get('name') + ' — ' + status, status)
    cols = 3 if len(entities) <= 9 else 4
    y = 240
    entries = list(entities.items())
    for offset in range(0, len(entries), cols):
        heights = []
        for j, (name, attrs) in enumerate(entries[offset:offset + cols]):
            n = exporter.Node(name, name, 'entity', members=attrs)
            heights.append(c.classbox(n, 80 + j * 850, y, 620))
        y += max(heights) + 240
    c.width = max(2000, cols * 850 + 80)
    c.height = y + 80
    router = exporter.Router(c)
    markers = {'1': 'ERmandOne', '0..1': 'ERzeroToOne', '0..*': 'ERzeroToMany', '1..*': 'ERoneToMany'}
    for i, (a, b, left, right, name) in enumerate(relationships):
        points, ports = router.route(a, b)
        c.edge(f'erd_{i}', a, b, name, markers[right], points=points[1:-1], ports=ports,
               start_arrow=markers[left], multiplicity=(left, right))
    page[:] = list(c.finish())


def names_and_relations(page, title, positions, relationships, physical=False):
    """Name-only native boxes; semantics come from schema or the named domain source.

    Small manual offsets are intentional. Straight connectors and multiplicities
    stay editable; explanatory text belongs in the accompanying change log.
    """
    model = page.find('mxGraphModel')
    model.clear()
    root = ET.SubElement(model, 'root')
    ET.SubElement(root, 'mxCell', {'id':'0'})
    ET.SubElement(root, 'mxCell', {'id':'1','parent':'0'})
    vertex(page, 'heading', title, 70, 35, 2100, 85)
    style(page, 'heading', shape='text', rounded=0, fillColor='none', strokeColor='none',
          fontSize=38, fontStyle=1, align='left')
    for name, (x,y,w,h) in positions.items():
        vertex(page, name, name, x,y,w,h)
        style(page, name, rounded=0, fontSize=34, fontStyle=0, spacing=12)
    markers = {'1':'ERmandOne','0..1':'ERzeroToOne','0..*':'ERzeroToMany','1..*':'ERoneToMany'}
    for i, (a,b,left,right,kind) in enumerate(relationships):
        key = f'relation_{i}'
        start = markers[left] if physical else ('diamond' if kind=='composition' else 'none')
        end = markers[right] if physical else ('open' if kind=='navigable' else 'none')
        edge(page,key,a,b,startArrow=start,endArrow=end,startFill=0 if physical else 1,
             endFill=0 if physical else 1,startSize=20,endSize=20,fontSize=28)
        if a==b:
            x,y,w,h=positions[a]
            style(page,key,exitX=.25,exitY=0,entryX=.75,entryY=0,exitPerimeter=0,entryPerimeter=0)
            arr=ET.SubElement(cell(page,key).find('mxGeometry'),'Array',{'as':'points'})
            for px in [x+w*.25,x+w*.75]:
                ET.SubElement(arr,'mxPoint',{'x':str(px),'y':str(y-60)})
        # Crow's Foot carries cardinality itself. Class diagrams use text only.
        if not physical:
            multiplicity(page,key,left,right)
            style(page,key+'_left',fontSize=28)
            style(page,key+'_right',fontSize=28)


def class_names_from_source(page, source, title, positions):
    m = exporter.parse_generic(source)
    relationships=[]
    for link in m.links:
        if link.source in positions and link.target in positions:
            kind='composition' if link.arrow=='*--' else ('navigable' if link.arrow in {'->','-->'} else 'association')
            relationships.append((link.source,link.target,link.left,link.right,kind))
    names_and_relations(page,title,positions,relationships)


def spread_relationship_ports(page):
    """Keep a straight segment, but give each symbol its own place on the box.

    Automatic center-to-center perimeter intersections crowd Crow's Foot glyphs
    and multiplicities. Allocate separate anchors in angular order instead.
    """
    boxes={}
    for c in model_root(page):
        g=c.find('mxGeometry')
        if c.get('vertex')=='1' and c.get('parent')=='1' and c.get('id')!='heading':
            boxes[c.get('id')]=tuple(float(g.get(k,0)) for k in ['x','y','width','height'])
    ports={}
    for e in model_root(page):
        a,b=e.get('source'),e.get('target')
        if e.get('edge')!='1' or a not in boxes or b not in boxes or a==b:
            continue
        for own,other,end in [(a,b,'exit'),(b,a,'entry')]:
            x,y,w,h=boxes[own];xx,yy,ww,hh=boxes[other]
            dx,dy=xx+ww/2-x-w/2,yy+hh/2-y-h/2
            side=('right' if dx>0 else 'left') if abs(dx)/w>=abs(dy)/h else ('bottom' if dy>0 else 'top')
            order=yy+hh/2 if side in {'left','right'} else xx+ww/2
            ports.setdefault((own,side),[]).append((order,e,end))
    for (_,side),members in ports.items():
        members.sort(key=lambda row:row[0])
        for i,(_,e,end) in enumerate(members):
            t=.5 if len(members)==1 else .14+.72*i/(len(members)-1)
            x,y={'left':(0,t),'right':(1,t),'top':(t,0),'bottom':(t,1)}[side]
            style(page,e.get('id'),**{end+'X':x,end+'Y':y,end+'Perimeter':0})
            for suffix in ['left','right']:
                label_cell=cell(page,e.get('id')+'_'+suffix)
                if label_cell is not None:
                    g=label_cell.find('mxGeometry')
                    g.set('x','-0.65' if suffix=='left' else '0.65')
                    g.set('y','30')
                    style(page,label_cell.get('id'),fontSize=28)


def state_view(page,title,nodes,transitions,headings):
    names_and_relations(page,title,{},[])
    for key,(name,x,y,w,h,kind) in nodes.items():
        vertex(page,key,name,x,y,w,h,kind)
    for key,text,x,y in headings:
        vertex(page,key,text,x,y,800,70)
        style(page,key,shape='text',fillColor='none',strokeColor='none',align='left',fontSize=32,fontStyle=1)
    for i,(a,b,text,along,offset) in enumerate(transitions):
        e=edge(page,f'transition_{i}',a,b,text,fontSize=26,labelWidth=450,whiteSpace='wrap')
        g=e.find('mxGeometry');g.set('x',str(along));g.set('y',str(offset))
    spread_relationship_ports(page)


def reviewed_states(pages):
    state_view(pages['d-el16'],'EL16. State — Order và Payment',{
        'order_initial':('',60,340,40,40,'start'),
        'order_pending':('PENDING_PAYMENT',220,300,460,140,'state'),
        'order_confirmed':('CONFIRMED',1240,320,450,140,'state'),
        'order_production':('IN_PRODUCTION',2280,290,480,140,'state'),
        'order_ready':('READY_TO_SHIP',3320,310,480,140,'state'),
        'order_deposit':('DEPOSIT_PAID',1240,1010,450,140,'state'),
        'order_cancelled':('CANCELLED',220,1030,450,140,'state'),
        'order_completed':('COMPLETED',2290,1010,450,140,'state'),
        'order_shipped':('SHIPPED',3340,1030,450,140,'state'),
        'payment_initial':('',380,1940,40,40,'start'),
        'payment_pending':('PENDING',710,1900,450,140,'state'),
        'payment_verified':('VERIFIED',2380,1900,450,140,'state'),
        'payment_rejected':('REJECTED',2370,2600,450,140,'state'),
    },[
        ('order_initial','order_pending','',0,0),
        ('order_pending','order_confirmed','STAFF/ADMIN\n[đối soát đúng tiền]',0,-35),
        ('order_confirmed','order_production','STAFF/ADMIN\n[PAID hoặc COD cũ]',0,-35),
        ('order_production','order_ready','PRINT_OPERATOR/ADMIN',0,-35),
        ('order_ready','order_shipped','STAFF/ADMIN',0,-45),
        ('order_shipped','order_completed','STAFF/ADMIN\n/ thu COD cũ nếu có',0,-40),
        ('order_deposit','order_confirmed','ADMIN\n[đơn cũ]',0,-45),
        ('order_pending','order_cancelled','STAFF/ADMIN\n[UNPAID]',0,-55),
        ('order_confirmed','order_cancelled','STAFF/ADMIN\n[UNPAID]',-.55,-35),
        ('order_production','order_cancelled','ADMIN\n[UNPAID]',-.55,-30),
        ('order_ready','order_cancelled','ADMIN\n[UNPAID]',-.55,-30),
        ('order_deposit','order_cancelled','STAFF/ADMIN\n[UNPAID]',0,-35),
        ('payment_initial','payment_pending','',0,0),
        ('payment_pending','payment_verified','STAFF/ADMIN\n[đúng tiền; đơn chờ]',0,-40),
        ('payment_pending','payment_rejected','STAFF/ADMIN\n/ lý do từ chối',-.3,-45),
        ('payment_rejected','payment_pending','Khai báo lại có quyền\n[đơn chờ; UNPAID]',-.1,-70),
    ],[('order_heading','Order',100,160),('payment_heading','Payment',100,1620)])
    p=pages['d-el16']
    # A declaration is an event, not another state; keep its loop outside the box.
    e=edge(p,'payment_declaration','payment_pending','payment_pending','Khai báo có quyền\n[đơn chờ; UNPAID]\n/ giữ PENDING',fontSize=26,
           exitX=.3,exitY=0,entryX=.7,entryY=0,exitPerimeter=0,entryPerimeter=0)
    arr=ET.SubElement(e.find('mxGeometry'),'Array',{'as':'points'})
    for x,y in [(840,1740),(1030,1740)]: ET.SubElement(arr,'mxPoint',{'x':str(x),'y':str(y)})
    state_view(pages['d-el17'],'EL17. State — ProductionPlan và PrintJob',{
        'plan_initial':('',90,340,40,40,'start'),
        'plan_draft':('DRAFT',290,300,460,140,'state'),
        'plan_validated':('VALIDATED_PROPOSAL',1410,320,620,140,'state'),
        'plan_approved':('APPROVED',2760,300,460,140,'state'),
        'plan_stale':('STALE_PLAN',1120,960,460,140,'state'),
        'plan_rejected':('REJECTED',2290,970,460,140,'state'),
        'job_initial':('',760,1620,40,40,'start'),
        'job_queued':('QUEUED',960,1580,460,140,'state'),
        'job_preparing':('PREPARING',2080,1600,460,140,'state'),
        'job_printing':('PRINTING',3200,1580,460,140,'state'),
        'job_post':('POST_PROCESSING',3180,2290,590,140,'state'),
        'job_qc':('QC_PENDING',2070,2300,480,140,'state'),
        'job_completed':('COMPLETED',960,2290,460,140,'state'),
        'job_failed':('FAILED',2900,3020,460,140,'state'),
        'job_cancelled':('CANCELLED',160,2020,460,140,'state'),
        'job_final':('',180,3040,50,50,'final'),
    },[
        ('plan_initial','plan_draft','',0,0),
        ('plan_draft','plan_validated','[B01–B12 và evidence đạt]',0,-40),
        ('plan_validated','plan_approved','ADMIN [snapshot/key khớp]\n/ atomic apply COMMIT',0,-40),
        ('plan_validated','plan_stale','[nguồn/evidence thay đổi]\n/ giữ bản stale',0,-45),
        ('plan_validated','plan_rejected','ADMIN từ chối\n/ lưu lý do',0,-45),
        ('job_initial','job_queued','',0,0),
        ('job_queued','job_preparing','Thợ chuẩn bị',0,-40),
        ('job_preparing','job_printing','Thợ bắt đầu in',0,-40),
        ('job_printing','job_post','In kết thúc',0,-45),
        ('job_post','job_qc','Hậu xử lý hoàn tất',0,-40),
        ('job_qc','job_completed','[QC đạt từng allocation]',0,-40),
        ('job_qc','job_failed','[QC không đạt]',0,-45),
        ('job_failed','job_preparing','Duyệt lượt in lại\n/ ActualRun mới',-.2,100),
        ('job_queued','job_cancelled','Duyệt hủy',0,-40),
        ('job_completed','job_final','',0,0),
        ('job_cancelled','job_final','',0,0),
    ],[('plan_heading','ProductionPlan',100,160),('job_heading','PrintJob',100,1420)])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=OOAD / 'exports/MinhLab_Elaboration_Reviewed.drawio')
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        parser.error('Source and reviewed output must be different paths')
    original = ET.parse(args.source).getroot()
    if len(original.findall('diagram')) != 29:
        parser.error('Select the documented 29-page canonical source; do not silently merge versions')
    doc = copy.deepcopy(original)
    pages = {p.get('id'): p for p in doc.findall('diagram')}
    change = {}

    cases = {
        'd-uc00': (['Khách vãng lai', 'Khách hàng', 'Nhân viên', 'Thợ vận hành', 'Nhân viên duyệt tệp', 'Quản trị viên'],
            ['Xem danh mục sản phẩm và ước tính STL', 'Đặt hàng danh mục sản phẩm VietQR', 'Tra cứu đơn theo quyền',
             'Đối soát thanh toán thủ công', 'Cập nhật hoàn thiện đơn', 'Quản lý danh mục sản phẩm',
             'Duyệt tệp và báo giá [DESIGNED]', 'Duyệt kế hoạch danh mục sản phẩm [DESIGNED]'],
            [(0,0),(1,0),(0,1),(1,1),(0,2),(1,2),(2,3),(3,4),(5,5),(4,6),(1,6),(5,7)], (), 'MIXED'),
        'd-uc01': (['Khách vãng lai'], ['Xem sản phẩm', 'Xem chi tiết sản phẩm', 'Quản lý giỏ hàng',
            'Đặt hàng danh mục sản phẩm VietQR', 'Tra cứu đơn bằng token', 'Ước tính giá in STL', 'Đăng ký tài khoản', 'Liên hệ tư vấn'],
            [(0,i) for i in range(8)], (), 'CURRENT'),
        'd-uc02': (['Khách hàng'], ['Quản lý giỏ hàng', 'Đặt hàng danh mục sản phẩm VietQR', 'Đăng nhập',
            'Xem hướng dẫn chuyển khoản', 'Khai báo chuyển khoản qua API tương thích', 'Theo dõi đơn của mình', 'Xem lịch sử đơn'],
            [(0,i) for i in range(7)], (), 'CURRENT'),
        'd-uc03': (['Nhân viên'], ['Tra cứu đơn hàng', 'Xem khoản chờ thanh toán',
            'Xác nhận thanh toán sau đối chiếu thủ công', 'Từ chối khai báo có lý do', 'Điều phối đơn theo quyền'],
            [(0,i) for i in range(5)], (), 'CURRENT'),
        'd-uc04': (['Thợ vận hành'], ['Xem hàng đợi đơn đang chế tác', 'Xác nhận IN_PRODUCTION → READY_TO_SHIP',
            'Xem job và lượt chạy [DESIGNED]', 'Ghi QC và yêu cầu in lại [DESIGNED]'],
            [(0,i) for i in range(4)], (), 'MIXED'),
        'd-uc05': (['Nhân viên duyệt tệp'], ['Xem yêu cầu in STL', 'Thẩm định yêu cầu in',
            'Kiểm tra STL và quyền sử dụng', 'Đánh giá tính khả thi in', 'Yêu cầu cập nhật tệp',
            'Phát hành báo giá chính thức', 'Chốt thông số và đơn giá'],
            [(0,0),(0,1),(0,4),(0,5)], [(1,2),(1,3),(5,6)], 'DESIGNED'),
        'd-uc06': (['Quản trị viên'], ['Quản lý và xuất bản danh mục sản phẩm', 'Đối soát thanh toán thủ công',
            'Điều phối đơn theo policy', 'Rà soát đề xuất kế hoạch [DESIGNED]',
            'Áp dụng kế hoạch đã duyệt [DESIGNED]', 'Kiểm lại quyền, key và snapshot [DESIGNED]'],
            [(0,i) for i in range(5)], [(4,5)], 'MIXED'),
        'd-uc07': (['Khách hàng', 'Nhân viên duyệt tệp'], ['Gửi yêu cầu in STL', 'Tải STL và khai báo thông số',
            'Xem báo giá', 'Chấp thuận snapshot báo giá', 'Phát hành báo giá chính thức',
            'Checkout từ báo giá đã chấp thuận'], [(0,0),(0,2),(0,3),(0,5),(1,4)], [(0,1)], 'DESIGNED'),
        'd-uc08': (['Dịch vụ email', 'Telegram Bot API'], ['Gửi liên kết tài khoản và thông báo khách hàng',
            'Gửi cảnh báo đơn và đối soát sau commit'], [(0,0),(1,1)], (), 'CURRENT'),
        'd-el02': (['Khách vãng lai', 'Khách hàng', 'Nhân viên'], ['Đặt hàng danh mục sản phẩm',
            'Kiểm tra giỏ, đơn giá và địa chỉ', 'Xem hướng dẫn VietQR', 'Khai báo qua API tương thích',
            'Xác nhận sau đối chiếu ngân hàng thủ công'], [(0,0),(1,0),(0,2),(1,2),(0,3),(1,3),(2,4)], [(0,1)], 'CURRENT'),
        'd-el04': (['Quản trị viên', 'Thợ vận hành'], ['Xem đề xuất gom mẻ danh mục sản phẩm', 'Rà soát bằng chứng slicer',
            'Duyệt hoặc từ chối đề xuất', 'Áp dụng đề xuất đã duyệt', 'Kiểm quyền, key và snapshot trong transaction',
            'Vận hành công việc đã phát hành'], [(0,0),(0,1),(0,2),(0,3),(1,5)], [(3,4)], 'DESIGNED'),
    }
    for key, (actors, goals, assocs, includes, status) in cases.items():
        render(pages[key], use_cases(actors, goals, assocs, includes), 'Use case', status)
        change[key] = 'Chuẩn hóa actor, quyền, mục tiêu; tách CURRENT/DESIGNED; bỏ kế thừa guest và include Đăng nhập.'
    render(pages['d-el03'], (OOAD/'diagrams/current/D06-use-case-stl-handoff.puml').read_text(), 'Use case', 'CURRENT')
    change['d-el03'] = 'STL advisory và bàn giao tư vấn; không tự tạo yêu cầu/báo giá chính thức.'
    # Leave wide straight-line corridors so shared public goals do not obscure other ovals.
    overview=pages['d-uc00']
    positions={'U0':(650,300,600,120),'U1':(650,560,600,120),'U2':(650,820,600,120),
               'U6':(1000,1250,600,120),'U3':(1500,300,600,120),'U4':(1500,560,600,120),
               'U5':(1500,820,600,120),'U7':(1500,1080,600,120),
               'A0':(100,450,80,100),'A1':(100,900,80,100),'A2':(2600,310,80,100),
               'A3':(2600,570,80,100),'A4':(2600,1280,80,100),'A5':(2600,1010,80,100),
               'system_boundary':(500,180,1850,1350)}
    for key,(x,y,w,h) in positions.items():
        g=cell(overview,key).find('mxGeometry')
        for attr,value in [('x',x),('y',y),('width',w),('height',h)]:g.set(attr,str(value))
        if key.startswith('A'):
            g=cell(overview,key+'_label').find('mxGeometry');g.set('x',str(x-80));g.set('y',str(y+110))
    cell(overview,'boundary_title').find('mxGeometry').set('x','540')

    # Existing commercial schema: shipping is an Order snapshot; no invented bank table.
    erd(pages['minhlab-erd02'], {
        'USERS': ['id: uuid PK', 'email_normalized: varchar UK'],
        'ORDERS': ['id: uuid PK', 'customer_id: uuid? FK', 'order_number: varchar UK', 'shipping_address_line: varchar', 'grand_total: numeric(14,2)'],
        'ORDER_ITEMS': ['id: uuid PK', 'order_id: uuid FK', 'product_variant_id: uuid? FK', 'quantity: int', 'unit_price: numeric(12,2)', 'line_total: numeric(14,2)'],
        'PAYMENTS': ['id: uuid PK', 'order_id: uuid FK', 'verification_status: varchar', 'transaction_reference: varchar?', 'receiving_account: jsonb?'],
        'ORDER_TRACKING_TOKENS': ['id: uuid PK', 'order_id: uuid FK', 'token_hash: char(64) UK', 'expires_at: timestamptz'],
        'PRODUCTS': ['id: uuid PK', 'publication_status: varchar', 'compliance_status: varchar'],
        'PRODUCT_VARIANTS': ['id: uuid PK', 'product_id: uuid FK', 'sku: varchar UK', 'sale_price: numeric(12,2)'],
    }, [('USERS','ORDERS','0..1','0..*','customer_id'), ('ORDERS','ORDER_ITEMS','1','0..*','order_id'),
        ('ORDERS','PAYMENTS','1','0..*','order_id'), ('ORDERS','ORDER_TRACKING_TOKENS','1','0..*','order_id'),
        ('PRODUCTS','PRODUCT_VARIANTS','1','0..*','product_id'),
        ('PRODUCT_VARIANTS','ORDER_ITEMS','0..1','0..*','product_variant_id')], 'CURRENT')
    change['minhlab-erd02'] = 'Khớp migrations: guest nullable; địa chỉ là snapshot; bỏ bảng bank/shipping tưởng tượng.'
    label(pages['minhlab-erd01'], 'erd01-0007', 'PK id: uuid\nFK product_id: uuid NOT NULL\nUK sku: varchar\nsale_price: numeric(12,2)')
    change['minhlab-erd01'] = 'Bổ sung khóa duy nhất SKU và nullability có trong schema.'

    p = pages['elab-05']
    label(p, 'el05-0007', '- id: UUID\n- customerId: UUID?\n- grandTotal: Money {readOnly}\n- status: OrderStatus')
    label(p, 'el05-0011', '- id: UUID\n- quantity: int\n- unitPrice: Money {readOnly}\n- lineTotal: Money {readOnly}')
    label(p, 'el05-0018', 'ShippingSnapshot')
    label(p, 'el05-0026', 'OrderHistoryEntry')
    remove(p, *[f'el05-{i:04d}' for i in range(41,47)])
    for key, left, right in [('el05-0034','0..1','0..*'),('el05-0035','1','1..*'),
            ('el05-0036','0..*','0..1'),('el05-0037','1','0..*'),('el05-0038','1','0..*'),
            ('el05-0039','1','1'),('el05-0040','1','0..*')]:
        multiplicity(p,key,left,right)
    style(p,'el05-0037',startArrow='none')
    style(p,'el05-0038',startArrow='none')
    label(p,'el05-0003','- id: UUID\n- email: String\n- roles: RoleCode[]')
    change['elab-05'] = 'Multiplicity ở hai đầu; optional guest/variant; giá snapshot; chỉ giữ composition có nghĩa sở hữu.'
    render(pages['elab-06'], (OOAD/'diagrams/designed/E02-domain-class-custom-print.puml').read_text(), 'Class', 'DESIGNED')
    change['elab-06'] = 'Dùng model file/attachment/specification/quote/approval có revision; không suy sở hữu file từ FK.'
    production = (OOAD/'diagrams/designed/E10-design-class-production-planning.puml').read_text()
    model = exporter.parse_generic(production)
    kept = {'ProductionPlan','BatchCandidate','CandidateAllocation','ProductionRequirement','JobAllocation','OrderItem','BomLine','ProductionJob'}
    model.nodes = type(model.nodes)((k,v) for k,v in model.nodes.items() if k in kept)
    model.links = [l for l in model.links if l.source in kept and l.target in kept]
    c = exporter.class_pages(model, {'ID':'elab-07','Name':'EL07. Kế hoạch, nhu cầu và JobAllocation — DESIGNED','Status':'DESIGNED'})[0]
    pages['elab-07'][:] = list(c.finish())
    change['elab-07'] = 'Phân biệt candidate với JobAllocation thực thi; truy vết nhiều đơn; không gán composition Plan–Job.'

    for key in ['elab-08','elab-09','elab-10']:
        p = pages[key]
        for decision in [n for n in list(model_root(p)) if 'rhombus' in n.get('style','')]:
            outgoing = [e for e in model_root(p) if e.get('source') == decision.get('id')]
            if len(outgoing) == 2:
                existing = ' '.join(e.get('value','') for e in outgoing)
                for e in outgoing:
                    if not e.get('value'):
                        e.set('value','[Không]' if '[Có]' in existing else '[Có]')
        change[key] = 'Guard đầy đủ và merge cho các nhánh thay thế; giữ native geometry.'
    p = pages['elab-08']
    label(p,'el08-0003','Đọc phiên nếu có; guest được đặt danh mục sản phẩm')
    label(p,'el08-0023','Đơn giá nguyên VND từ server; khai báo qua API tương thích không chứng minh tiền đã về.')
    merge_before(p,'el08-0004','audit_cart_merge')
    p = pages['elab-10']
    label(p,'el10-0003','Chọn READY_PRODUCT đủ điều kiện; phân bổ thành phẩm trước, chốt BOM/spec revision')
    label(p,'el10-0008','Đủ slicer evidence, vật tư và snapshot hợp lệ?')
    label(p,'el10-0009','Giữ chặn / STALE_PLAN; lập lại từ nguồn hiện hành')
    label(p,'el10-0013','BEGIN; khóa plan/key; kiểm lại quyền và nội dung key')
    cell(p,'el10-0014').find('mxGeometry').set('y','3650')
    label(p,'el10-0030','DESIGNED — chưa có runtime apply plan; retry không tạo hiệu ứng lần hai; AI chỉ đề xuất.')
    cell(p,'el10-0030').find('mxGeometry').set('y','3810')
    # Keep old cell ID for the atomic operation; add guarded outcomes below it.
    cell(p,'el10-0023').set('target','audit_plan_gate')
    vertex(p,'audit_plan_gate','Quyền và nội dung key hợp lệ?',1300,2050,360,200,'decision')
    vertex(p,'audit_plan_existing','Cùng key/revision đã COMMIT?\n[đối chiếu nội dung key]',1300,2350,360,200,'decision')
    vertex(p,'audit_plan_return','COMMIT; trả kết quả cũ; không ghi job/allocation mới',2100,2370,660,110)
    vertex(p,'audit_plan_snapshot','Khóa/tải lại nguồn; version, quantity, slot và slicer evidence hiện hành?',1300,2630,360,200,'decision')
    vertex(p,'audit_plan_write','Ghi job, JobAllocation, reservation, audit và key duy nhất',1090,2950,750,110)
    vertex(p,'audit_plan_written','Tất cả bước ghi thành công?',1300,3150,360,180,'decision')
    vertex(p,'audit_plan_commit','COMMIT → APPROVED',1090,3450,750,90)
    vertex(p,'audit_plan_rollback','Không ghi tác động sản xuất; stale giữ audit; lỗi DB/key/quyền thì ROLLBACK',2100,3150,660,145)
    edge(p,'audit_gate_yes','audit_plan_gate','audit_plan_existing','[Có]')
    edge(p,'audit_gate_no','audit_plan_gate','audit_plan_rollback','[Không / conflict]')
    edge(p,'audit_existing_yes','audit_plan_existing','audit_plan_return','[Có]')
    edge(p,'audit_existing_no','audit_plan_existing','audit_plan_snapshot','[Chưa]')
    edge(p,'audit_snapshot_yes','audit_plan_snapshot','audit_plan_write','[Có]')
    edge(p,'audit_snapshot_no','audit_plan_snapshot','audit_plan_rollback','[STALE_PLAN]')
    edge(p,'audit_return_end','audit_plan_return','el10-0014')
    edge(p,'audit_written','audit_plan_write','audit_plan_written')
    edge(p,'audit_write_ok','audit_plan_written','audit_plan_commit','[Có]')
    edge(p,'audit_write_fail','audit_plan_written','audit_plan_rollback','[Lỗi DB]')
    edge(p,'audit_commit_end','audit_plan_commit','el10-0014')
    edge(p,'audit_rollback_end','audit_plan_rollback','el10-0014')
    merge_before(p,'el10-0003','audit_plan_merge')
    change['elab-10'] += ' Atomic apply kiểm lại trong transaction, key/revision, stale, rollback và replay.'

    p = pages['elab-11']
    cell(p,'el11-0009').set('source','el11-0002')
    label(p,'el11-0005','computeQuote / Ridge trong hook trình duyệt')
    label(p,'el11-0011','CURRENT — worker trả MeshFeatures; ước tính không là Quote chính thức; PostgreSQL lưu commerce.')
    change['elab-11'] = 'Chuyển Ridge về trình duyệt; phân biệt mesh worker với inference.'
    erd(pages['elab-12'], {
        'ORDERS':['id: uuid PK','customer_id: uuid? FK','shipping_snapshot: embedded','grand_total: numeric'],
        'ORDER_ITEMS':['id: uuid PK','order_id: uuid FK','product_variant_id: uuid? FK','unit_price: numeric'],
        'PAYMENTS':['id: uuid PK','order_id: uuid FK','verification_status: varchar'],
        'PRODUCTION_PLANS':['id: uuid PK','revision: int','input_version_hash: varchar','status: PlanStatus'],
        'BATCH_CANDIDATES':['id: uuid PK','plan_id: uuid FK','technology: varchar','material_id: uuid FK'],
        'PRODUCTION_REQUIREMENTS':['id: uuid PK','order_item_id: uuid FK','bom_line_id: uuid FK','component_revision_id: uuid FK','spec_revision_id: uuid FK','required_qty: int'],
        'CANDIDATE_ALLOCATIONS':['id: uuid PK','candidate_id: uuid FK','requirement_id: uuid FK','quantity: int'],
        'PRODUCTION_JOBS':['id: uuid PK','approved_plan_id: uuid FK','printer_id: uuid? FK','status: JobStatus'],
        'JOB_ALLOCATIONS':['id: uuid PK','production_job_id: uuid FK','requirement_id: uuid FK','quantity: int'],
        'ACTUAL_RUNS':['id: uuid PK','production_job_id: uuid FK','attempt_number: int','actual_settings: jsonb'],
        'QC_RESULTS':['id: uuid PK','actual_run_id: uuid FK','job_allocation_id: uuid FK','passed_qty: int','failed_qty: int'],
        'PRINTERS':['id: uuid PK','technology: varchar','capabilities: jsonb'],
        'MATERIALS':['id: uuid PK','technology: varchar','material_identity: varchar','color_identity: varchar'],
        'BOM_LINES':['id: uuid PK','bom_revision_id: uuid','component_revision_id: uuid FK','quantity_per_unit: int'],
        'COMPONENT_REVISIONS':['id: uuid PK','design_id: uuid','file_hash: char(64)'],
        'SPEC_REVISIONS':['id: uuid PK','technology: varchar','material_id: uuid FK','profile_hash: varchar'],
    }, [('ORDERS','ORDER_ITEMS','1','0..*','order_id'),('ORDERS','PAYMENTS','1','0..*','order_id'),
        ('ORDER_ITEMS','PRODUCTION_REQUIREMENTS','1','0..*','order_item_id'),
        ('PRODUCTION_PLANS','BATCH_CANDIDATES','1','0..*','plan_id'),
        ('BATCH_CANDIDATES','CANDIDATE_ALLOCATIONS','1','0..*','candidate_id'),
        ('PRODUCTION_REQUIREMENTS','CANDIDATE_ALLOCATIONS','1','0..*','requirement_id'),
        ('PRODUCTION_PLANS','PRODUCTION_JOBS','1','0..*','approved_plan_id'),
        ('PRODUCTION_REQUIREMENTS','JOB_ALLOCATIONS','1','0..*','requirement_id'),
        ('PRODUCTION_JOBS','JOB_ALLOCATIONS','1','0..*','production_job_id'),
        ('PRODUCTION_JOBS','ACTUAL_RUNS','1','0..*','production_job_id'),
        ('ACTUAL_RUNS','QC_RESULTS','1','0..*','actual_run_id'),('JOB_ALLOCATIONS','QC_RESULTS','1','0..*','job_allocation_id'),
        ('PRINTERS','PRODUCTION_JOBS','0..1','0..*','printer_id'),
        ('MATERIALS','BATCH_CANDIDATES','1','0..*','material_id'),
        ('BOM_LINES','PRODUCTION_REQUIREMENTS','1','0..*','bom_line_id'),
        ('COMPONENT_REVISIONS','BOM_LINES','1','0..*','component_revision_id'),
        ('COMPONENT_REVISIONS','PRODUCTION_REQUIREMENTS','1','0..*','component_revision_id'),
        ('SPEC_REVISIONS','PRODUCTION_REQUIREMENTS','1','0..*','spec_revision_id'),
        ('MATERIALS','SPEC_REVISIONS','1','0..*','material_id')], 'DESIGN_PROPOSAL — tên vật lý chưa chốt; không phải migration')
    change['elab-12'] = 'Mô hình logic đề xuất cho traceability; bỏ bank/shipping giả; allocation và actual run/QC tách riêng.'

    render(pages['elab-13'], (OOAD/'diagrams/current/D28-sequence-stl-analysis.puml').read_text(), 'Sequence', 'CURRENT')
    render(pages['d-el15'], '''@startuml
actor "Khách / chủ đơn" as Customer
participant "Web / API" as API
database "Order transaction / PostgreSQL" as DB
actor "Nhân viên STAFF/ADMIN" as Staff
participant "Ứng dụng ngân hàng ngoài website" as Bank
Customer -> API : Đặt danh mục sản phẩm; session tùy chọn; Idempotency-Key
API -> DB : BEGIN; khóa key; kiểm giá server và tạo snapshot
alt dữ liệu hoặc DB/outbox lỗi
 DB --> API : ROLLBACK; không có đơn mới
 API --> Customer : Lỗi hoặc conflict
else tạo mới hoặc replay hợp lệ
 DB --> API : COMMIT; Order PENDING_PAYMENT, Payment PENDING, token
 API --> Customer : Mã đơn và hướng dẫn VietQR
opt khách dùng API khai báo tương thích và có quyền
 Customer -> API : Khai báo chuyển khoản kèm owner session hoặc token
 API -> DB : Lưu khai báo, URL proof bất biến, audit/outbox; COMMIT
 API --> Customer : PENDING; chưa xác nhận đã nhận tiền
end
Staff -> Bank : Kiểm giao dịch thực tế thủ công
Bank --> Staff : Kết quả đối chiếu trong ứng dụng ngân hàng
Staff -> API : Xác nhận hoặc từ chối với phiên có quyền
API -> DB : BEGIN; khóa order/payment; kiểm trạng thái và số tiền
alt đã VERIFIED
 DB --> API : COMMIT; trả kết quả cũ; không lặp hiệu ứng
else xác nhận hợp lệ
 API -> DB : VERIFIED / PAID / CONFIRMED; audit và outbox; COMMIT
 DB --> API : Kết quả đã commit
else từ chối hợp lệ
 API -> DB : REJECTED có lý do và audit; COMMIT
else sai quyền/trạng thái hoặc lỗi ghi
 DB --> API : ROLLBACK; không ghi tác động một phần
end
API --> Staff : Kết quả đối soát
end
@enduml''', 'Sequence', 'CURRENT')
    change['elab-13'] = 'alt lỗi mesh; worker trả features; computeQuote ở browser; không lưu tệp qua API.'
    change['d-el15'] = 'Không gọi bank API; opt khai báo; khóa/commit/idempotency/error trước phản hồi.'
    p = pages['d-el14']
    for i in range(2,10):
        style(p,f'el14-{i:04d}',shape='component')
    label(p,'el14-0001','EL14. COMPONENT — DESIGN_PROPOSAL; hạ tầng chưa chốt')
    label(p,'el14-0009','Email / Telegram adapters\nĐối soát ngân hàng vẫn thủ công')
    label(p,'el14-0005','Kho tệp riêng tư — công nghệ chưa chốt')
    change['d-el14'] = 'Đúng ký hiệu component; gỡ nguồn giao dịch ngân hàng tưởng tượng; hạ tầng chỉ đề xuất.'

    p = pages['d-el16']
    label(p,'el16-0004','PENDING_PAYMENT')
    label(p,'el16-0010','STAFF/ADMIN xác nhận sau đối chiếu thủ công')
    label(p,'el16-0011','STAFF/ADMIN [PAID hoặc COD lịch sử]')
    remove(p,'el16-0012','el16-0017')
    vertex(p,'audit_ready','READY_TO_SHIP',1610,520,455,100,'state')
    vertex(p,'audit_shipped','SHIPPED',2240,520,455,100,'state')
    vertex(p,'audit_deposit','DEPOSIT_PAID',325,520,455,100,'state')
    edge(p,'audit_legacy_deposit','audit_deposit','el16-0005','ADMIN [đơn đặt cọc lịch sử]')
    edge(p,'audit_cancel_deposit','audit_deposit','el16-0008','STAFF/ADMIN [UNPAID]')
    edge(p,'audit_cancel_confirmed','el16-0005','el16-0008','STAFF/ADMIN [UNPAID]')
    edge(p,'audit_cancel_production','el16-0006','el16-0008','ADMIN [UNPAID]')
    edge(p,'audit_cancel_ready','audit_ready','el16-0008','ADMIN [UNPAID]')
    edge(p,'audit_order_ready','el16-0006','audit_ready','PRINT_OPERATOR/ADMIN')
    edge(p,'audit_order_ship','audit_ready','audit_shipped','STAFF/ADMIN')
    edge(p,'audit_order_complete','audit_shipped','el16-0007','STAFF/ADMIN; COD cũ ghi nhận thu tiền')
    edge(p,'audit_declare','el16-0016','el16-0016','Khai báo hợp lệ / giữ PENDING')
    edge(p,'audit_reject','el16-0016','el16-0019','STAFF/ADMIN từ chối kèm lý do')
    edge(p,'audit_redeclare','el16-0019','el16-0016','Khai báo lại [đơn còn chờ, có quyền]')
    label(p,'el16-0024','STAFF/ADMIN [đối chiếu đúng tiền; đơn còn chờ]')
    for c in list(model_root(p)):
        if c.get('vertex') == '1' and c.get('value') in {'PENDING_PAYMENT','CONFIRMED','IN_PRODUCTION','COMPLETED','CANCELLED','PENDING','VERIFIED','REJECTED'}:
            style(p,c.get('id'),rounded=1,arcSize=16)
    change['d-el16'] = 'Trạng thái commerce hiện hành; DECLARED là event; thêm READY_TO_SHIP/SHIPPED và guards.'
    p = pages['d-el17']
    label(p,'el17-0001','EL17. STATE — DESIGNED; chưa có planner/job workflow runtime')
    for key, value in [('el17-0006','STALE_PLAN'),('el17-0012','QUEUED'),('el17-0013','PRINTING'),
                       ('el17-0015','COMPLETED'),('el17-0016','FAILED')]:
        label(p,key,value)
    label(p,'el17-0007','B01–B12 + slicer evidence hợp lệ')
    label(p,'el17-0008','ADMIN duyệt [snapshot/key hiện hành trong atomic apply] / COMMIT')
    label(p,'el17-0009','Nguồn/evidence cũ / không tạo job hoặc reservation')
    label(p,'el17-0017','Thợ bắt đầu lượt in đã được phép')
    label(p,'el17-0018','Kết thúc in và hậu xử lý')
    label(p,'el17-0019','QC đạt từng allocation')
    label(p,'el17-0021','Người có quyền duyệt lượt in lại / giữ lịch sử ActualRun')
    vertex(p,'audit_rejected','REJECTED',1740,555,455,94,'state')
    edge(p,'audit_plan_reject','el17-0004','audit_rejected','ADMIN từ chối / lưu lý do')
    remove(p,'el17-0010')
    vertex(p,'audit_plan_final','',2330,570,45,45,'final')
    edge(p,'audit_approved_final','el17-0005','audit_plan_final','COMMIT xong')
    edge(p,'audit_rejected_final','audit_rejected','audit_plan_final','Giữ lịch sử quyết định')
    edge(p,'audit_stale_final','el17-0006','audit_plan_final','Giữ bản stale; lập revision mới')
    vertex(p,'audit_preparing','PREPARING',205,1250,455,94,'state')
    vertex(p,'audit_postprocess','POST_PROCESSING',950,1250,455,94,'state')
    vertex(p,'audit_job_cancelled','CANCELLED',2280,1320,360,94,'state')
    cell(p,'el17-0017').set('target','audit_preparing')
    cell(p,'el17-0018').set('target','audit_postprocess')
    edge(p,'audit_begin_print','audit_preparing','el17-0013','Thợ khởi động máy thủ công')
    edge(p,'audit_post_qc','audit_postprocess','el17-0014','Hậu xử lý hoàn tất')
    edge(p,'audit_cancel_job','el17-0012','audit_job_cancelled','Hủy có thẩm quyền; policy chi tiết NEEDS_DECISION')
    vertex(p,'audit_plan_initial','',110,318,40,40,'start')
    edge(p,'audit_plan_start','audit_plan_initial','el17-0003','Tạo draft')
    vertex(p,'audit_job_initial','',110,1037,40,40,'start')
    edge(p,'audit_job_start','audit_job_initial','el17-0012','Atomic apply đã COMMIT')
    vertex(p,'audit_job_final','',2690,1170,45,45,'final')
    edge(p,'audit_completed_final','el17-0015','audit_job_final')
    edge(p,'audit_cancelled_final','audit_job_cancelled','audit_job_final')
    label(p,'el17-0022','DESIGNED — giữ lịch sử ActualRun/QC theo allocation; retry không tạo job lần hai; policy hủy job cần chốt.')
    for c in list(model_root(p)):
        if c.get('vertex')=='1' and c.get('id') not in {'el17-0001','el17-0002','el17-0011','el17-0022'}:
            style(p,c.get('id'),rounded=1,arcSize=16)
    change['d-el17'] = 'Map tên trạng thái về schema/design; rejection/stale/reprint rõ; không cam kết runtime hoặc composition.'
    p = pages['d-el18']
    for key, value in {
        'el18-0003':'Tiền điều kiện: Guest hoặc session hợp lệ; giỏ hợp lệ; giá authoritative từ DB',
        'el18-0005':'Ngoại lệ: Mặt hàng không được bán, giá không hợp lệ, key conflict hoặc DB/outbox lỗi → không tạo đơn',
        'el18-0006':'Hậu điều kiện: COMMIT Order PENDING_PAYMENT; Payment PENDING; có tracking token',
        'el18-0008':'DESIGNED: Quote SENT còn hạn, đúng chủ; acceptance snapshot/revision cần được kiểm',
        'el18-0009':'Khách chấp thuận snapshot; checkout riêng kiểm lại owner/spec/quote; không coi giá STL là Quote',
        'el18-0011':'DESIGNED: Chấp thuận và đơn được truy vết; lượng/hiệu lực acceptance còn cần chốt policy',
        'el18-0013':'Tiền điều kiện: STAFF/ADMIN có quyền; đã đối chiếu giao dịch thật ngoài website',
        'el18-0014':'API khóa order/payment; kiểm trạng thái/số tiền; ghi VERIFIED / PAID / CONFIRMED và COMMIT',
        'el18-0015':'Sai quyền/trạng thái hoặc DB lỗi: từ chối/ROLLBACK; quyết định từ chối hợp lệ dùng REJECTED',
    }.items(): label(p,key,value)
    change['d-el18'] = 'Đặc tả đồng bộ guest, tiền VND, commit, manual reconciliation và quote còn cần quyết định.'
    p = pages['d-el19']
    for key,value in {
        'el19-0001':'EL19. ĐẶC TẢ — production DESIGNED; ước tính STL CURRENT',
        'el19-0003':'DESIGNED: ADMIN đủ quyền; READY_PRODUCT; thành phẩm/BOM/spec revision và evidence được chốt',
        'el19-0004':'BEGIN; khóa plan/key/nguồn; đọc lại snapshot; ghi job/allocation/reservation/audit; COMMIT APPROVED',
        'el19-0005':'Stale/key conflict/sai quyền/lỗi DB: không tạo tác động một phần; retry hợp lệ trả kết quả cũ',
        'el19-0006':'Chưa có runtime; acceptance cases và các race test bắt buộc nằm trong ELABORATION_TRACEABILITY.md',
        'el19-0008':'DESIGNED: Thợ được phân công; job QUEUED từ plan đã áp dụng',
        'el19-0009':'QUEUED → PRINTING → QC_PENDING → COMPLETED; giữ từng ActualRun và allocation',
        'el19-0010':'QC lỗi: FAILED; duyệt lượt in lại; chỉ sản xuất lượng thiếu, không ghi đè lượt cũ',
    }.items(): label(p,key,value)
    change['d-el19'] = 'Đặc tả atomic plan apply và traceability; tách phạm vi chưa triển khai khỏi STL hiện tại.'

    # Submission view: names only on relationship pages. The complete attributes,
    # PK/FK evidence and CURRENT/DESIGNED distinction remain in source + reports.
    names_and_relations(pages['elab-05'], 'EL05. Class Diagram — Đơn hàng và thanh toán', {
        'User':(100,210,330,110), 'Order':(660,380,350,110),
        'OrderItem':(1250,355,350,110), 'ProductVariant':(1810,185,420,110),
        'Product':(1830,650,350,110), 'Payment':(690,790,350,110),
        'ShippingSnapshot':(90,745,430,110), 'OrderTrackingToken':(1210,800,460,110),
    }, [('User','Order','0..1','0..*','association'),('Order','OrderItem','1','1..*','composition'),
        ('ProductVariant','OrderItem','0..1','0..*','association'),('Product','ProductVariant','1','0..*','association'),
        ('Order','Payment','1','0..*','association'),('Order','ShippingSnapshot','1','1','composition'),
        ('Order','OrderTrackingToken','1','0..*','association')])
    change['elab-05']='Tên lớp và bội số UML; guest/variant optional; ShippingSnapshot là value object; không dùng Crow’s Foot hoặc suy composition từ FK.'
    source=(OOAD/'diagrams/designed/E02-domain-class-custom-print.puml').read_text()
    class_names_from_source(pages['elab-06'],source,'EL06. Class Diagram — Yêu cầu in và báo giá',{
        'User':(90,210,320,110),'PrintRequest':(630,230,400,110),
        'PrintRequestItem':(1190,200,430,110),'FileInspection':(1800,200,420,110),
        'CustomerApproval':(95,650,450,110),'Quote':(680,650,350,110),
        'QuoteItem':(1200,630,360,110),'PrintSpecification':(1770,670,470,110),
        'Order':(95,1130,340,110),'OrderItem':(690,1120,350,110),
        'FileAsset':(2380,1120,360,110),'Attachment':(2350,640,400,110),
        'Material':(1770,1130,360,110),
    })
    class_names_from_source(pages['elab-07'],production,'EL07. Class Diagram — Kế hoạch và phân bổ sản xuất',{
        'ProductionPlan':(100,205,420,110),'BatchCandidate':(760,230,430,110),
        'CandidateAllocation':(1450,200,500,110),'ProductionRequirement':(1420,670,580,110),
        'OrderItem':(760,650,390,110),'BomLine':(2290,660,350,110),
        'ProductionJob':(110,1130,420,110),'JobAllocation':(780,1110,420,110),
    })
    # ERD endpoints below are actual database FK optionality, not domain minimums.
    names_and_relations(pages['minhlab-erd01'],'ERD01. Danh mục sản phẩm',{
        'categories':(100,220,380,110),'products':(800,245,380,110),
        'product_variants':(1540,220,460,110),'materials':(1560,700,380,110),
        'product_images':(780,710,440,110),
    }, [('categories','products','1','0..*',''),('products','product_variants','1','0..*',''),
        ('materials','product_variants','0..1','0..*',''),('products','product_images','1','0..*',''),
        ('categories','categories','0..1','0..*','')],physical=True)
    names_and_relations(pages['minhlab-erd02'],'ERD02. Đơn hàng và thanh toán',{
        'users':(90,220,330,110),'orders':(740,235,370,110),
        'order_items':(1410,205,410,110),'product_variants':(2050,225,470,110),
        'shipments':(90,740,370,110),'payments':(760,755,370,110),
        'order_tracking_tokens':(1380,730,570,110),'products':(2110,745,370,110),
        'refunds':(780,1250,350,110),
    }, [('users','orders','0..1','0..*',''),('orders','order_items','1','0..*',''),
        ('orders','payments','1','0..*',''),('orders','shipments','1','0..*',''),
        ('orders','order_tracking_tokens','1','0..*',''),('payments','refunds','1','0..*',''),
        ('product_variants','order_items','0..1','0..*',''),('products','product_variants','1','0..*','')],physical=True)
    change['minhlab-erd02']='ERD subset schema có thật; shipments/refunds có bảng nhưng chưa chứng minh workflow; snapshot địa chỉ nằm trong orders; không vẽ ngân hàng API.'
    names_and_relations(pages['elab-12'],'EL12. ERD — Sản xuất',{
        'order_items':(100,220,400,110),'production_jobs':(830,240,460,110),
        'printers':(1640,210,350,110),'users':(100,1300,330,110),
        'quality_inspections':(20,790,460,110),'production_attempts':(800,775,570,110),
        'materials':(1600,780,390,110),'attachments':(1570,1300,420,110),
        'file_assets':(2230,1300,380,110),
    }, [('order_items','production_jobs','1','0..*',''),
        ('printers','production_jobs','0..1','0..*',''),('materials','production_jobs','0..1','0..*',''),
        ('users','production_jobs','0..1','0..*',''),('production_jobs','production_attempts','1','0..*',''),
        ('production_jobs','quality_inspections','1','0..*',''),('users','quality_inspections','1','0..*',''),
        ('printers','production_attempts','1','0..*',''),('materials','production_attempts','1','0..*',''),
        ('users','production_attempts','1','0..*',''),('attachments','production_attempts','0..1','0..*',''),
        ('file_assets','attachments','1','0..*','')],physical=True)
    change['elab-12']='Đối chiếu 001_init: job thuộc một order_item; attempt thuộc job; QC liên kết job, không có FK tới attempt/allocation. Mô hình nhiều đơn chỉ ở EL07 và thiết kế.'
    # Remove canvas commentary; leave functional guards/messages on behavior pages.
    for key, ids in {'elab-08':['el08-0023'],'elab-09':['el09-0023'],
            'elab-10':['el10-0030'],'elab-11':['el11-0011'],
            'd-el14':['el14-0017'],'d-el17':['el17-0022']}.items():
        remove(pages[key],*ids)
    label(pages['d-el14'],'el14-0001','EL14. Component — Kiến trúc mục tiêu')
    label(pages['d-el14'],'el14-0009','Email / Telegram adapters')
    label(pages['d-el17'],'el17-0001','EL17. State — ProductionPlan và PrintJob')
    reviewed_states(pages)
    # Return paths enter a merge beside the first action; a centered merge above
    # it makes a straight retry connector cut through the action's rectangle.
    for page_id,merge_id,x,y in [('elab-08','audit_cart_merge',650,435),
                                ('elab-10','audit_plan_merge',840,245)]:
        g=cell(pages[page_id],merge_id).find('mxGeometry')
        g.set('x',str(x));g.set('y',str(y))
    # Alternative failures end this invocation at their own activity final.
    # They must not pass through successful actions to reach a distant final.
    p=pages['elab-09']
    for action,key,x,y in [('el09-0005','audit_stl_invalid_final',350,600),
                           ('el09-0008','audit_stl_analysis_final',350,1020)]:
        vertex(p,key,'',x,y,48,48,'final')
        for e in model_root(p):
            if e.get('source')==action and e.get('target')=='el09-0011':e.set('target',key)
    p=pages['elab-10']
    g=cell(p,'el10-0006').find('mxGeometry');g.set('x','2100')
    label(p,'el10-0009','Giữ chặn / STALE_PLAN')
    for action,key,x,y in [('el10-0006','audit_plan_blocked_final',2860,685),
                           ('el10-0009','audit_plan_stale_final',2860,1125)]:
        vertex(p,key,'',x,y,48,48,'final')
        for e in model_root(p):
            if e.get('source')==action and e.get('target')=='audit_plan_merge':e.set('target',key)
    cell(p,'el10-0014').find('mxGeometry').set('x','3000')
    label(p,'el10-0013','BEGIN; khóa kế hoạch;\nkiểm quyền và mã chống lặp')
    label(p,'audit_plan_write','Ghi công việc in, phân bổ,\ngiữ chỗ và nhật ký')
    label(p,'audit_plan_existing','Mã này đã áp dụng?')
    label(p,'audit_plan_gate','Đúng quyền và mã?')
    label(p,'audit_plan_snapshot','Khóa/đọc lại nguồn;\nbản chốt còn đúng?')
    label(p,'audit_plan_return','COMMIT; trả kết quả đã có')
    label(p,'audit_plan_rollback','Không tạo tác động một phần;\nlưu lý do cũ nguồn hoặc ROLLBACK khi lỗi')
    label(pages['d-el14'],'el14-0008','Bộ đề xuất kế hoạch')
    g=cell(pages['d-el14'],'el14-0009').find('mxGeometry')
    g.set('x','900');g.set('y','200')
    for key,text in {'el14-0002':'Giao diện web\nNext.js / React',
            'el14-0003':'API / Xác thực / Nghiệp vụ',
            'el14-0004':'PostgreSQL\nĐơn hàng / Báo giá / Sản xuất',
            'el14-0005':'Kho tệp riêng tư',
            'el14-0006':'Hàng chờ / Xử lý nền',
            'el14-0007':'Ridge / Phần mềm cắt lớp',
            'el14-0009':'Bộ gửi Email / Telegram'}.items():label(pages['d-el14'],key,text)
    label(pages['elab-11'],'el11-0001','EL11. Kiến trúc hiện tại')
    label(pages['elab-11'],'el11-0004','Next.js API Routes\nXác thực / Sản phẩm / Đơn hàng')
    label(pages['elab-11'],'el11-0005','computeQuote / Ridge\ntrong trình duyệt')
    # Only implemented components belong in the submitted component view.
    p=pages['d-el14']
    names_and_relations(p,'EL14. Sơ đồ thành phần',{
        'web':(100,500,500,180),'mesh':(850,150,500,180),
        'quote':(1600,190,540,180),'api':(850,700,560,180),
        'database':(1700,700,520,180),'notifications':(1700,1170,520,180),
    },[])
    for key,text in {'web':'Giao diện web\nNext.js / React',
            'mesh':'Phân tích STL\nWeb Worker',
            'quote':'Ước tính giá\ncomputeQuote / Ridge',
            'api':'API xác thực, sản phẩm\nvà đơn hàng',
            'database':'Dữ liệu nghiệp vụ\nPostgreSQL',
            'notifications':'Gửi thông báo'}.items():
        label(p,key,text);style(p,key,shape='component')
    for i,(a,b) in enumerate([('web','mesh'),('web','quote'),('web','api'),
                              ('api','database'),('notifications','database')]):
        edge(p,f'component_dependency_{i}',a,b,endArrow='open',dashed=1)
    change['d-el14']='Chỉ vẽ thành phần có code: web, STL worker, computeQuote, API, PostgreSQL và gửi thông báo. Bỏ kho tệp/queue/slicer/AI planner chưa triển khai hoặc chưa chốt.'
    # Keep the decision text inside the inscribed area, not across the diamond.
    for key,value in {'el10-0008':'Đủ điều kiện duyệt?',
            'audit_plan_gate':'Quyền/key hợp lệ?',
            'audit_plan_existing':'Key đã áp dụng?',
            'audit_plan_snapshot':'Khóa/đọc lại nguồn;\nsnapshot hợp lệ?',
            'audit_plan_written':'Ghi thành công?'}.items():
        label(pages['elab-10'],key,value)
    for key in ['elab-08','elab-09','elab-10']:
        for item in model_root(pages[key]):
            if item.get('vertex')!='1' or item.get('parent')!='1' or not item.get('value'):
                continue
            if 'rhombus' in item.get('style',''):
                g=item.find('mxGeometry')
                w,h=float(g.get('width')),float(g.get('height'))
                nw,nh=max(w,420),max(h,230)
                g.set('x',str(float(g.get('x'))-(nw-w)/2))
                g.set('y',str(float(g.get('y'))-(nh-h)/2))
                g.set('width',str(nw));g.set('height',str(nh))
            elif not item.get('id').endswith('-0001'):
                style(pages[key],item.get('id'),rounded=1,arcSize=10)

    for p in doc.findall('diagram'):
        p.set('name',re.sub(r'\bcatalogue\b','danh mục sản phẩm',p.get('name'),flags=re.I))
        terms={'Class Diagram':'Sơ đồ lớp','Use Case':'Ca sử dụng','Activity':'Hoạt động',
               'Sequence':'Tuần tự','Component':'Thành phần','State':'Trạng thái'}
        for term,local in terms.items():
            p.set('name',re.sub(r'\b'+re.escape(term)+r'\b',local,p.get('name'),flags=re.I))
        if p.get('id')=='elab-12':p.set('name','EL12 - Quan hệ dữ liệu - Sản xuất')
        if p.get('id')=='d-el14':p.set('name','EL14 - Thành phần hệ thống')
        model = p.find('mxGraphModel')
        # Default adaptive draw.io theme: dark canvas in the user's dark editor.
        model.attrib.pop('background',None)
        model.attrib.pop('adaptiveColors',None)
        model.set('grid','0')
        for item in model_root(p):
            if item.get('value'):
                item.set('value',re.sub(r'\bcatalogue\b','danh mục sản phẩm',item.get('value'),flags=re.I))
                item.set('value',re.sub(r'\s*\[(?:DESIGNED|CURRENT)\]','',item.get('value')))
                item.set('value',re.sub(r'\s*—\s*(?:CURRENT|MIXED|DESIGNED|DESIGN_PROPOSAL).*$', '',item.get('value')))
                item.set('value',re.sub(r'^DESIGNED:\s*','',item.get('value')))
                value=item.get('value')
                value=re.sub(r'^'+re.escape(p.get('id'))+r'\s+','',value)
                value=value.replace('Idempotency-Key','__IDEMPOTENCY_HEADER__')
                for term,local in {**terms,'snapshot':'bản chốt','revision':'phiên bản',
                        'evidence':'bằng chứng','key':'mã chống lặp','atomic apply':'áp dụng trong giao dịch',
                        'API tương thích':'API','authoritative':'do máy chủ xác định',
                        'mesh':'lưới tam giác','retry':'thử lại','stale':'nguồn đã đổi',
                        'outbox':'hàng chờ thông báo','audit':'nhật ký','reservation':'giữ chỗ'}.items():
                    value=re.sub(r'\b'+re.escape(term)+r'\b',local,value,flags=re.I)
                value=value.replace('__IDEMPOTENCY_HEADER__','Idempotency-Key')
                item.set('value',value)
                entries=dict(x.split('=',1) for x in item.get('style','').split(';') if '=' in x)
                old_size=float(entries.get('fontSize','22'))
                # Bigger text without scaling every box (which would cancel out at fit zoom).
                style(p,item.get('id'),fontSize=max(28,round(old_size*1.18)))
            if item.get('edge')=='1' and item.get('source')!=item.get('target'):
                style(p,item.get('id'),edgeStyle='none',rounded=0)
                geometry=item.find('mxGeometry')
                if item.get('source') and item.get('target'):
                    for points in list(geometry.findall('Array')):
                        geometry.remove(points)
                    entries=dict(x.split('=',1) for x in item.get('style','').split(';') if '=' in x)
                    for name in ['exitX','exitY','exitDx','exitDy','entryX','entryY','entryDx','entryDy','exitPerimeter','entryPerimeter']:
                        entries.pop(name,None)
                    item.set('style',';'.join(f'{k}={v}' for k,v in entries.items())+';')
        for c in list(model_root(p)):
            if 'shape=doubleEllipse' in c.get('style',''):
                style(p,c.get('id'),shape='ellipse',fillColor='#FFFFFF')
                g=c.find('mxGeometry'); w=float(g.get('width')); h=float(g.get('height'))
                inner=vertex(p,c.get('id')+'_center','',w*.25,h*.25,w*.5,h*.5,'start')
                inner.set('parent',c.get('id'))
        if p.get('id') in {'elab-05','elab-06','elab-07','minhlab-erd01','minhlab-erd02','elab-12','d-el16','d-el17'}:
            spread_relationship_ports(p)
        # Expand the editable canvas to include every top-level shape.
        width = height = 0
        for c in model_root(p):
            g = c.find('mxGeometry')
            if g is not None and c.get('vertex')=='1' and c.get('parent')=='1':
                width=max(width,float(g.get('x',0))+float(g.get('width',0)))
                height=max(height,float(g.get('y',0))+float(g.get('height',0)))
        model.set('pageWidth',str(int(width+100)));model.set('pageHeight',str(int(height+100)))
    assert [p.get('id') for p in doc.findall('diagram')] == [p.get('id') for p in original.findall('diagram')]
    assert 'ellipse;' in cell(pages['d-uc00'],'U0').get('style')
    assert 'rhombus;' in cell(pages['elab-10'],'audit_plan_snapshot').get('style')
    args.output.parent.mkdir(parents=True,exist_ok=True)
    ET.indent(doc,space='  ')
    ET.ElementTree(doc).write(args.output,encoding='utf-8',xml_declaration=True)
    mapping=[{'old_id':p.get('id'),'new_id':p.get('id'),'name':p.get('name'),'change':change.get(p.get('id'),'Giữ nguyên')} for p in doc.findall('diagram')]
    (OOAD/'exports/elaboration-page-map.json').write_text(json.dumps({
        'source':args.source.name,'source_sha256':hashlib.sha256(args.source.read_bytes()).hexdigest(),
        'output':args.output.name,'output_sha256':hashlib.sha256(args.output.read_bytes()).hexdigest(),
        'page_count_before':29,'page_count_after':29,'visual_inspection':'NOT VERIFIED','pages':mapping,
    },ensure_ascii=False,indent=2)+'\n')
    print('Reviewed copy:',args.output,'29 pages; all page IDs retained; originals untouched')


if __name__ == '__main__':
    main()
