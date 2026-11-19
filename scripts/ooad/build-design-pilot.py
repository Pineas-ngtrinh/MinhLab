#!/usr/bin/env python3
"""Build a focused editable design set; never overwrite an existing drawing.

Requirements and model choices are documented in docs/ooad/DESIGN_BRIEF.md.
The user's giuaki_chan_chim.drawio supplies presentation conventions only.
"""
from pathlib import Path
import argparse
import hashlib
import json
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
BASE = 'html=0;whiteSpace=wrap;fontFamily=Arial;fontSize=46;fontColor=#000000;strokeColor=#000000;strokeWidth=2.5;fillColor=none;gradientColor=none;shadow=0;'
DOC = ET.Element('mxfile', host='app.diagrams.net', agent='MinhLab OOAD design', type='device')
RELATIONS = []


def node(root, key, label, x, y, w, h, style='', parent='1'):
    c = ET.SubElement(root, 'mxCell', id=key, value=label, vertex='1', parent=parent,
                      style=BASE + 'align=center;verticalAlign=middle;' + style)
    ET.SubElement(c, 'mxGeometry', x=str(x), y=str(y), width=str(w), height=str(h), **{'as': 'geometry'})
    return c


def text(root, key, label, x, y, w, h, size=46, parent='1', bold=False):
    return node(root, key, label, x, y, w, h,
                f'shape=text;strokeColor=none;fontSize={size};fontStyle={1 if bold else 0};align=left;spacing=0;', parent)


def page(key, name, width=3400, height=2050):
    p = ET.SubElement(DOC, 'diagram', id=key, name=name)
    model = ET.SubElement(p, 'mxGraphModel', grid='1', gridSize='20', guides='1', tooltips='1',
                          connect='1', arrows='1', fold='1', page='1', pageScale='1',
                          pageWidth=str(width), pageHeight=str(height), math='0', shadow='0', adaptiveColors='auto')
    r = ET.SubElement(model, 'root')
    ET.SubElement(r, 'mxCell', id='0')
    ET.SubElement(r, 'mxCell', id='1', parent='0')
    text(r, 'title', name, 60, 30, width - 120, 105, 72, bold=True)
    return r


def edge(root, key, source, target, label='', kind='association', ports='', points=None):
    markers = {
        'association': 'endArrow=none;startArrow=none;',
        'dependency': 'dashed=1;endArrow=open;endFill=0;startArrow=none;',
        'composition': 'startArrow=diamond;startFill=1;endArrow=none;',
        'include': 'dashed=1;endArrow=open;endFill=0;startArrow=none;',
        'extend': 'dashed=1;endArrow=open;endFill=0;startArrow=none;',
        'message': 'endArrow=block;endFill=1;startArrow=none;',
        'return': 'dashed=1;endArrow=open;endFill=0;startArrow=none;',
        'flow': 'endArrow=block;endFill=1;startArrow=none;',
    }
    style = BASE + 'edgeStyle=none;rounded=0;curved=0;startSize=32;endSize=32;labelBackgroundColor=none;labelWidth=520;verticalAlign=bottom;spacingBottom=18;fontSize=44;' + markers.get(kind, kind) + ports
    c = ET.SubElement(root, 'mxCell', id=key, value=label, edge='1', parent='1', source=source, target=target, style=style)
    g = ET.SubElement(c, 'mxGeometry', relative='1', **{'as': 'geometry'})
    if points:
        a = ET.SubElement(g, 'Array', **{'as': 'points'})
        for x, y in points: ET.SubElement(a, 'mxPoint', x=str(x), y=str(y))
    return c


def multiplicity(root, key, owner, value, x):
    c = ET.SubElement(root, 'mxCell', id=key, value=value, vertex='1', connectable='0', parent=owner,
                      style=BASE + 'edgeLabel;strokeColor=none;align=center;fontSize=44;')
    g = ET.SubElement(c, 'mxGeometry', x=str(x), y='35', width='0', height='0', relative='1', **{'as': 'geometry'})
    ET.SubElement(g, 'mxPoint', x='0', y='0', **{'as': 'offset'})


