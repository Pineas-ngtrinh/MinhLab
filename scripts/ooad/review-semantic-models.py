#!/usr/bin/env python3
"""Semantic revision of the user's saved native OOAD drawings; never overwrite input."""
from pathlib import Path
import copy, hashlib, html, importlib.util, json, re
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[2]
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result
B=module('builder',ROOT/'scripts/ooad/build-full-report-set.py')
R=module('refiner',ROOT/'scripts/ooad/refine-user-edited-diagrams.py')
SOURCE=ROOT/'docs/ooad/exports/minhlab-ooad-net-thang-tieng-viet-2026-11-08.drawio'
OUT=ROOT/'docs/ooad/exports/MinhLab_Elaboration_Reviewed_2026-11-08.drawio'
REPORT=ROOT/'docs/ooad/semantic-review-2026-11-08'
QA=ROOT/'docs/ooad/exports/qa-semantic-2026-11-08'
VIEW=Path('/private/tmp/minhlab-full-ooad-20261107/semantic20261108')

def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
original=R.read(SOURCE);result=copy.deepcopy(original)
pages=result.findall('diagram');book=B.Book(SOURCE);changes={};tables=set()
def record(n,reason):changes.setdefault(n,[]).append(reason)
def cell(n,key):return pages[n-1].find(f'.//mxCell[@id="{key}"]')
def text(n,key,value):
    c=cell(n,key)
    if c is None:raise KeyError((n,key))
    c.set('value',value);return c
def replace(n,p,reason):
    # Every existing page keeps its page ID and title cell ID.
    assert p.element.get('id')==pages[n-1].get('id')
    result.remove(pages[n-1]);result.insert(n-1,p.element);pages[n-1]=p.element
    record(n,reason)
def act(n,name,steps,branches,reason):
    p=B.activity(book,n,'',name,steps,branches);replace(n,p,reason);return p
def seq(n,name,events,frames,reason,service='DichVuTaiKhoan',extra=()):
    participants=[('actor','Người dùng'),('ui','Giao diện'),('svc',service),('db','KhoNghiepVu')]+list(extra)
    p=B.sequence(book,n,'',name,participants,events,frames);replace(n,p,reason);return p
def status(n,key,name,states,transitions,reason):
    p=B.state(book,pages[n-1].get('id') if n else key,name,states,transitions)
    if n:replace(n,p,reason)
    else:
        result.append(p.element);pages.append(p.element);record(len(pages),reason)
    return p
def remove(n,key):
    root=pages[n-1].find('mxGraphModel/root'); doomed={key}
    for c in root.findall('mxCell'):
        if c.get('source')==key or c.get('target')==key:doomed.add(c.get('id'))
    for c in list(root):
        if c.get('id') in doomed or c.get('parent') in doomed:root.remove(c)

# Product is an aggregate; image is a URL reference, review is the current value,
# not a newly invented SQL table. A draft may contain zero variants.
p=B.class_page(book,42,'','EL17 - Lớp sản phẩm biến thể ảnh và rà soát',[
 ('category','DanhMuc',['- ma: UUID','- ten: String','- duongDan: String'],['+ doiTen(ten: String): void']),
 ('product','SanPham',['- ma: UUID','- maSanPham: String','- ten: String','- duongDan: String','- moTaNgan: String','- moTa: String','- vatLieu: String','- nguon: NguonSanPham','- cachSanXuat: CachSanXuat','- xuatBan: TrangThaiXuatBan','- tuanThu: TrangThaiRaSoat','- revision: Integer'],[
 '+ sua(noiDung: NoiDungSanPham): void','+ duDieuKienXuatBan(): Boolean','+ xuatBan(quyetDinh: QuyetDinhXuatBan): void','+ an(): void','+ luuTru(): void','+ xoaNhapChuaDung(): void']),
 ('variant','BienThe',['- ma: UUID','- sku: String','- ten: String','- mau: String','- kichThuocMm: Vector3?','- khoiLuongGram: Decimal?','- giaBan: Money','- giaNiemYet: Money?','- trangThai: TrangThaiBienThe'],[
 '+ sua(duLieu: NoiDungBienThe): void','+ ngungBan(): void','+ moBanLai(): void']),
 ('review','KetQuaRaSoatHienTai',['- nguoiDuyet: UUID','- thoiDiem: Instant','- ghiChu: String?'],['+ hopLe(): Boolean']),
 ('image','ThamChieuAnh',['- ma: UUID','- duongDan: String','- moTaThayThe: String','- thuTu: Integer'],['+ doiThuTu(moi: Integer): void'])],
 [('category','product','1','0..*','assoc'),('product','variant','1','0..*','composition'),
  ('product','review','1','0..1','composition'),('product','image','1','0..*','composition')])
replace(42,p,'Bổ sung nhận diện, nội dung, ảnh, giá SKU; tách xuất bản/rà soát; review hiện tại 0..1; nháp có thể chưa có biến thể.')
tables.add(42)

# ERD stays a logical projection, with current review columns on SAN_PHAM.
text(13,'product-attrs','PK maSanPham: UUID\nFK maDanhMuc: UUID\nUQ maSanPhamCongKhai: String\nUQ duongDan: String\nten: String\nmoTaNgan: String\nmoTa: String\nvatLieu: String\nnguon: NguonSanPham\ncachSanXuat: CachSanXuat\nxuatBan: TrangThaiXuatBan\ntuanThu: TrangThaiRaSoat\nFK nguoiRaSoat: UUID?\nraSoatLuc: Instant?\nghiChuRaSoat: String?\nphienBan: Integer')
text(13,'variant-attrs','PK maBienThe: UUID\nFK maSanPham: UUID\nUQ sku: String\nten: String\nmau: String\nkichThuocMm: Vector3?\nkhoiLuongGram: Decimal?\ngiaBan: Money\ngiaNiemYet: Money?\ntrangThai: TrangThaiBienThe')
text(13,'image-attrs','PK maAnh: UUID\nFK maSanPham: UUID\nduongDan: String\nmoTaThayThe: String\nthuTu: Integer\nUQ (maSanPham, thuTu)')
for c in pages[12].findall('.//mxCell'):
    if c.get('source')=='product' and c.get('target')=='variant':R.put(c,endArrow='ERzeroToMany')
