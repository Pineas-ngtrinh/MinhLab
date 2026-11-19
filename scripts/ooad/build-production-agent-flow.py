"""Build the focused, editable OOAD supplement for dynamic production data.

Only authors documentation. Does not read/write the application database or models.
"""
from pathlib import Path
import json
import xml.etree.ElementTree as ET
import html

BASE = Path(__file__).resolve().parents[2]
OUT = BASE / 'docs/ooad/production-agent'


class Page:
    def __init__(self, code, title, width, height):
        self.code, self.title = code, title
        self.page = ET.Element('diagram', id=code, name=f'{code} {title}')
        self.model = ET.SubElement(self.page, 'mxGraphModel', {
            'adaptiveColors': 'auto', 'background': '#FFFFFF', 'grid': '1',
            'gridSize': '10', 'page': '1', 'pageScale': '1',
            'pageWidth': str(width), 'pageHeight': str(height),
            'dx': str(width), 'dy': str(height), 'shadow': '0',
        })
        self.root = ET.SubElement(self.model, 'root')
        ET.SubElement(self.root, 'mxCell', id='0')
        ET.SubElement(self.root, 'mxCell', id='1', parent='0')
        self.counter = 0
        self.box('title', title, 40, 25, width-80, 80,
                 'shape=text;strokeColor=none;fillColor=none;align=left;fontStyle=1;', 36)

    def box(self, key, text, x, y, w, h, style='', size=28, parent='1'):
        value = html.escape(text).replace('\n', '<br>')
        common = (f'html=1;whiteSpace=wrap;fontFamily=Arial;fontSize={size};'
                  'fontColor=#000000;strokeColor=#000000;fillColor=#FFFFFF;'
                  'strokeWidth=1.6;align=center;verticalAlign=middle;spacing=10;')
        c = ET.SubElement(self.root, 'mxCell', id=key, value=value,
                          style=common+style, vertex='1', parent=parent)
        ET.SubElement(c, 'mxGeometry', x=str(x), y=str(y), width=str(w), height=str(h), **{'as': 'geometry'})
        return key

    def edge(self, a, b, label='', dashed=False, arrow='open', points=None):
        self.counter += 1
        c = ET.SubElement(self.root, 'mxCell', {
            'id': f'e{self.counter}', 'value': html.escape(label).replace('\n', '<br>'),
            'edge': '1', 'parent': '1', 'source': a, 'target': b,
            'style': ('edgeStyle=none;html=1;rounded=0;strokeColor=#000000;strokeWidth=1.6;'
                      f'endArrow={arrow};endFill=0;fontFamily=Arial;fontSize=24;'
                      f'dashed={int(dashed)};labelBackgroundColor=#FFFFFF;'),
        })
        g = ET.SubElement(c, 'mxGeometry', relative='1', **{'as': 'geometry'})
        if points:
            arr = ET.SubElement(g, 'Array', **{'as': 'points'})
            for x, y in points:
                ET.SubElement(arr, 'mxPoint', x=str(x), y=str(y))
        return c

    def actor(self, key, name, x, y):
        self.box(key, '', x, y, 160, 230,
                 'group;strokeColor=none;fillColor=none;')
        self.box(key+'head', '', 60, 0, 40, 40, 'shape=ellipse;', parent=key)
        self.box(key+'body', '', 79, 40, 2, 75, 'fillColor=#000000;strokeColor=none;', parent=key)
        self.box(key+'arms', '', 25, 66, 110, 2, 'fillColor=#000000;strokeColor=none;', parent=key)
        self.box(key+'leg1', '', 48, 104, 2, 66,
                 'fillColor=#000000;strokeColor=none;rotation=34;', parent=key)
        self.box(key+'leg2', '', 110, 104, 2, 66,
                 'fillColor=#000000;strokeColor=none;rotation=-34;', parent=key)
        self.box(key+'label', name, -35, 170, 230, 100,
                 'shape=text;strokeColor=none;fillColor=none;', parent=key)
        return key

    def start(self, key, x, y):
        return self.box(key, '', x, y, 30, 30, 'shape=ellipse;fillColor=#000000;')

    def final(self, key, x, y):
        self.box(key, '', x, y, 42, 42, 'shape=ellipse;')
        self.box(key+'inner', '', 10, 10, 22, 22, 'shape=ellipse;fillColor=#000000;', parent=key)
        return key

    def lanes(self, labels, width, height):
        for i, name in enumerate(labels):
            self.box(f'lane{i}', name, 40+i*width, 140, width, height-180,
                     'shape=swimlane;startSize=70;horizontal=1;rounded=0;fillColor=none;fontStyle=1;', 28)

    def action(self, key, text, x, y, w=400, h=130):
        return self.box(key, text, x, y, w, h, 'rounded=1;arcSize=12;')

    def decision(self, key, text, x, y, w=300, h=160):
        return self.box(key, text, x, y, w, h, 'shape=rhombus;', 26)