def relation(root, key, source, target, left='1', right='0..*', kind='association', ports='', points=None):
    edge(root, key, source, target, kind=kind, ports=ports, points=points)
    multiplicity(root, key + '_from', key, left, -0.45)
    multiplicity(root, key + '_to', key, right, 0.45)


def box(root, key, name, attrs, ops, x, y, w=900):
    ah = max(80, len(attrs) * 76 + 30)
    oh = max(80, len(ops) * 78 + 30)
    h = 105 + ah + oh
    node(root, key, '', x, y, w, h, 'rounded=0;')
    text(root, key + '_name', name, 24, 10, w - 48, 80, 58, key, True)
    node(root, key + '_line1', '', 0, 100, w, 1, 'shape=line;', key)
    text(root, key + '_attrs', '\n'.join(attrs), 26, 115, w - 52, ah - 10, 52, key)
    node(root, key + '_line2', '', 0, 105 + ah, w, 1, 'shape=line;', key)
    text(root, key + '_ops', '\n'.join(ops), 26, 115 + ah, w - 52, oh - 10, 50, key)


def table(root, key, name, attrs, x, y, w=900):
    h = 110 + len(attrs) * 76
    node(root, key, '', x, y, w, h, 'rounded=0;')
    text(root, key + '_name', name, 24, 10, w - 48, 80, 58, key, True)
    node(root, key + '_line', '', 0, 100, w, 1, 'shape=line;', key)
    display = [line.split(':', 1)[0] + ('?' if line.endswith('?') else '') for line in attrs]
    text(root, key + '_attrs', '\n'.join(display), 26, 115, w - 52, h - 120, 56, key)


def er(root, key, source, target, fk, optional=False, unique=False, ports='', points=None):
    a = 'ERzeroToOne' if optional else 'ERmandOne'
    b = 'ERzeroToOne' if unique else 'ERzeroToMany'
    edge(root, key, source, target, kind=f'startArrow={a};endArrow={b};startFill=0;endFill=0;strokeWidth=3;startSize=42;endSize=42;', ports=ports, points=points)
    RELATIONS.append({'page': root.find('mxCell[@id="title"]').get('value'), 'source': source, 'target': target,
                      'foreign_key': fk, 'nullable': optional, 'unique': unique, 'startArrow': a, 'endArrow': b})