record(13,'ERD đồng bộ mô hình sản phẩm; metadata rà soát nằm trên sản phẩm, không thêm bảng review; 0..* biến thể cho bản nháp.');tables.add(13)
text(14,'item-attrs','PK maDong: UUID\nFK maDon: UUID\nloaiDong: LoaiDongDon\nFK maBienThe: UUID?\nFK maThongSo: UUID?\ntenChot: String\nsoLuong: Integer\ndonGiaChot: Money')
record(14,'Thêm loại dòng và tên chốt; ràng buộc loại/XOR ở đặc tả, giá đơn độc lập giá bán hiện tại.');tables.add(14)
text(15,'item-attrs','- ma: UUID\n- loaiDong: LoaiDongDon\n- maBienThe: UUID?\n- maThongSo: UUID?\n- soLuong: Integer\n- donGiaChot: Money\n- tenChot: String')
record(15,'Dòng đơn giữ tham chiếu nguồn tùy loại cùng tên và giá chốt bất biến.');tables.add(15)

# The manufacture spec is distinct from the customer's custom-print spec.
for n,keys in [(44,['line-attrs','stock-attrs']),(52,['line-attrs']),(53,['requirement-attrs']),(56,['requirement-attrs'])]:
    for key in keys:
        c=cell(n,key);value=c.get('value').replace('maThongSo:', 'maThongSoCheTao:')
        if n in [52,53]:value=value.replace('\nmaThongSoCheTao:', '\nFK maThongSoCheTao:')
        if n==56:value=value.replace('\nmaLinhKien:', '\nFK maLinhKien:').replace('\nmaThongSoCheTao:', '\nFK maThongSoCheTao:')
        c.set('value',value)
    record(n,'Đồng nhất khóa thông số chế tạo; FK ngoài trang đối chiếu ERD10, tách thông số tệp in riêng.');tables.add(n)
text(17,'allocation-attrs','- maNhuCau: UUID\n- soLuong: Integer\n/ luongDat: Integer\n/ luongLoi: Integer')
text(17,'requirement-attrs','- maDongDon: UUID\n- maPhienBanLinhKien: UUID\n- maThongSoCheTao: UUID\n- luongCan: Integer')
# New association uses native mxCells and multiplicity labels.
root=pages[16].find('mxGraphModel/root')
edge=ET.SubElement(root,'mxCell',id='review-batch-job',value='',edge='1',parent='1',source='batch',target='job',
    style=B.BASE+'edgeStyle=none;startArrow=none;endArrow=none;fontSize=44;')
ET.SubElement(edge,'mxGeometry',relative='1',**{'as':'geometry'})
for suffix,value,x in [('a','1','-0.78'),('b','0..1','0.78')]:
    c=ET.SubElement(root,'mxCell',id='review-batch-job-'+suffix,value=value,vertex='1',connectable='0',parent='review-batch-job',style='edgeLabel;html=0;fontFamily=Arial;fontSize=44;labelBackgroundColor=#FFFFFF;')
    ET.SubElement(c,'mxGeometry',x=x,y='-30',relative='1',**{'as':'geometry'})
record(17,'Mẻ đề xuất tạo tối đa một công việc; số lượng QC là thuộc tính dẫn xuất, không thêm bộ đếm độc lập.');tables.add(17)
for n in [17,45]:
    root=pages[n-1].find('mxGraphModel/root')
    for e in root.findall('mxCell'):
        if e.get('source')=='job' and e.get('target')=='allocation':
            root.find(f'mxCell[@id="{e.get("id")}-b"]').set('value','1..*')
    record(n,'Công việc đã phát hành trong mô hình đích phải có ít nhất một phân bổ; FK vật lý không tự bảo đảm số con tối thiểu.')

act(18,'EL08 - Activity — Đặt mua sản phẩm có sẵn và VietQR',[
 ('cart','Khách xác nhận giỏ và địa chỉ',False),('identity','Đọc danh tính phiên hoặc quyền guest và khóa lặp',False),
 ('prior','Chưa có kết quả cho khóa lặp?',True),('valid','Giỏ và giá hiện tại đủ điều kiện tạo đơn mới?',True),
 ('save','Giao dịch tạo đơn, dòng giá chốt, khoản chờ và quyền tra cứu duy nhất',False),
 ('commit','Giao dịch thành công?',True),('qr','Trả đơn và hướng dẫn VietQR; chưa xác nhận tiền',False)],
 [('prior','Đúng chủ và cùng dữ liệu: trả đơn cũ; khác dữ liệu: conflict','[đã có]'),
 ('valid','Không tạo đơn; yêu cầu sửa giỏ hoặc địa chỉ','[không]'),('commit','Rollback; tranh chấp cùng khóa thì đọc kết quả đã commit','[không]')],
 'Replay đúng chủ và payload được giải quyết trước giá/khả dụng hiện tại; tạo mới vẫn kiểm tra trong giao dịch.')
