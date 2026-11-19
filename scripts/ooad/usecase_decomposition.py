"""Focused use-case behavior decomposition, with single straight-line edges.

The optional entry points and required successful behavior are specified per view.
CRUD alternatives, login preconditions and chronological steps are not turned into
include/extend merely to increase relationship counts.
"""


def build_decomposition(book, actors):
    # key, title, actor, goal refs, precondition, required behavior, extensions,
    # dynamic/static evidence. Extension = name, short guard, extension point.
    definitions=[
      ('browse','Tra cứu sản phẩm','guest',['UC-01'],
       'Catalogue công khai; có thể vào trực tiếp một sản phẩm.',
       ['Đọc danh sách sản phẩm được công khai'],
       [('Lọc danh sách sản phẩm','khách chọn bộ lọc','Khi đang xem danh sách'),
        ('Xem chi tiết sản phẩm','khách chọn sản phẩm','Khi đang xem danh sách')],
       ['ACT28','SEQ29','EL17','ERD01']),
      ('cart','Thay đổi giỏ hàng','guest',['UC-02'],
       'Khách chọn đúng một thao tác thêm, đổi lượng hoặc xóa; giỏ thuộc trình duyệt.',
       ['Kiểm tra thao tác và dữ liệu giỏ','Cập nhật dòng giỏ theo thao tác','Tính tổng tiền tạm tính'],[],
       ['ACT29','SEQ30','EL25']),
      ('register','Đăng ký tài khoản','guest',['UC-03.1'],
       'Người dùng chưa có tài khoản tương ứng; vai trò tạo công khai là CUSTOMER.',
       ['Kiểm tra thông tin đăng ký','Tạo tài khoản chờ xác minh','Lập thư xác minh sau đăng ký'],[],
       ['ACT16','SEQ16','EL16','EL21','ERD03']),
      ('verify-email','Xác minh email','Người có liên kết xác minh',['UC-03.2'],
       'Có liên kết xác minh; token chỉ được dùng một lần.',
       ['Kiểm tra liên kết xác minh','Xác nhận email tài khoản'],
       [('Yêu cầu liên kết xác minh mới','liên kết không dùng được và khách yêu cầu','Sau khi báo liên kết sai, hết hạn hoặc đã dùng')],
       ['ACT16','SEQ16','EL16','ERD03']),
      ('login','Đăng nhập','Người có tài khoản',['UC-04.1'],
       'Tài khoản hiện hoạt và đáp ứng chính sách xác minh; đây là thủ tục login riêng.',
       ['Kiểm tra thông tin đăng nhập','Cấp phiên theo vai trò hiện hành'],[],
       ['ACT17','SEQ17','EL21','ERD03']),
      ('reset','Đặt lại mật khẩu','Người có liên kết khôi phục',['UC-05'],
       'Đã mở liên kết khôi phục; yêu cầu liên kết và đặt mật khẩu là hai chặng khác nhau.',
       ['Kiểm tra liên kết khôi phục','Đổi mật khẩu tài khoản','Dùng token và thu hồi các phiên cũ'],[],
       ['ACT18','SEQ18','EL21','ERD03']),
      ('checkout','Đặt hàng catalogue','guest',['UC-06'],
       'Guest hoặc CUSTOMER; giỏ hợp lệ; checkout mới chỉ dùng VietQR.',
       ['Kiểm tra giỏ hàng và giá bán','Tính tổng tiền đơn hàng','Giải quyết đơn và khoản thanh toán chờ'],[],
       ['EL08','EL15','EL05','EL21','ERD02']),
      ('declare','Khai báo chuyển khoản','customer',['UC-07'],
       'Chủ đơn hoặc guest có token; khoản chưa VERIFIED; không xác nhận tiền bằng lời khai.',
       ['Xác định khoản được phép khai báo','Ghi nhận thông tin chuyển khoản'],[],
       ['EL02','EL15','EL05','ERD02']),
      ('reconcile','Xác nhận đã nhận tiền','staff',['UC-08.1'],
       'STAFF hoặc ADMIN có quyền; đã kiểm giao dịch ngân hàng ngoài website.',
       ['Kiểm tra điều kiện đối soát','Giải quyết kết quả xác nhận tiền','Cung cấp trạng thái đơn sau đối soát'],[],
       ['ACT19','SEQ23','EL05','EL21','ERD02','ST02']),
      ('tracking','Tra cứu đơn riêng tư','customer',['UC-09'],
       'Chủ đơn hoặc token hợp lệ cho tra một đơn; lịch sử chỉ dùng danh tính phiên.',
       ['Xác định phạm vi đơn được xem','Đọc thông tin và tiến độ được phép'],[],
       ['ACT30','SEQ31','EL21','ERD02']),
      ('order-work','Điều phối tiến độ đơn hàng','staff',['UC-10'],
       'STAFF hoặc ADMIN có quyền, trạng thái có cạnh chuyển và đạt payment policy.',
       ['Kiểm tra điều kiện chuyển trạng thái','Ghi nhận trạng thái và lịch sử'],
       [('Ghi thông tin bàn giao vận chuyển','chuyển sang đã bàn giao vận chuyển','Khi ghi chuyển trạng thái sang SHIPPED')],
       ['ACT24','EL05','EL21','ERD02','ST01']),
      ('file-intake','Gửi yêu cầu in theo tệp','customer',['UC-12.1'],
       'CUSTOMER có phiên; chấp nhận chính sách tệp; preview STL không thay hồ sơ chính thức.',
       ['Ghi nhận khai báo quyền sử dụng','Kiểm tra tệp và thông số tiếp nhận','Lưu phiên bản yêu cầu in'],[],
       ['ACT20','SEQ19','EL18','EL22','ERD04']),
      ('inspection','Thẩm định yêu cầu in','reviewer',['UC-12.3','UC-12.4'],
       'FILE_REVIEWER xử lý đúng phiên bản yêu cầu/tệp được phép.',
       ['Kiểm tra khai báo quyền sử dụng','Đánh giá khả năng chế tạo','Ghi kết quả thẩm định'],
       [('Yêu cầu sửa hoặc bổ sung tệp','tệp hoặc thông số cần bổ sung','Sau đánh giá tệp, trước khi kết luận đủ điều kiện báo giá')],
       ['ACT21','SEQ20','EL18','EL22','ERD04','ST03']),
      ('quote','Phát hành báo giá chính thức','reviewer',['UC-12.5'],
       'Đủ dữ liệu thẩm định và kỹ thuật; người phát hành có quyền.',
       ['Chốt thông số và số lượng','Xác định giá và thời hạn báo giá','Lưu bản báo giá đã phát hành'],[],
       ['ACT21','SEQ20','EL06','EL22','ERD05','ST04']),
      ('accept','Chấp thuận báo giá và đặt in','customer',['UC-12.8'],
       'CUSTOMER đúng chủ yêu cầu; xác định đúng phiên bản/snapshot; một acceptance một đơn đủ lượng.',
       ['Xác nhận chủ yêu cầu và bản chốt','Giải quyết đơn từ lần chấp thuận','Cung cấp kết quả đặt in'],[],
       ['ACT22','SEQ21','SEQ22','EL06','EL22','ERD05','ST04']),
      ('plan-prepare','Lập đề xuất kế hoạch sản xuất','admin',['UC-13.9'],
       'Chỉ nhu cầu catalogue đủ điều kiện; CUSTOM_PRINT không vào planner catalogue.',
       ['Chốt nhu cầu và phiên bản BOM','Tính tồn và lượng còn phải chế tạo','Kiểm tra tương thích toàn mẻ','Xác minh bằng chứng slicer'],[],
       ['EL10','SEQ24','EL07','EL19','EL22','ERD06','ERD07','ST05']),
      ('plan-apply','Duyệt và áp dụng kế hoạch','admin',['UC-13.10'],
       'Kế hoạch được người có quyền chọn duyệt; proposal đã có bằng chứng, apply vẫn phải đọc lại nguồn.',
       ['Kiểm tra nguồn kế hoạch hiện hành','Kiểm tra ràng buộc và bằng chứng slicer','Giải quyết kết quả áp dụng kế hoạch'],[],
       ['EL10','SEQ24','SEQ28','EL07','EL22','ERD07','ST05']),
      ('print-start','Ghi nhận bắt đầu công việc in','operator',['UC-13.2','UC-13.3'],
       'Job được phát hành/giao cho operator; người thợ khởi động máy thủ công.',
       ['Kiểm tra máy vật tư và công việc','Ghi nhận lần in và thông số thực tế'],[],
       ['ACT23','SEQ25','EL20','EL22','ERD08','ST06']),
      ('qc','Kiểm định chất lượng','operator',['UC-13.5','UC-13.7'],
       'Có kết quả in để kiểm định; operator ghi QC theo allocation.',
       ['Ghi số lượng đạt và lỗi theo phân bổ','Xác định lượng còn thiếu'],
       [('Đề nghị in lại phần thiếu','còn thiếu lượng và thợ đề nghị','Sau khi lưu kết quả QC và lượng thiếu')],
       ['ACT23','SEQ25','EL20','ERD08','ST06']),
      ('stock','Ghi biến động kho','admin',['UC-13.6','DESIGN-STOCK'],
       'Chọn một nghiệp vụ nhập, xuất hoặc điều chỉnh; đúng quyền theo nguồn/đơn vị/lượng.',
       ['Xác định mặt hàng lượng và lý do','Kiểm tra tồn và lượng đã giữ','Ghi biến động và lịch sử kho'],[],
       ['ACT25','SEQ27','EL19','EL20','ERD09','ERD10','ERD11']),
      ('catalog-edit','Thêm hoặc sửa sản phẩm','admin',['UC-15.1','CRUD-PRODUCT','CRUD-VARIANT'],
       'ADMIN chọn một thao tác thêm hoặc sửa; revision hiện hành khi sửa.',
       ['Kiểm tra nội dung và biến thể','Xác định phiên bản dữ liệu cần ghi','Lưu catalogue và thu hồi duyệt khi cần'],[],
       ['ACT26','SEQ26','EL17','EL22','ERD01','ST07']),
      ('resource-edit','Cập nhật máy in hoặc vật tư','admin',['UC-13.8','CRUD-MATERIAL','CRUD-PRINTER'],
       'ADMIN chọn đối tượng; có dữ liệu cấu hình kỹ thuật và revision cần thiết.',
       ['Kiểm tra cấu hình kỹ thuật','Kiểm tra ảnh hưởng đến dữ liệu đang dùng','Lưu thay đổi và lịch sử cấu hình'],[],
       ['ACT27','EL19','EL22','ERD09']),
      ('bom','Phát hành phiên bản BOM','admin',['DESIGN-BOM'],
       'Có BOM nháp và các revision linh kiện/thông số; không sửa đè bản đã phát hành.',
       ['Kiểm tra linh kiện và thông số','Kiểm tra định mức và số lượng','Lưu phiên bản BOM đã phát hành'],[],
       ['UC17','EL19','ERD06','EL10']),
      ('tour','Khám phá phòng lab','guest',['DESIGN-3D-TOUR'],
       'Trang giới thiệu công khai; tài nguyên 3D tải phía client.',
       ['Tải nội dung giới thiệu phòng lab'],
       [('Hiển thị nội dung dự phòng','WebGL không hỗ trợ hoặc tải 3D lỗi','Khi kiểm khả năng thiết bị hoặc khởi tạo scene không thành công')],
       ['ACT31','SEQ32','EL24','EL11']),
      ('notify','Gửi thông báo nghiệp vụ','Worker thông báo',['DESIGN-NOTIFY'],
       'Đã có outbox commit và bản ghi đến hạn; worker nằm trong hệ thống, nhà cung cấp là actor ngoài.',
       ['Nhận thông báo đến hạn','Gửi theo kênh thông báo','Ghi nhận kết quả gửi'],[],
       ['ACT32','SEQ33','EL26','ERD12','ST09']),
      ('delete','Xóa dữ liệu chưa sử dụng','admin',['CRUD-PRODUCT','CRUD-CATEGORY','CRUD-VARIANT','CRUD-MATERIAL','CRUD-PRINTER'],
       'Chọn bản nháp hoặc cấu hình chưa dùng; phải đạt chính sách của từng loại đối tượng.',
       ['Kiểm tra trạng thái được phép xóa','Kiểm tra dữ liệu tham chiếu','Ghi kết quả xóa và lịch sử'],[],
       ['ACT26','ACT27','SEQ26','EL17','ST07']),
      ('publish','Xuất bản sản phẩm','admin',['UC-15.2'],
       'ADMIN; dữ liệu sản phẩm đã được rà soát; chỉ xuất bản revision hợp lệ.',
       ['Rà soát nội dung và quyền sử dụng','Kiểm tra biến thể đủ điều kiện bán','Ghi nhận trạng thái xuất bản'],[],
       ['ACT26','SEQ26','EL17','ERD01','ST07']),
      ('roles','Cấp hoặc thu hồi vai trò nhân sự','admin',['DESIGN-STAFF-ACCOUNTS'],
       'ADMIN có quyền quản lý nhân sự; chỉ năm vai trò cố định, không thiết kế engine phân quyền động.',
       ['Kiểm tra vai trò được phép gán','Ghi nhận thay đổi quyền và lịch sử'],[],
       ['UC13','EL16','ERD03','ST08']),
      ('quote-revision','Lập phiên bản báo giá mới','reviewer',['UC-12.6'],
       'Có báo giá trước đó và dữ liệu kỹ thuật cần thay đổi; không sửa snapshot đã chấp thuận.',
       ['Chốt lại thông số lượng và giá','Tạo revision báo giá mới','Giữ lịch sử các bản báo giá'],[],
       ['ACT21','SEQ20','EL06','EL22','ERD05','ST04']),
    ]
    for number,(key,goal,actor,refs,pre,required,extensions,evidence) in enumerate(definitions,25):
        # Notify worker is internal. The supplier alone is an outside actor.
        public_actor='Nhà cung cấp thông báo' if key=='notify' else actors.get(actor,actor)
        public_actor={'browse':'Người truy cập','cart':'Người truy cập','tour':'Người truy cập',
                      'checkout':'Khách đặt hàng','declare':'Khách có quyền với đơn',
                      'tracking':'Khách có quyền với đơn','reconcile':'Nhân viên đối soát',
                      'order-work':'Nhân viên điều phối'}.get(key,public_actor)
        height=1660 if len(required)>3 else 1550
        p=book.page(None,'ucd-'+key,f'UC{number:02} - Phân rã {goal.lower()}',
                    'UseCase',width=2860,height=height,ucs=refs)
        p.node('system','MinhLab 3D',360,150,2400,height-240,
               'swimlane;startSize=42;container=0;collapsible=0;align=left;spacingLeft=18;fontSize=22;fontStyle=1;')
        p.node('actor',public_actor,70,635,210,180,
               'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;fontSize=24;')
        p.node('base',goal,600,650,820,150,'ellipse;fontSize=25;')
        p.edge('actor','base')
        for i,label in enumerate(required):
            cid=f'inc{i+1:02}'
            p.node(cid,label,1900,220+i*340,820,150,'ellipse;fontSize=25;')
            ports=f'exitX=1;exitY={(i+1)/(len(required)+1)};entryX=0;entryY=0.5;'
            p.edge('base',cid,'«include»','include',ports=ports)
            p.relations[-1].update(condition_or_reason='Hành vi bắt buộc tại điểm chèn trong luồng thành công: '+label,
                                  evidence_views=evidence,inclusion_point=label)
        for i,(label,guard,point) in enumerate(extensions):
            cid=f'ext{i+1:02}'
            y=220 if len(extensions)==2 and i==0 else 1180
            p.node(cid,label,600,y,820,150,'ellipse;fontSize=25;')
            import textwrap
            short_guard='\n'.join(textwrap.wrap('['+guard+']',width=28))
            p.edge(cid,'base','«extend»\n'+short_guard,'extend')
            p.relations[-1].update(condition_or_reason=guard,extension_point=point,evidence_views=evidence)
            p.edge('actor',cid)
        p.record['decomposition']={'base_cell':'base','preconditions':pre,'required_behavior':required,
             'extensions':[{'name':name,'condition':condition,'extension_point':point} for name,condition,point in extensions],
             'trace_views':evidence,'straight_edges_only':True,
             'notes':'Includes describe required inserted behavior, not a mandatory menu sequence. Failure can terminate the base before a later insertion point.'}
        if key in ['roles','resource-edit','bom','delete']:
            p.record['new_design_scope']='Detailed requested design; policies and physical mapping remain subject to domain decisions.'
        if key=='notify':
            p.record['decomposition']['notes']+=' Worker is internal; supplier only communicates with send behavior.'
            edge=p.root.find('mxCell[@source="actor"][@target="base"]')
            edge.set('target','inc02')
            # Supplier approaches from outside right, with one horizontal line.
            geo=p.root.find('mxCell[@id="actor"]/mxGeometry');geo.set('x','2800');geo.set('y','545')
            p.width=3120;p.model.set('pageWidth','3120')
            title=p.root.findall('mxCell')[2].find('mxGeometry');title.set('width','2992')
            edge.set('style',edge.get('style')+'exitX=0;exitY=0.5;entryX=1;entryY=0.5;')
            p.relations[0]['target']='inc02'