def use_cases():
    r = page('minhlab-design-overview', '01. Use Case tổng quát MinhLab 3D', 3500, 2400)
    node(r, 'boundary', '', 650, 170, 2200, 2070, 'rounded=0;')
    text(r, 'system_name', 'MINHLAB 3D', 690, 190, 2000, 75, 52, bold=True)
    actors = [('guest','Khách vãng lai',130,430),('customer','Khách hàng',130,1130),('staff','Nhân viên',130,1830),
              ('reviewer','Người duyệt tệp',3120,430),('operator','Thợ vận hành',3120,1130),('admin','Quản trị viên',3120,1830)]
    for key,label,x,y in actors:
        node(r,key,'',x,y,180,210,'shape=umlActor;')
        node(r,key+'_label',label,x-110,y+220,400,140,'shape=text;strokeColor=none;fontSize=48;')
    goals = [('browse','Xem sản phẩm và\nước tính STL',800,340),('checkout','Đặt hàng sản phẩm\nbằng VietQR',800,720),
             ('track','Theo dõi đơn hàng',800,1100),('accept','Chấp thuận báo giá\nvà đặt in',800,1480),
             ('pay','Đối soát chuyển khoản',800,1860),('request','Gửi yêu cầu in',1970,340),
             ('quote','Thẩm định tệp\nvà phát hành báo giá',1970,720),('production','Cập nhật công việc in',1970,1100),
             ('plan','Lập và duyệt\nkế hoạch sản xuất',1970,1480),('catalog','Quản lý danh mục\nsản phẩm',1970,1860)]
    for key,label,x,y in goals: node(r,key,label,x,y,720,170,'ellipse;fontSize=50;')
    for i,(a,b) in enumerate([('guest','browse'),('guest','checkout'),('guest','track'),('customer','checkout'),('customer','track'),
                              ('customer','accept'),('customer','request'),('staff','pay'),('reviewer','quote'),('operator','production'),
                              ('admin','plan'),('admin','catalog')]): edge(r,f'comm_{i}',a,b,points=[(400,1260),(400,280),(1750,280),(1750,425)] if (a,b)==('customer','request') else None)
    r = page('d-uc07', '02. Use Case yêu cầu in và báo giá', 3300, 1900)
    node(r,'boundary','',600,170,2100,1560,'rounded=0;')
    text(r,'system_name','MINHLAB 3D',650,190,1900,75,52,bold=True)
    node(r,'customer','',110,550,180,230,'shape=umlActor;'); node(r,'customer_label','Khách hàng',20,790,370,120,'shape=text;strokeColor=none;fontSize=50;')
    node(r,'reviewer','',2900,970,180,230,'shape=umlActor;'); node(r,'reviewer_label','Người duyệt tệp',2770,1210,440,140,'shape=text;strokeColor=none;fontSize=50;')
    data=[('send','Gửi yêu cầu in',780,370),('upload','Tải tệp và khai báo\nthông số',1850,370),('view','Xem báo giá',780,790),
          ('accept','Chấp thuận báo giá\nvà đặt in',780,1210),('review','Thẩm định tệp',1850,790),('issue','Phát hành báo giá',1850,1210)]
    for k,v,x,y in data:node(r,k,v,x,y,650,180,'ellipse;fontSize=50;')
    for i,(a,b) in enumerate([('customer','send'),('customer','view'),('customer','accept'),('reviewer','review'),('reviewer','issue')]):edge(r,f'a{i}',a,b)
    edge(r,'include_upload','send','upload','«include»','include')


def classes():
    r=page('minhlab-class-commerce','03. Sơ đồ lớp đơn hàng và thanh toán',3400,2100)
    box(r,'Customer','KhachHang',['- maKhach: UUID','- hoTen: String','- email: String'],['+ capNhatHoSo(): void'],80,210)
    box(r,'Order','DonHang',['- maDon: UUID','- trangThai: TrangThaiDon','- tongTien: Money','- diaChiChot: String'],['+ tinhTong(): Money','+ chuyenTrangThai(moi): void'],1220,210)
    box(r,'Item','ChiTietDonHang',['- soLuong: Integer','- donGiaChot: Money','- tenSanPhamChot: String'],['+ thanhTien(): Money'],2360,210)
    box(r,'Variant','BienTheSanPham',['- maBienThe: UUID','- tenMau: String','- giaBan: Money'],['+ coTheBan(): Boolean'],2360,1270)
    box(r,'Payment','ThanhToan',['- maThanhToan: UUID','- soTien: Money','- trangThai: TrangThaiTT'],['+ ghiNhanKhaiBao(): void','+ xacNhanDoiSoat(): void'],1220,1270)
    box(r,'Product','SanPham',['- maSanPham: UUID','- tenSanPham: String','- trangThai: TrangThaiSP'],['+ xuatBan(): void'],80,1270)
    relation(r,'customer_order','Customer','Order','0..1','0..*')
    relation(r,'order_items','Order','Item','1','1..*','composition')
    relation(r,'variant_items','Variant','Item','0..1','0..*')
    relation(r,'order_payments','Order','Payment','1','0..*')
    relation(r,'product_variants','Product','Variant','1','1..*',points=[(580,1930),(2850,1930)])
    r=page('elab-06','04. Sơ đồ lớp yêu cầu in và báo giá',3400,2400)
    box(r,'Request','YeuCauIn',['- maYeuCau: UUID','- maKhach: UUID','- trangThai: TrangThaiYeuCau'],['+ gui(): void','+ yeuCauSuaTep(): void'],80,210)
    box(r,'Quote','BaoGia',['- maBaoGia: UUID','- phienBan: Integer','- hanChapThuan: DateTime','- trangThai: TrangThaiBaoGia'],['+ phatHanh(): void','+ conHieuLuc(luc): Boolean'],1220,210)
    box(r,'QuoteItem','ChiTietBaoGia',['- soLuongDuyet: Integer','- donGiaChot: Money','- maPhienBanThongSo: UUID'],['+ thanhTien(): Money'],2360,210)
    box(r,'Approval','ChapThuanBaoGia',['- maChapThuan: UUID','- maKhach: UUID','- banChot: String','- thoiDiem: DateTime'],['+ khopBanChot(hash): Boolean'],1220,1330)
    box(r,'Order','DonHang',['- maDon: UUID','- trangThai: TrangThaiDon','- tongTien: Money'],['+ tinhTong(): Money'],2360,1330)
    box(r,'Spec','PhienBanThongSo',['- maPhienBan: UUID','- maPhienBanTep: UUID','- tiLe: Decimal','- vatLieu: String'],['+ hopLe(): Boolean'],80,1330)
    relation(r,'request_quote','Request','Quote','1','0..*')
    relation(r,'quote_lines','Quote','QuoteItem','1','1..*','composition')
    relation(r,'quote_approval','Quote','Approval','1','0..1')
    relation(r,'approval_order','Approval','Order','0..1','1')
    relation(r,'spec_lines','Spec','QuoteItem','1','0..*',points=[(570,2280),(3340,2280),(3340,970),(2850,970)])