text(20,'branch2','Ghi STALE và kết thúc giao dịch; không tạo job hoặc giữ tài nguyên')
record(20,'Nhánh nguồn lỗi thời đóng giao dịch, không để transaction chưa kết thúc.')

# Explicit registration policy; verification is conditional, not mandatory login.
act(58,'ACT16 - Đăng ký và xác minh email theo chính sách',[
 ('input','Khách nhập thông tin đăng ký',False),('valid','Thông tin hợp lệ và email chưa được dùng?',True),
 ('required','Chính sách yêu cầu xác minh email?',True),('create','Giao dịch lưu CUSTOMER chờ xác minh, token và thư chờ gửi',False),
 ('send','Sau commit gửi thư; lỗi gửi giữ hàng đợi thử lại',False),('open','Khách mở liên kết xác minh',False),
 ('token','Token đúng, chưa dùng và còn hạn?',True),('active','Xác minh email; dùng token đúng một lần',False)],
 [('valid','Không tạo tài khoản; nêu lỗi phù hợp','[không]'),('required','Giao dịch tạo CUSTOMER hoạt động; không tạo thư xác minh bắt buộc','[không]'),
 ('token','Từ chối; cho yêu cầu liên kết mới','[không]')], 'Xác minh email là nhánh theo chính sách cấu hình; không bắt buộc cho mọi đăng ký.')
act(59,'ACT17 - Đăng nhập và kết thúc phiên',[
 ('input','Nhập thông tin đăng nhập',False),('valid','Thông tin và tài khoản đủ điều kiện?',True),
 ('session','Tạo phiên và cookie bảo mật',False),('use','Sử dụng chức năng theo quyền hiện hành',False),
 ('choice','Người dùng chọn đăng xuất?',True),('logout','Thu hồi phiên hiện tại và xóa cookie',False)],
 [('valid','Không cấp phiên; thông báo chung','[không]'),('choice','Phiên tiếp tục đến khi hết hạn hoặc bị thu hồi','[không]')], 'Đăng xuất là lựa chọn, không là bước bắt buộc của đăng nhập.')
act(66,'ACT24 - Điều phối giao hàng và hủy đơn',[
 ('read','Nhân viên chọn một thao tác và trạng thái đích của đơn',False),('permission','Đúng quyền và cạnh chuyển trạng thái?',True),
 ('continue','Là thao tác tiếp tục tiến độ?',True),('money','Đủ điều kiện tiền và chế tác cho trạng thái đích?',True),
 ('move','Khóa và kiểm lại; ghi đúng trạng thái đích, lịch sử và thông báo trong giao dịch',False),
 ('done','Trả kết quả thao tác đã chọn; hoàn tất chỉ khi có yêu cầu và đủ điều kiện',False)],
 [('permission','Từ chối; giữ trạng thái và lịch sử','[không]'),('continue','Chỉ hủy khi chưa thu tiền và chính sách cho phép; nếu không thì từ chối','[hủy đơn]'),
 ('money','Chờ thanh toán hoặc hoàn thiện; không bỏ qua điều kiện','[không]')], 'Mỗi yêu cầu thực hiện một cạnh hợp lệ, không tự hoàn tất đơn sau mọi thay đổi.')
act(67,'ACT25 - Nhập xuất kho và yêu cầu lặp',[
 ('choose','Chọn mặt hàng, loại biến động, số lượng và lý do',False),('identity','Kiểm quyền và khóa lặp theo chủ yêu cầu',False),
 ('prior','Chưa có hiệu lực cho cùng khóa?',True),('valid','Dữ liệu mới hợp lệ và đủ tồn khả dụng sau giữ chỗ?',True),
 ('save','Trong giao dịch khóa nguồn, kiểm lại và ghi biến động, khóa lặp, audit đúng một lần',False),
 ('done','Chỉ trả thành công sau commit; lỗi ghi rollback toàn bộ',False)],
 [('prior','Cùng dữ liệu: trả hiệu lực cũ; khác dữ liệu: conflict','[đã có]'),('valid','Không ghi biến động hoặc sửa mất lịch sử','[không]')],
 'Activity đồng bộ SEQ27: replay trước tồn hiện tại và không ghi trùng.')
text(61,'branch2','Kết thúc giao dịch; không thay đổi tiền; trả trạng thái hiện tại')
record(61,'Đóng giao dịch ở nhánh từ chối sau khi khóa dữ liệu đối soát.')

act(68,'ACT26 - Quản lý và xuất bản sản phẩm',[
 ('choose','Quản trị viên chọn thêm, sửa, xóa nháp, ẩn, lưu trữ hoặc xuất bản',False),
 ('base','Kiểm quyền, revision và điều kiện của thao tác đã chọn',False),('allowed','Đủ điều kiện thao tác?',True),
 ('publish','Thao tác xuất bản?',True),('content','Đủ nội dung, ảnh, biến thể ACTIVE và quyền sử dụng?',True),
 ('commit','Giao dịch ghi PUBLISHED, APPROVED, người rà soát và lịch sử',False),('done','Trả kết quả đã commit',False)],
 [('allowed','Từ chối; không xóa dữ liệu đã có lịch sử','[không]'),
 ('publish','Thêm hoặc sửa: lưu DRAFT và NEEDS_REVIEW; xóa chỉ nháp chưa dùng; ẩn hoặc lưu trữ giữ lịch sử; commit','[không]'),
 ('content','Chưa xuất bản; nêu điều kiện cần bổ sung','[không]')],
 'Thể hiện xuất bản, ẩn/lưu trữ, sửa thu hồi duyệt và điều kiện xóa thay cho luồng CRUD chung mơ hồ.')