def usecases():
    p = Page('AG01', 'Quản lý sản phẩm và lập kế hoạch in', 1800, 1370)
    p.box('subject', 'Quản lý danh mục và sản xuất MinhLab', 300, 150, 1150, 1140,
          'shape=swimlane;startSize=70;horizontal=1;fillColor=none;fontStyle=1;', 30)
    p.actor('admin', 'Quản trị viên', 45, 380)
    p.actor('tech', 'Kỹ thuật /\nThợ vận hành', 45, 910)
    p.actor('agent', 'AI Agent', 1570, 590)
    cases = [
        ('AGUC01', 'Quản lý sản phẩm', 430, 270, 'admin'),
        ('AGUC02', 'Quản lý linh kiện', 430, 460, 'admin'),
        ('AGUC04', 'Duyệt kế hoạch in', 430, 650, 'admin'),
        ('AGUC05', 'Kiểm tra khả năng in', 430, 880, 'tech'),
        ('AGUC06', 'Cập nhật tiến độ và\nchuyển đóng gói', 430, 1080, 'tech'),
        ('AGUC08', 'Đề xuất kế hoạch in', 970, 460, 'agent'),
        ('AGUC09', 'Theo dõi sản xuất', 970, 880, 'agent'),
    ]
    for key, name, x, y, actor in cases:
        p.box(key, name, x, y, 380, 130, 'shape=ellipse;')
        p.edge(actor, key, arrow='none')
    return p


def publishing():
    p = Page('AG02', 'Thêm sản phẩm và linh kiện mới', 1880, 1510)
    p.lanes(['Quản trị viên', 'Hệ thống', 'AI Agent'], 600, 1510)
    p.start('begin', 320, 245)
    p.action('enter', 'Nhập thông tin sản phẩm,\nlinh kiện và số lượng', 140, 330, h=150)
    p.decision('valid', 'Thông tin đầy đủ\nvà đã xác nhận?', 790, 610)
    p.action('blocked', 'Lưu nháp;\nbáo thông tin thiếu', 660, 880, w=260, h=150)
    p.final('endbad', 770, 1130)
    p.action('publish', 'Lưu thông tin\nđược phép sử dụng', 940, 880, w=260, h=150)
    p.action('refresh', 'Cập nhật dữ liệu\nsản phẩm và linh kiện', 1340, 1150, h=150)
    p.final('endok', 1510, 1390)
    for a, b, label in [('begin','enter',''),('enter','valid',''),('valid','blocked','[không]'),
                        ('blocked','endbad',''),('valid','publish','[có]'),
                        ('publish','refresh',''),('refresh','endok','')]:
        p.edge(a,b,label)
    return p