def erds():
    r=page('minhlab-erd-commerce','05. ERD đơn hàng và thanh toán',3400,2050)
    table(r,'customers','KHÁCH HÀNG',['PK maKhach: UUID','hoTen: String','email: String'],80,210)
    table(r,'orders','ĐƠN HÀNG',['PK maDon: UUID','FK maKhach: UUID?','tongTien: Money','trangThai: String'],1220,210)
    table(r,'order_items','CHI TIẾT ĐƠN HÀNG',['PK maChiTiet: UUID','FK maDon: UUID','FK maBienThe: UUID?','FK maPhienBanThongSo: UUID?','soLuong: Integer','donGiaChot: Money'],2360,210)
    table(r,'products','SẢN PHẨM',['PK maSanPham: UUID','tenSanPham: String','trangThai: String'],80,1220)
    table(r,'payments','THANH TOÁN',['PK maThanhToan: UUID','FK maDon: UUID','soTien: Money','trangThai: String'],1220,1220)
    table(r,'variants','BIẾN THỂ SẢN PHẨM',['PK maBienThe: UUID','FK maSanPham: UUID','mau: String','giaBan: Money'],2360,1220)
    er(r,'customer_order','customers','orders','maKhach',optional=True)
    er(r,'order_item','orders','order_items','maDon')
    er(r,'order_payment','orders','payments','maDon')
    er(r,'variant_item','variants','order_items','maBienThe',optional=True)
    er(r,'product_variant','products','variants','maSanPham',points=[(570,1900),(2850,1900)])
    r=page('minhlab-erd-quote','06. ERD báo giá và chuyển thành đơn',3400,2300)
    table(r,'requests','YÊU CẦU IN',['PK maYeuCau: UUID','FK maKhach: UUID','trangThai: String'],80,210)
    table(r,'quotes','BÁO GIÁ',['PK maBaoGia: UUID','FK maYeuCau: UUID','phienBan: Integer','hanChapThuan: DateTime','trangThai: String'],1220,210)
    table(r,'quote_items','CHI TIẾT BÁO GIÁ',['PK maDong: UUID','FK maBaoGia: UUID','FK maPhienBanThongSo: UUID','soLuongDuyet: Integer','donGiaChot: Money'],2360,210)
    table(r,'spec_revisions','PHIÊN BẢN THÔNG SỐ',['PK maPhienBan: UUID','FK maPhienBanTep: UUID','tiLe: Decimal','vatLieu: String'],80,1300)
    table(r,'approvals','CHẤP THUẬN BÁO GIÁ',['PK maChapThuan: UUID','FK UQ maBaoGia: UUID','FK maKhach: UUID','banChot: String','thoiDiem: DateTime'],1220,1300)
    table(r,'orders','ĐƠN HÀNG',['PK maDon: UUID','FK UQ maChapThuan: UUID?','FK maKhach: UUID?','tongTien: Money','trangThai: String'],2360,1300)
    er(r,'request_quote','requests','quotes','maYeuCau')
    er(r,'quote_item_relation','quotes','quote_items','maBaoGia')
    er(r,'quote_approval','quotes','approvals','maBaoGia',unique=True)
    er(r,'approval_order','approvals','orders','maChapThuan',optional=True,unique=True)
    er(r,'spec_quote_item','spec_revisions','quote_items','maPhienBanThongSo',points=[(570,2170),(3340,2170),(3340,960),(2850,960)])