seq(70,'SEQ16 - Đăng ký và xác minh theo chính sách',[
 ('actor','ui','Gửi thông tin đăng ký',False),('ui','svc','Đăng ký CUSTOMER theo chính sách',False),
 ('svc','db','Kiểm trùng và dữ liệu bắt buộc',False),
 ('svc','ui','Từ chối dữ liệu sai hoặc email đã dùng',True),
 ('svc','db','COMMIT CUSTOMER hoạt động; không yêu cầu xác minh',False),('svc','ui','Tài khoản được tạo',True),
 ('svc','db','COMMIT CUSTOMER chờ xác minh, token và outbox',False),('svc','ui','Đã lưu; thư chờ gửi hoặc thử lại',True),
 ('actor','ui','Mở liên kết xác minh',False),('ui','svc','Gửi token xác minh',False),
 ('svc','db','Khóa token và kiểm tài khoản, hạn, lần dùng',False),
 ('svc','ui','Từ chối token sai, hết hạn hoặc đã dùng',True),
 ('svc','db','Xác minh email và dùng token; COMMIT',False),('svc','ui','Email đã được xác minh',True)],
 [(3,13,'alt',[(3,'[Dữ liệu không hợp lệ]'),(4,'[Hợp lệ; không yêu cầu xác minh]'),(6,'[Hợp lệ; yêu cầu xác minh]')]),
  (8,13,'opt',[(8,'[Khách mở liên kết xác minh]')]),
  (11,13,'alt',[(11,'[Token hoặc tài khoản không hợp lệ]'),(12,'[Token và tài khoản hợp lệ]')])],
 'Phân nhánh chính sách và token hợp lệ/sai; gửi thư qua outbox ở ACT32/SEQ33.')
seq(71,'SEQ17 - Đăng nhập và đăng xuất tùy chọn',[
 ('actor','ui','Nhập email và mật khẩu',False),('ui','svc','Yêu cầu đăng nhập',False),
 ('svc','db','Đọc tài khoản và vai trò hiện hành',False),('db','svc','Dữ liệu xác thực',True),
 ('svc','ui','Thông báo chung; không cấp phiên',True),('svc','db','Lưu phiên với token hash',False),
 ('svc','ui','Cấp cookie phiên bảo mật',True),('actor','ui','Chọn đăng xuất',False),
 ('ui','svc','Thu hồi phiên hiện tại',False),('svc','db','Đánh dấu phiên đã thu hồi',False),
 ('svc','ui','Xóa cookie; phiên cũ không dùng lại',True)],
 [(4,10,'alt',[(4,'[Đăng nhập không hợp lệ]'),(5,'[Đăng nhập hợp lệ]')]),(7,10,'opt',[(7,'[Người dùng chọn đăng xuất]')])],
 'Đặt đăng xuất trong opt, tách khỏi kết quả đăng nhập.')
seq(77,'SEQ23 - Đối soát và xử lý hai người xác nhận',[
 ('actor','ui','Xác nhận sau khi tự kiểm ngân hàng',False),('ui','svc','Gửi quyết định và người xử lý',False),
 ('svc','db','BEGIN; khóa đơn và khoản thanh toán',False),('db','svc','Trạng thái hiện tại',True),
 ('svc','db','Kết thúc giao dịch không ghi thêm',False),('svc','ui','Trả kết quả đã VERIFIED',True),
 ('svc','db','ROLLBACK; không đổi tiền hoặc trạng thái',False),('svc','ui','Từ chối đơn hủy hoặc dữ liệu sai',True),
 ('svc','db','Ghi VERIFIED, PAID, CONFIRMED, lịch sử và outbox; COMMIT',False),
 ('svc','ui','Xác nhận đã nhận tiền một lần',True)],
 [(4,9,'alt',[(4,'[Đã xác nhận trước]'),(6,'[Không đủ điều kiện]'),(8,'[Đủ quyền và khoản còn chờ]')])],
 'Đóng giao dịch trong mọi nhánh, giữ đối soát thủ công.',service='DichVuThanhToan')
seq(78,'SEQ24 - Duyệt kế hoạch stale replay và commit',[
 ('actor','ui','Áp dụng kế hoạch đã rà soát',False),('ui','svc','Gửi revision và khóa lặp',False),
 ('svc','db','BEGIN; khóa và đọc nguồn hiện hành',False),('db','svc','Kết quả cũ hoặc snapshot hiện hành',True),
 ('svc','db','Kết thúc giao dịch không tạo hiệu lực mới',False),('svc','ui','Trả kết quả apply đã commit',True),
 ('svc','db','Ghi STALE và COMMIT; không ghi job hoặc giữ tài nguyên',False),('svc','ui','Yêu cầu lập revision kế hoạch mới',True),
 ('svc','svc','Kiểm nhu cầu, ràng buộc và slicer toàn mẻ',False),
 ('svc','db','Ghi job, allocation, giữ lịch, audit và COMMIT',False),('svc','ui','Chỉ trả thành công sau commit',True)],
 [(4,10,'alt',[(4,'[Cùng apply hợp lệ đã hoàn tất]'),(6,'[Chưa apply; nguồn hoặc điều kiện đã đổi]'),(8,'[Chưa apply; mọi điều kiện còn hợp lệ]')])],
 'Replay và STALE đóng giao dịch; không tạo job ở nhánh từ chối.',service='DichVuKeHoach')