def planning():
    p = Page('AG03', 'Lập kế hoạch in và cập nhật sản xuất', 1900, 2480)
    p.lanes(['Hệ thống', 'AI Agent', 'Nhân sự xưởng'], 610, 2480)
    p.start('begin', 330, 245)
    p.action('read', 'Nhận đơn đủ điều kiện;\nkiểm tra kho và máy', 150, 330, h=150)
    p.action('proposal', 'Gom linh kiện và\nđề xuất mẻ in', 760, 560, h=150)
    p.action('review', 'Kỹ thuật kiểm tra cách in;\nquản trị xem phương án', 1370, 790, h=150)
    p.decision('approve', 'Duyệt\nphương án?', 1410, 1010)
    p.action('reject', 'Ghi lý do từ chối\nhoặc yêu cầu chỉnh lại', 1370, 1290)
    p.final('endreject', 1540, 1500)
    p.action('commit', 'Kiểm tra và xếp lịch;\ncập nhật đơn, giữ máy', 150, 1290, h=150)
    p.action('startjob', 'Xác nhận bắt đầu in', 1370, 1560)
    p.action('running', 'Đơn đang sản xuất;\nmáy đang sử dụng', 150, 1760)
    p.action('handoff', 'Kiểm tra thành phẩm;\nchuyển sang đóng gói', 1370, 1960, h=150)
    p.action('release', 'Cập nhật đơn đóng gói;\ncập nhật máy trống', 150, 2190, h=150)
    p.final('done', 330, 2370)
    links=[('begin','read',''),('read','proposal',''),('proposal','review',''),('review','approve',''),
           ('approve','reject','[không]'),('reject','endreject',''),
           ('approve','commit','[có]'),('commit','startjob',''),('startjob','running',''),
           ('running','handoff',''),('handoff','release','[đã bàn giao đủ]'),('release','done','')]
    for a,b,label in links:p.edge(a,b,label)
    return p


def sequence():
    p = Page('AG04', 'Sản phẩm mới được dùng khi lập kế hoạch in', 2120, 2130)
    xs=[170,750,1320,1890]
    names=['Quản trị viên','Hệ thống','Cơ sở dữ liệu','AI Agent']
    for i,(x,name) in enumerate(zip(xs,names)):
        p.box(f'participant{i}',name,x-135,145,270,110,'rounded=0;',28)
        p.box(f'lifeline{i}','',x,255,1,1760,
              'shape=line;direction=north;dashed=1;strokeWidth=1.5;fillColor=none;')
    def message(a,b,y,label,ret=False):
        # Explicit connection points keep the native sequence time axis exact.
        p.box(f'time{a}_{y}','',xs[a],y,1,1,'strokeColor=none;fillColor=none;')
        p.box(f'time{b}_{y}','',xs[b],y,1,1,'strokeColor=none;fillColor=none;')
        p.edge(f'time{a}_{y}',f'time{b}_{y}',label,dashed=ret)
    message(0,1,380,'Thêm sản phẩm hoặc linh kiện')
    message(1,2,540,'Lưu thông tin đã xác nhận')
    message(2,1,700,'Lưu thành công',True)
    message(1,0,860,'Thông báo kết quả',True)
    message(1,3,1020,'Thông báo có dữ liệu mới')
    p.box('opt','',45,1160,2030,850,'fillColor=none;rounded=0;')
    p.box('optlabel','opt [Có đơn cần sản xuất]',65,1160,730,65,
          'shape=text;strokeColor=none;fillColor=#FFFFFF;align=left;',26)
    message(3,1,1320,'Yêu cầu dữ liệu lập kế hoạch')
    message(1,2,1480,'Lấy đơn và thông tin sản xuất')
    message(2,1,1640,'Dữ liệu sản xuất',True)
    message(1,3,1800,'Trả dữ liệu sản xuất',True)
    message(3,1,1960,'Gửi phương án gom mẻ')
    return p


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    pages=[usecases(),publishing(),planning(),sequence()]
    root=ET.Element('mxfile',host='MinhLab OOAD authoring',type='device')
    for p in pages:root.append(p.page)
    path=OUT/'minhlab-production-agent-simple.drawio'
    ET.ElementTree(root).write(path,encoding='utf-8',xml_declaration=False)
    with path.open('ab') as output:
        output.write(b'\n')
    manifest={
        'artifact':path.name,'status':'DESIGNED','date':'2026-11-11',
        'subject':'Phân hệ danh mục và quản lý sản xuất MinhLab',
        'source_style':'/Users/nguyenphucphu/Downloads/giuaki_chan_chim.drawio',
        'pages':[{'id':p.code,'name':p.title,'cells':len(p.root),'visual_qa':'pending'} for p in pages],
        'runtime_implemented':False,
    }
    manifest['presentation']='Simplified OOAD for coursework; implementation details stay in the specification.'
    (OUT/'simple.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(path)
    print('Pages:',len(pages))


if __name__=='__main__':main()