def activity():
    r=page('minhlab-activity-accept','07. Hoạt động chấp thuận báo giá và đặt in',3500,2870)
    node(r,'start','',1680,180,56,56,'ellipse;fillColor=#000000;')
    steps=[('submit','Khách chấp thuận bản báo giá',1300,310,820,130,'rounded=1;arcSize=12;'),
           ('auth','Xác thực; bắt đầu giao dịch\nKhóa và đọc bản báo giá',1300,540,820,130,'rounded=1;arcSize=12;'),
           ('valid','Đúng chủ và\nđúng bản chốt?',1440,790,540,260,'rhombus;'),
           ('prior','Đã có đơn cho\nchấp thuận này?',1440,1230,540,260,'rhombus;'),
           ('quote','Báo giá còn hạn\nvà đã phát hành?',1440,1670,540,260,'rhombus;'),
           ('create','Lưu chấp thuận, đơn đủ lượng\nvà thông báo; COMMIT',1180,2100,1060,170,'rounded=1;arcSize=12;'),
           ('result','Trả đơn chờ thanh toán VietQR',1300,2500,820,130,'rounded=1;arcSize=12;'),
           ('denied','Từ chối; kết thúc giao dịch',100,860,850,140,'rounded=1;arcSize=12;'),
           ('old','Kết thúc giao dịch\nTrả lại đơn đã tạo',2450,1280,850,140,'rounded=1;arcSize=12;'),
           ('expired','Kết thúc giao dịch\nYêu cầu báo giá mới',100,1730,850,140,'rounded=1;arcSize=12;'),
           ('failed','Hoàn tác toàn bộ\nThông báo chưa tạo đơn',2450,2110,850,160,'rounded=1;arcSize=12;')]
    for k,v,x,y,w,h,s in steps:node(r,k,v,x,y,w,h,s+'fontSize=48;')
    for i,(a,b,l) in enumerate([('start','submit',''),('submit','auth',''),('auth','valid',''),('valid','denied','[không]'),('valid','prior','[có]'),
                              ('prior','old','[có]'),('prior','quote','[chưa]'),('quote','expired','[không]'),('quote','create','[có]'),('create','result','[thành công]'),('create','failed','[lỗi]')]):edge(r,f'f{i}',a,b,l,'flow')
    for i,(source,x,y) in enumerate([('denied',500,1100),('old',2850,1530),('expired',500,1980),('failed',2850,2390),('result',1680,2740)]):
        node(r,f'end{i}','',x,y,70,70,'ellipse;fillColor=none;strokeWidth=3;')
        node(r,f'end{i}_dot','',18,18,34,34,'ellipse;fillColor=#000000;',f'end{i}')
        edge(r,f'end_flow{i}',source,f'end{i}',kind='flow')