seq(80,'SEQ26 - Quản lý và xuất bản sản phẩm',[
 ('actor','ui','Chọn thao tác và gửi revision',False),('ui','svc','Gửi dữ liệu sản phẩm và biến thể',False),
 ('svc','db','Kiểm quyền; khóa bản hiện tại nếu đã có',False),
 ('svc','ui','Từ chối conflict, dữ liệu sai hoặc xóa bản đã dùng',True),
 ('svc','db','Lưu DRAFT, NEEDS_REVIEW; cập nhật ảnh, SKU và audit; COMMIT',False),
 ('svc','db','Xóa nháp chưa tham chiếu và audit; COMMIT',False),
 ('svc','svc','Kiểm nội dung, ảnh, biến thể ACTIVE và quyền sử dụng',False),
 ('svc','db','Ghi PUBLISHED, APPROVED, người rà soát, audit; COMMIT',False),
 ('svc','ui','Nêu điều kiện xuất bản chưa đạt; giữ dữ liệu',True),
 ('svc','db','Ghi HIDDEN hoặc ARCHIVED, giữ lịch sử và audit; COMMIT',False),
 ('svc','ui','Trả kết quả thao tác đã chọn',True)],
 [(3,9,'alt',[(3,'[Không đủ điều kiện thao tác]'),(4,'[Thêm hoặc sửa hợp lệ]'),(5,'[Xóa nháp chưa dùng]'),(6,'[Yêu cầu xuất bản]'),(9,'[Ẩn hoặc lưu trữ hợp lệ]')]),
  (7,8,'alt',[(7,'[Đủ điều kiện xuất bản]'),(8,'[Chưa đủ điều kiện xuất bản]')])],
 'Đồng bộ lớp/ERD/trạng thái; xuất bản có nhánh bị chặn; sửa không làm đổi giá đã chốt của đơn.',service='DichVuSanPham')
seq(81,'SEQ27 - Biến động kho và yêu cầu lặp',[
 ('actor','ui','Nhập mặt hàng, lượng và lý do',False),('ui','svc','Gửi thao tác với khóa lặp',False),
 ('svc','db','BEGIN; kiểm quyền, khóa nguồn và đọc kết quả cũ',False),('db','svc','Hiệu lực cũ hoặc tồn khả dụng',True),
 ('svc','db','ROLLBACK; không ghi biến động',False),('svc','ui','Từ chối dữ liệu sai, khác payload hoặc thiếu tồn',True),
 ('svc','db','Kết thúc giao dịch không ghi thêm',False),('svc','ui','Trả kết quả cũ cho cùng chủ và dữ liệu',True),
 ('svc','db','Ghi biến động, khóa lặp và audit; COMMIT',False),('svc','ui','Trả kết quả mới đã commit',True)],
 [(4,9,'alt',[(4,'[Sai quyền, conflict hoặc tạo mới thiếu tồn]'),(6,'[Cùng yêu cầu đã có kết quả]'),(8,'[Chưa có kết quả và đủ điều kiện]')])],
 'Replay tách khỏi ghi mới; không tạo biến động hoặc trừ tồn lần hai.',service='DichVuVanHanh')

status(89,'','ST07 - Trạng thái xuất bản sản phẩm',[
 ('draft','Nháp (DRAFT)'),('published','Công khai (PUBLISHED)'),('hidden','Ẩn (HIDDEN)'),('archived','Lưu trữ (ARCHIVED)')],[
 ('draft','published','xuất bản [nội dung, ảnh, SKU và quyền đạt]'),
 ('published','hidden','ẩn / giữ lịch sử'),('hidden','published','xuất bản lại [kiểm lại điều kiện]'),
 ('published','archived','lưu trữ / giữ lịch sử'),('hidden','archived','lưu trữ'),
 ('published','draft','sửa / thu hồi duyệt'),('hidden','draft','sửa / thu hồi duyệt'),('archived','draft','sửa / tạo lại bản nháp')],
 'Trạng thái xuất bản độc lập trạng thái rà soát; xóa là kết thúc vòng đời, không là trạng thái lưu trữ.')
# Final pseudostate means the object no longer exists, not a fake persisted DELETED.
p=book.pages[-1];p.final('deleted',1600,1900);p.height=max(p.height,2070);p.model.set('pageHeight',str(p.height))
p.edge('draft','deleted','xóa [nháp chưa có tham chiếu]','flow')
status(90,'','ST08 - Trạng thái tài khoản theo chính sách',[
 ('pending','Chờ xác minh'),('active','Đang hoạt động'),('locked','Đã khóa')],[
 ('pending','active','xác minh [token hợp lệ]'),('active','locked','quản trị khóa'),('locked','active','mở khóa [đủ điều kiện]')],
 'Khởi tạo theo chính sách xác minh; xóa nháp chưa dùng dẫn tới final, không thêm trạng thái DB giả.')
p=book.pages[-1]
for c in list(p.root):
    if c.get('source')=='start':p.root.remove(c)
p.node('policy','',100,480,80,80,'rhombus;');p.edge('start','policy',kind='flow')
p.edge('policy','pending','[cần xác minh]','flow',ports='exitX=1;exitY=0.25;entryX=0;entryY=0.5;')
p.edge('policy','active','[không yêu cầu xác minh]','flow',points=[(105,750),(1440,750)],ports='exitX=0.5;exitY=1;entryX=0.5;entryY=1;')
p.final('deleted',500,1100);p.edge('pending','deleted','xóa [chưa được dùng]','flow');p.model.set('pageHeight','1350')
status(None,'st10-product-review','ST10 - Rà soát khi chỉnh sửa và xuất bản',[
 ('pending','Chờ rà soát (PENDING)'),('needs','Cần rà soát lại (NEEDS_REVIEW)'),('approved','Đã duyệt (APPROVED)')],[
 ('pending','approved','duyệt và xuất bản [mọi điều kiện đạt]'),('needs','approved','duyệt và xuất bản [mọi điều kiện đạt]'),
 ('approved','needs','sửa nội dung / xóa kết quả duyệt cũ'),('pending','needs','sửa nội dung')],
 'Tách rà soát khỏi xuất bản; điều kiện xuất bản chưa đạt không tự ghi REJECTED. Luồng xử lý REJECTED riêng cần chốt.')