def sequence():
    r=page('minhlab-sequence-accept','08. Tuần tự chấp thuận báo giá hợp lệ',4300,2200)
    xs={'customer':150,'screen':1120,'service':2240,'db':3480}
    labels={'customer':'Khách hàng','screen':'Màn hình báo giá','service':'XuLyChapThuan','db':'Kho dữ liệu'}
    for k,x in xs.items():
        node(r,k,labels[k],x,200,630,135,'rounded=0;fontSize=50;')
        line=ET.SubElement(r,'mxCell',id=k+'_line',edge='1',parent='1',style=BASE+'dashed=1;endArrow=none;startArrow=none;')
        geo=ET.SubElement(line,'mxGeometry',relative='1',**{'as':'geometry'})
        ET.SubElement(geo,'mxPoint',x=str(x+315),y='335',**{'as':'sourcePoint'})
        ET.SubElement(geo,'mxPoint',x=str(x+315),y='2085',**{'as':'targetPoint'})
    def msg(k,a,b,y,label,ret=False):
        c=ET.SubElement(r,'mxCell',id=k,value=label,edge='1',parent='1',style=BASE+f'edgeStyle=none;fontSize=48;labelWidth={abs(xs[a]-xs[b])-100};align=center;verticalAlign=bottom;spacingBottom=12;labelBackgroundColor=none;startArrow=none;'+('dashed=1;endArrow=open;endFill=0;' if ret else 'endArrow=block;endFill=1;'))
        g=ET.SubElement(c,'mxGeometry',relative='1',**{'as':'geometry'})
        ET.SubElement(g,'mxPoint',x=str(xs[a]+315),y=str(y),**{'as':'sourcePoint'})
        ET.SubElement(g,'mxPoint',x=str(xs[b]+315),y=str(y),**{'as':'targetPoint'})
    for row in [
        ('m1','customer','screen',460,'Chấp thuận bản chốt'),
        ('m2','screen','service',650,'chapThuan(maBaoGia, phienBan, khoaLap)'),
        ('m3','service','db',840,'BEGIN; khóa và đọc báo giá'),
        ('m4','db','service',1030,'Đúng chủ, đúng bản; còn hạn; chưa có đơn',True),
        ('m5','service','db',1220,'Lưu chấp thuận và đơn đủ số lượng'),
        ('m6','service','db',1410,'Lưu dòng hàng và thông báo'),
        ('m7','service','db',1600,'COMMIT'),
        ('m8','db','service',1790,'Đã lưu toàn bộ',True),
        ('m9','service','screen',1980,'Trả đơn chờ thanh toán',True),
    ]:msg(*row)


def state():
    r=page('minhlab-state-quote','09. Trạng thái báo giá',3350,1900)
    for k,l,x,y in [('draft','NHÁP',160,400),('sent','ĐÃ PHÁT HÀNH',1310,400),('accepted','ĐÃ CHẤP THUẬN',2460,400),
                     ('withdrawn','ĐÃ THU HỒI',160,1250),('expired','HẾT HẠN',1310,1250),('declined','KHÁCH TỪ CHỐI',2460,1250)]:
        node(r,k,l,x,y,700,180,'rounded=1;arcSize=12;fontSize=50;')
    node(r,'start','',470,210,60,60,'ellipse;fillColor=#000000;')
    edge(r,'initial','start','draft',kind='flow')
    edge(r,'issue','draft','sent','Phát hành','flow')
    edge(r,'accept','sent','accepted','Chấp thuận [hợp lệ]\n/ tạo đơn đủ lượng','flow')
    edge(r,'expire','sent','expired','Đến hạn [chưa chấp thuận]','flow')
    edge(r,'withdraw','sent','withdrawn','Người duyệt thu hồi','flow')
    edge(r,'decline','sent','declined','Khách từ chối','flow')


def components():
    r=page('d-el14','10. Sơ đồ thành phần MinhLab 3D',3400,2300)
    data=[('web','Giao diện khách hàng\nvà bàn làm việc xưởng',100,850,800),('mesh','Phân tích STL\nvà ước tính tham khảo',1250,250,900),
          ('commerce','Tài khoản, danh mục\nvà đơn hàng',1250,850,900),('quotes','Tiếp nhận tệp\nvà báo giá chính thức',1250,1450,900),
          ('planning','Lập kế hoạch\nvà quản lý công việc in',1250,1990,900),('data','Truy cập dữ liệu\nnghiệp vụ',2500,850,780),
          ('files','Quản lý phiên bản tệp',2500,1450,780),('notify','Gửi thông báo',2500,1990,780)]
    for k,l,x,y,w in data:node(r,k,l,x,y,w,190,'shape=component;fontSize=48;')
    for i,(a,b) in enumerate([('web','mesh'),('web','commerce'),('web','quotes'),('web','planning'),('commerce','data'),('quotes','data'),('quotes','files'),('planning','data'),('notify','data')]):edge(r,f'd{i}',a,b,kind='dependency',ports='exitX=1;exitY=0.5;entryX=1;entryY=0.5;' if a=='notify' else '',points=[(3340,2085),(3340,945)] if a=='notify' else None)


def file_erd():
    r=page('minhlab-erd-files','11. ERD tệp và phiên bản thông số',3400,2100)
    table(r,'customers','KHÁCH HÀNG',['PK maKhach: UUID','hoTen: String','email: String'],80,210)
    table(r,'requests','YÊU CẦU IN',['PK maYeuCau: UUID','FK maKhach: UUID','trangThai: String'],1220,210)
    table(r,'file_revisions','PHIÊN BẢN TỆP',['PK maPhienBanTep: UUID','FK maYeuCau: UUID','soPhienBan: Integer','maNoiDung: String'],2360,210)
    table(r,'order_items','CHI TIẾT ĐƠN HÀNG',['PK maChiTiet: UUID','FK maDon: UUID','FK maPhienBanThongSo: UUID?','soLuong: Integer','donGiaChot: Money'],1220,1270)
    table(r,'spec_revisions','PHIÊN BẢN THÔNG SỐ',['PK maPhienBan: UUID','FK maPhienBanTep: UUID','tiLe: Decimal','vatLieu: String'],2360,1270)
    er(r,'customer_request','customers','requests','maKhach')
    er(r,'request_file','requests','file_revisions','maYeuCau')
    er(r,'file_spec','file_revisions','spec_revisions','maPhienBanTep')
    er(r,'spec_order_item','spec_revisions','order_items','maPhienBanThongSo',optional=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'docs/ooad/exports/MinhLab_OOAD_ThietKe.drawio')
    args=parser.parse_args()
    if args.output.exists():parser.error('Output exists; choose a new path to preserve manual edits.')
    use_cases();classes();erds();activity();sequence();state();components();file_erd()
    # Put connected edges behind all vertices, so endpoint glyphs and text remain editable.
    for p in DOC:
        root=p.find('mxGraphModel/root')
        content=list(root)
        root[:]=content[:2]+[c for c in content[2:] if c.get('edge')=='1']+[c for c in content[2:] if c.get('edge')!='1']
        ids=[c.get('id') for c in root]
        assert len(ids)==len(set(ids)),p.get('name')
        for c in root:
            for side in ['source','target']:
                if c.get(side):assert c.get(side) in ids,(p.get('name'),c.get('id'),side)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    ET.indent(DOC,space='  ')
    ET.ElementTree(DOC).write(args.output,encoding='utf-8',xml_declaration=True)
    manifest={'artifact':args.output.name,'sha256':hashlib.sha256(args.output.read_bytes()).hexdigest(),
              'scope':'DESIGN_PILOT_NOT_FULL_29_PAGE_REPLACEMENT','style_reference':'giuaki_chan_chim.drawio',
              'pages':[{'id':p.get('id'),'name':p.get('name')} for p in DOC], 'erd_relations':RELATIONS}
    args.output.with_suffix('.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(f'{args.output}: {len(DOC)} editable pages; {len(RELATIONS)} ERD relations.')


if __name__=='__main__':main()