status(None,'st11-variant','ST11 - Trạng thái bán của biến thể',[
 ('active','Được bán (ACTIVE)'),('out','Tạm hết hàng (OUT_OF_STOCK)'),('inactive','Ngừng bán (INACTIVE)')],[
 ('active','out','cập nhật hết hàng'),('out','active','mở bán lại [đủ điều kiện]'),
 ('active','inactive','ngừng bán / giữ tham chiếu đơn'),('out','inactive','ngừng bán'),('inactive','active','mở bán lại [đủ điều kiện]')],
 'Trạng thái bán SKU riêng, không đồng nhất số dư kho; mua còn phụ thuộc sản phẩm công khai/đã duyệt.')

p=B.class_page(book,None,'el27-product-order','EL27 - Lớp sản phẩm giỏ hàng và giá chốt của đơn',[
 ('product','SanPham',['- ma: UUID','- ten: String','- xuatBan: TrangThaiXuatBan','- tuanThu: TrangThaiRaSoat'],['+ duDieuKienXuatBan(): Boolean']),
 ('variant','BienThe',['- ma: UUID','- sku: String','- giaBan: Money','- trangThai: TrangThaiBienThe'],['+ sua(duLieu: NoiDungBienThe): void']),
 ('cart','GioHang',['- maGio: String'],['+ them(bienThe: UUID, luong: Integer): void','+ tongTamTinh(): Money']),
 ('cartline','DongGio',['- maBienThe: UUID','- soLuong: Integer','- thongTinHienThi: SanPhamCongKhai'],['+ hopLe(): Boolean']),
 ('order','DonHang',['- ma: UUID','- tongTien: Money','- trangThai: TrangThaiDon'],['+ tinhTong(): Money']),
 ('orderline','DongDonHang',['- ma: UUID','- loaiDong: LoaiDongDon','- maThongSo: UUID?','- soLuong: Integer','- tenChot: String','- donGiaChot: Money'],['+ thanhTien(): Money'])],
 [('product','variant','1','0..*','composition'),('cart','cartline','1','0..*','composition'),
  ('variant','cartline','1','0..*','assoc'),('order','orderline','1','1..*','composition'),
  ('variant','orderline','0..1','0..*','assoc')])
result.append(p.element);pages.append(p.element);tables.add(len(pages))
record(len(pages),'Bổ sung liên kết UML từ SKU sang giỏ/dòng đơn, tách giá tạm tính và giá chốt; dòng custom không bắt buộc SKU.')

# Use case cleanup: remove storage/return-value ovals, not business capabilities.
for n,key in [(120,'inc03'),(121,'inc03'),(124,'inc03'),(134,'inc03')]:
    remove(n,key);record(n,'Bỏ oval ghi/trả kết quả nội bộ; giữ hành vi nghiệp vụ include và extend có điều kiện.')
text(110,'inc02','Tạo tài khoản khách hàng')
# Mail creation is conditional on policy, so use extension rather than include.
for c in pages[109].findall('.//mxCell'):
    if c.get('target')=='inc03':
        c.set('source','inc03');c.set('target','base');c.set('value','«extend»\n[chính sách yêu cầu xác minh email]')
text(110,'inc03','Yêu cầu xác minh email sau đăng ký')
record(110,'Không include tạo tài khoản chờ và thư trong mọi đăng ký; nhánh xác minh phụ thuộc chính sách.')
text(128,'inc03','Lưu sản phẩm và thu hồi kết quả duyệt')
record(128,'Thay nhãn mơ hồ bằng đúng trách nhiệm lưu sản phẩm; trang này là tham chiếu, không là chức năng mới.')
text(27,'unpublish','Ẩn hoặc lưu trữ sản phẩm')
record(27,'Đồng nhất ẩn/lưu trữ sản phẩm với trạng thái xuất bản; ngừng bán dùng riêng cho biến thể.')
text(104,'line-attrs','- maBienThe: UUID\n- soLuong: Integer\n- thongTinHienThi: SanPhamCongKhai')
record(104,'Giỏ chỉ giữ projection công khai để hiển thị, không sở hữu aggregate sản phẩm hoặc giá chốt.');tables.add(104)

# Scale only rebuilt pages. Original user's geometry/text remains native.
B.enlarge_typography(book)

def fit_tables(n):
    page=pages[n-1];model=page.find('mxGraphModel');root=model.find('root')
    cells={c.get('id'):c for c in root.findall('mxCell')}
    entities={k:c for k,c in cells.items() if 'swimlane;' in c.get('style','')}
    edges=[c for c in cells.values() if c.get('source') in entities and c.get('target') in entities]
    maxw=1700
    # Reflow/resize compartments; preserve the user's child grouping.
    parts={}
    for key,c in entities.items():
        ox,oy,ow,oh=R.box(c);w=max(ow,maxw);header=120;cursor=header+24;parts[key]=[]
        R.put(c,fontSize=64,startSize=header)
        for suffix in ['-attrs','-ops']:
            child=cells.get(key+suffix)
            if child is None:continue
            value=R.reflow(child.get('value',''),52,w-90,True);child.set('value',value);R.put(child,fontSize=52)
            height=max(80,len(value.split('\n'))*62+20)
            relative=child.get('parent')==key
            R.geometry(child,x=30 if relative else ox+30,y=cursor if relative else oy+cursor,w=w-60,h=height)
            parts[key].append((child,30,cursor,relative));cursor+=height+30
        R.geometry(c,w=w,h=cursor+15)
    # Preserve ordering of user's edited ERD examples, but widen row/column gaps
    # as needed when newly supplied attributes make the tables larger.
    if n in [13,14]:
        old={k:R.box(c) for k,c in entities.items()}
        # Deterministic relative rank preserves the intended grid, no line bends.
        xs=sorted(set(round(v[0],1) for v in old.values()));ys=sorted(set(round(v[1],1) for v in old.values()))
        # Original pages have deliberate offsets; arbitrary small y differences
        # do not imply another row. Use graph layout to avoid traversing tables.
        positions,score=R.arrange(list(entities),[(e.get('source'),e.get('target')) for e in edges],max(R.box(c)[2] for c in entities.values()),max(R.box(c)[3] for c in entities.values()))
    else:
        positions,score=R.arrange(list(entities),[(e.get('source'),e.get('target')) for e in edges],max(R.box(c)[2] for c in entities.values()),max(R.box(c)[3] for c in entities.values()))
    for key,c in entities.items():
        x,y=positions[key];R.geometry(c,x=x,y=y)
        for child,dx,dy,relative in parts[key]:
            if not relative:R.geometry(child,x=x+dx,y=y+dy)
        sep=cells.get(key+'-sep')
        if sep is not None and len(parts[key])==2:
            yy=y+parts[key][1][2]-15;pts=sep.findall('./mxGeometry/mxPoint')
            for pt,xx in zip(pts,[x,x+R.box(c)[2]]):pt.set('x',str(xx));pt.set('y',str(yy))
    for e in edges:
        a=R.box(entities[e.get('source')]);b=R.box(entities[e.get('target')]);start,end=R.straight(a,b)
        R.put(e,edgeStyle='none',curved=0,rounded=0,exitX=(start[0]-a[0])/a[2],exitY=(start[1]-a[1])/a[3],entryX=(end[0]-b[0])/b[2],entryY=(end[1]-b[1])/b[3],exitPerimeter=0,entryPerimeter=0)
        for child in list(e.find('mxGeometry')):
            if child.tag=='Array' or child.get('as') in ['sourcePoint','targetPoint']:e.find('mxGeometry').remove(child)
    xmax=max(R.box(c)[0]+R.box(c)[2] for c in entities.values());ymax=max(R.box(c)[1]+R.box(c)[3] for c in entities.values())
    title=root.findall('mxCell')[2];R.geometry(title,w=xmax-100,h=170)
    title.set('value',R.reflow(page.get('name').upper(),64,xmax-120))
    model.set('pageWidth',str(xmax+160));model.set('pageHeight',str(ymax+160))

for n in sorted(tables):fit_tables(n)

# Refit changed original text. Large labels must never escape their old boxes.
for n in changes:
    page=pages[n-1];model=page.find('mxGraphModel');maxx=maxy=0
    for c in page.findall('.//mxCell'):
        g=c.find('mxGeometry');v=c.get('value','');st=R.style(c)
        if c.get('vertex')!='1' or c.get('parent')!='1' or g is None:continue
        x,y,w,h=R.box(c)
        if v and 'swimlane' not in c.get('style','') and not c.get('id','').startswith('frame'):
            size=float(st.get('fontSize',52));ellipse='ellipse;' in c.get('style','');diamond='rhombus;' in c.get('style','')
            width=w*(.78 if ellipse else .59 if diamond else 1)-40
            val=R.reflow(v,size,max(width,40),c.get('id','').endswith(('-attrs','-ops')))
            c.set('value',val);needed=len(val.split('\n'))*size*1.18+24
            needed/= .83 if ellipse else .65 if diamond else 1
            if needed>h:R.geometry(c,h=needed);h=needed
        maxx=max(maxx,x+w);maxy=max(maxy,y+h)
    model.set('pageWidth',str(max(float(model.get('pageWidth')),maxx+80)))
    model.set('pageHeight',str(max(float(model.get('pageHeight')),maxy+80)))

# Grow activity spacing with the actual large-font labels, including branch
# endpoints. A long rejection message must not cover its final pseudostate.
activity_pages=[p for p in book.pages if p.typ=='Activity']
from types import SimpleNamespace
activity_pages += [SimpleNamespace(root=pages[n-1].find('mxGraphModel/root'),model=pages[n-1].find('mxGraphModel')) for n in [20,61]]
for p in activity_pages:
    cells={c.get('id'):c for c in p.root.findall('mxCell')}
    spine=[c for k,c in cells.items() if c.get('vertex')=='1' and c.get('parent')=='1'
           and k not in ['__initial','end','end-dot'] and not k.startswith('branch')
           and c is not p.root.findall('mxCell')[2]]
    spine.sort(key=lambda c:R.box(c)[1]);cursor=450
    for c in spine:
        R.geometry(c,y=cursor);cursor+=R.box(c)[3]+170
    R.geometry(cells['end'],y=cursor);R.geometry(cells['end-dot'],y=cursor+13.5)
    for c in cells.values():
        if c.get('edge')!='1' or not re.fullmatch(r'branch\d+',c.get('target','')):continue
        branch=cells[c.get('target')];source=cells[c.get('source')]
        x,_,w,h=R.box(branch);y=R.box(source)[1]+15;R.geometry(branch,y=y)
        end=cells.get(branch.get('id')+'-end');dot=cells.get(branch.get('id')+'-end-dot')
        if end is not None:R.geometry(end,y=y+h+80)
        if dot is not None:R.geometry(dot,y=y+h+93.5)
        cursor=max(cursor,y+h+200)
    p.model.set('pageHeight',str(cursor+220))

for p in book.pages:
    if p.typ!='State':continue
    for c in p.root.findall('mxCell'):
        if c.get('edge')!='1' or not c.get('value'):continue
        value=' '.join(c.get('value').split())
        value=value.replace('xuất bản [nội dung, ảnh, SKU và quyền đạt]','xuất bản [đủ điều kiện]')
        value=value.replace('xuất bản lại [kiểm lại điều kiện]','xuất bản lại [đạt]')
        value=value.replace('sửa / tạo lại bản nháp','sửa / về nháp')
        value=value.replace('duyệt và xuất bản [mọi điều kiện đạt]','duyệt và xuất bản [đạt]')
        value=value.replace('sửa nội dung / xóa kết quả duyệt cũ','sửa / thu hồi duyệt')
        value=value.replace('sửa nội dung để rà soát lại','sửa / cần rà soát lại')
        value=value.replace('[không yêu cầu xác minh]','[không cần xác minh]')
        c.set('value',R.reflow(value,40,440));R.put(c,fontSize=40,labelWidth=440)

# Nested sequence fragments get their own inset borders and guard columns.
for p in book.pages:
    if p.typ!='Sequence':continue
    cells={c.get('id'):c for c in p.root.findall('mxCell')}
    frames=[c for k,c in cells.items() if re.fullmatch(r'frame\d+',k)]
    for f in frames:
        x,y,w,h=R.box(f)
        depth=sum(R.box(other)[1]<=y and R.box(other)[1]+R.box(other)[3]>=y+h
                  for other in frames if other is not f)
        if not depth:continue
        delta=120*depth;R.geometry(f,x=x+delta,w=w-2*delta)
        for k,c in cells.items():
            if k.startswith(f.get('id')+'-guard'):
                cx,cy,cw,ch=R.box(c);R.geometry(c,x=cx+delta,w=cw-2*delta)
            if k.startswith(f.get('id')+'-sep'):
                pts=c.findall('./mxGeometry/mxPoint')
                for pt,xx in zip(pts,[x+delta,x+w-delta]):pt.set('x',str(xx))

REPORT.mkdir(parents=True,exist_ok=True);QA.mkdir(parents=True,exist_ok=True);VIEW.mkdir(parents=True,exist_ok=True)
def save(root,path):
    ET.indent(root,space='  ');ET.ElementTree(root).write(path,encoding='utf-8',xml_declaration=True)
save(result,OUT)
# The report excludes 24 redundant technical UC views, retaining original IDs.
selected=list(range(1,108))+[120,121,123,124,134,137,138,139]
core=copy.deepcopy(result)
for n,page in reversed(list(enumerate(core.findall('diagram'),1))):
    if n not in selected:core.remove(page)
CORE=OUT.with_name('minhlab-ooad-bo-bao-cao-2026-11-08.drawio');save(core,CORE)
product_pages=[27,28,29,134,42,139,13,68,80,89,137,138,104,15,14]
product=copy.deepcopy(result)
for p in list(product):product.remove(p)
for n in product_pages:product.append(copy.deepcopy(pages[n-1]))
PRODUCT=OUT.with_name('minhlab-uml-san-pham-2026-11-08.drawio');save(product,PRODUCT)

manifest={'source':str(SOURCE),'source_sha256':digest(SOURCE),'output':str(OUT),'output_sha256':digest(OUT),
 'pages':len(pages),'changed_pages':[{'page':n,'id':pages[n-1].get('id'),'name':pages[n-1].get('name'),'changes':v} for n,v in sorted(changes.items())],
 'report_pages':selected,'product_pages':product_pages,'report_page_count':len(selected),'product_page_count':len(product_pages),
 'original_page_ids_preserved':all(a.get('id')==b.get('id') for a,b in zip(original.findall('diagram'),pages)),
 'untouched_pages':[],'removed_cells':[],'implementation':'DESIGN_MODEL; current physical mapping described separately'}
for n,(old,new) in enumerate(zip(original.findall('diagram'),pages),1):
    if n not in changes:
        oldcopy=copy.deepcopy(old);newcopy=copy.deepcopy(new)
        for tree in [oldcopy,newcopy]:
            for element in tree.iter():
                element.tail=None
                if element.text is not None and not element.text.strip():element.text=None
        assert ET.tostring(oldcopy)==ET.tostring(newcopy),(n,'unexpected mutation')
        manifest['untouched_pages'].append(n)
    before={c.get('id') for c in old.findall('.//mxCell')};after={c.get('id') for c in new.findall('.//mxCell')}
    if before-after:manifest['removed_cells'].append({'page':n,'ids':sorted(before-after),'reason':changes.get(n)})
(OUT.with_suffix('.manifest.json')).write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
for n,page in enumerate(pages,1):
    one=ET.Element('mxfile');one.append(copy.deepcopy(page))
    data=html.escape(json.dumps({'highlight':'#000000','nav':True,'resize':True,'toolbar':'zoom layers lightbox','xml':ET.tostring(one,encoding='unicode')}),quote=True)
    (VIEW/f'page-{n:03}.html').write_text('<!doctype html><meta charset="utf-8"><style>body{margin:0;background:white}.mxgraph{width:100%;border:0}</style><div class="mxgraph" data-mxgraph="'+data+'"></div><script src="https://viewer.diagrams.net/js/viewer-static.min.js"></script>')
print(json.dumps({'pages':len(pages),'changed':sorted(changes),'unchanged':len(manifest['untouched_pages']),'core':len(selected),'product':len(product_pages)},ensure_ascii=False))
