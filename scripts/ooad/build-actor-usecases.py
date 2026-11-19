#!/usr/bin/env python3
"""Native MinhLab use cases, grouped by actor and reusable business behavior.
Never overwrites an existing output or changes the user's source drawings.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('design_drawing',Path(__file__).with_name('build-design-pilot.py'))
b=importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
G={
 'browse':'Tra cứu sản phẩm', 'detail':'Xem chi tiết sản phẩm', 'cart':'Quản lý giỏ hàng',
 'qty':'Thay đổi số lượng', 'checkout':'Đặt hàng sản phẩm', 'shipping':'Nhập thông tin giao hàng',
 'total':'Tính tổng tiền đơn hàng', 'qr':'Nhận hướng dẫn VietQR',
 'track':'Tra cứu đơn bằng liên kết', 'history':'Xem lịch sử đơn hàng',
 'declare':'Khai báo chuyển khoản', 'proof':'Đính kèm bằng chứng',
 'estimate':'Ước tính giá in STL', 'geometry':'Phân tích hình học STL',
 'register':'Đăng ký tài khoản', 'login':'Đăng nhập', 'logout':'Đăng xuất',
 'profile':'Cập nhật hồ sơ cá nhân', 'verify_email':'Xác minh email',
 'reset':'Đặt lại mật khẩu', 'reset_link':'Nhận liên kết đặt lại mật khẩu',
 'request':'Gửi yêu cầu in theo tệp', 'intake':'Ghi nhận tệp và thông số',
 'view_quote':'Xem báo giá chính thức', 'accept':'Chấp thuận báo giá và đặt in',
 'convert':'Chuyển báo giá thành đơn', 'quote_decline':'Từ chối báo giá',
 'requests':'Xem yêu cầu chờ thẩm định', 'inspect':'Thẩm định yêu cầu in',
 'rights':'Kiểm tra khai báo quyền sử dụng', 'printable':'Đánh giá khả năng in',
 'fix_file':'Yêu cầu sửa hoặc thay tệp', 'issue':'Phát hành báo giá chính thức',
 'specs':'Chốt thông số và đơn giá', 'revise':'Lập phiên bản báo giá mới',
 'revision_history':'Xem lịch sử tệp và thông số',
 'orders':'Tra cứu đơn hàng cần xử lý', 'confirm_money':'Xác nhận đã nhận tiền',
 'reject_money':'Từ chối khai báo chuyển khoản', 'check_payment':'Kiểm tra khoản chờ thanh toán',
 'order_work':'Điều phối tiến độ đơn hàng', 'cancel':'Hủy đơn chưa thu tiền',
 'ship':'Ghi nhận bàn giao vận chuyển', 'complete':'Xác nhận giao hàng hoàn tất',
 'refund':'Tiếp nhận yêu cầu hoàn tiền',
 'jobs':'Xem công việc in được giao', 'prepare':'Chuẩn bị công việc in',
 'equipment':'Kiểm tra máy và vật tư', 'start_print':'Ghi nhận bắt đầu in',
 'postprocess':'Ghi nhận hậu xử lý', 'qc':'Kiểm định chất lượng',
 'qc_record':'Ghi số lượng đạt và lỗi', 'consumption':'Ghi nhận tiêu hao vật tư',
 'reprint_request':'Đề nghị in lại phần thiếu',
 'products':'Cập nhật sản phẩm và biến thể', 'publish':'Xuất bản sản phẩm',
 'publication_check':'Kiểm tra điều kiện xuất bản', 'resources':'Quản lý vật tư và máy in',
 'plan_review':'Rà soát kế hoạch sản xuất', 'compatibility':'Kiểm tra điều kiện gom mẻ',
 'slicer':'Kiểm tra bằng chứng slicer', 'apply':'Phê duyệt và áp dụng kế hoạch',
 'snapshot':'Kiểm tra lại nguồn kế hoạch', 'plan_reject':'Từ chối kế hoạch sản xuất',
 'quality_review':'Rà soát kết quả kiểm định',
}
ACTORS={
 'guest':'Khách vãng lai','customer':'Khách hàng','staff':'Nhân viên',
 'reviewer':'Người duyệt tệp','operator':'Thợ vận hành','admin':'Quản trị viên',
}
PAGES=[]
REL=[]


def actor(r,key,label,x,y):
 b.node(r,key,'',x,y,180,220,'shape=umlActor;')
 b.node(r,key+'_label',label,x-140,y+230,460,150,'shape=text;strokeColor=none;fontSize=56;')


def oval(r,key,x,y):
 # Explicit line breaks at word boundaries, with a deliberately generous oval.
 words=G[key].split();lines=[];line=''
 for word in words:
  if len(line)+len(word)+1>27:
   lines.append(line);line=word
  else:line=(line+' '+word).strip()
 if line:lines.append(line)
 b.node(r,key,'\n'.join(lines),x,y,1050,190,'ellipse;fontSize=60;spacing=16;')


def relationship(r,pid,source,target,kind,condition='',reason=''):
 label='«'+kind+'»'+ ('\n['+condition+']' if condition else '')
 src=r.find(f'mxCell[@id="{source}"]/mxGeometry'); dst=r.find(f'mxCell[@id="{target}"]/mxGeometry')
 points=None;ports='labelWidth=520;fontSize=46;'
 if src.get('x')==dst.get('x') and abs(float(src.get('y'))-float(dst.get('y')))>500:
  points=[(2050,float(src.get('y'))+95),(2050,float(dst.get('y'))+95)]
  ports+='exitX=1;exitY=0.5;entryX=1;entryY=0.5;'
 b.edge(r,'rel_'+source+'_'+target,source,target,label,kind,ports=ports,points=points)
 REL.append({'page':pid,'kind':kind,'source':source,'target':target,'condition':condition,'reason':reason})


def actor_page(pid,title,who,goals,aux=(),links=()):
 height=430+len(goals)*310
 r=b.page(pid,title,3650,height)
 b.node(r,'boundary','',560,170,2950,height-260,'rounded=0;')
 b.text(r,'system_name','MINHLAB 3D',610,190,2700,80,58,bold=True)
 actor_y=max(420,height/2-160)
 actor(r,who,ACTORS[who],160,actor_y)
 for i,key in enumerate(goals):
  oval(r,key,720,330+i*310)
  b.edge(r,'actor_'+key,who,key,ports='exitX=1;exitY=0.5;entryX=0;entryY=0.5;exitPerimeter=0;entryPerimeter=0;',points=[(520,actor_y+110)])
 for key,row in aux:oval(r,key,2320,330+row*310)
 for a,z,kind,condition,reason in links:relationship(r,pid,a,z,kind,condition,reason)
 PAGES.append({'id':pid,'name':title,'actors':[who],'goals':goals,'auxiliary':[x[0] for x in aux]})


def overview():
 r=b.page('d-uc00','UC00. Use Case tổng quát MinhLab 3D',4050,2750)
 b.node(r,'boundary','',650,170,2700,2440,'rounded=0;')
 b.text(r,'system_name','MINHLAB 3D',700,195,2500,80,58,bold=True)
 groups=[('guest',['browse','estimate'],160,440,800,330),
         ('customer',['checkout','request'],160,1240,800,1130),
         ('staff',['confirm_money','order_work'],160,2040,800,1930),
         ('reviewer',['inspect','issue'],3570,440,2150,330),
         ('operator',['prepare','qc'],3570,1240,2150,1130),
         ('admin',['products','apply'],3570,2040,2150,1930)]
 for who,goals,x,y,gx,gy in groups:
  actor(r,who,ACTORS[who],x,y)
  for n,key in enumerate(goals):
   oval(r,key,gx,gy+n*320)
   b.edge(r,'actor_'+who+'_'+key,who,key,ports='exitX=1;exitY=0.5;entryX=0;entryY=0.5;exitPerimeter=0;entryPerimeter=0;' if x<650 else 'exitX=0;exitY=0.5;entryX=1;entryY=0.5;exitPerimeter=0;entryPerimeter=0;')
 PAGES.append({'id':'d-uc00','name':'UC00. Use Case tổng quát MinhLab 3D','actors':list(ACTORS),'goals':[k for x in groups for k in x[1]],'auxiliary':[]})


def details(pid,title,actors,goals,positions,links):
 maxrow=max(row for col,row in positions.values())
 h=700+maxrow*440
 r=b.page(pid,title,3950,h)
 b.node(r,'boundary','',560,170,2850,h-260,'rounded=0;')
 b.text(r,'system_name','MINHLAB 3D',610,190,2600,80,58,bold=True)
 for n,who in enumerate(actors):
  actor(r,who,ACTORS[who],160 if n==0 else 3550,440+n*650)
 for key,(col,row) in positions.items():oval(r,key,720+col*1500,340+row*440)
 for n,(who,key) in enumerate(goals):
  side=actors.index(who);col,row=positions[key];points=[(520,550)] if side==0 else None
  if side==0 and col==1:
   points=[(480,550),(480,290),(2000,290),(2000,435+row*440)]
  elif side==1 and col==0:
   detour=290 if 435+row*440<1200 else h-40
   points=[(3460,1200),(3460,detour),(2000,detour),(2000,435+row*440)]
  b.edge(r,'actor_'+str(n),who,key,points=points,ports=f'exitX={1 if side==0 else 0};exitY=0.5;entryX={0 if side==0 else 1};entryY=0.5;exitPerimeter=0;entryPerimeter=0;')
 for a,z,kind,condition,reason in links:relationship(r,pid,a,z,kind,condition,reason)
 PAGES.append({'id':pid,'name':title,'actors':actors,'goals':[k for _,k in goals],'auxiliary':[k for k in positions if k not in {g for _,g in goals}]})


def build():
 overview()
 actor_page('d-uc01','UC01. Phân rã Khách vãng lai','guest',
 ['browse','cart','checkout','track','declare','estimate','register','login'],
 [('detail',0),('qty',1),('proof',4),('geometry',5)],
 [('detail','browse','extend','chọn xem sản phẩm','Xem chi tiết là phần bổ sung lúc duyệt danh sách; danh sách vẫn xem độc lập.'),
  ('qty','cart','extend','cần đổi số lượng','Giỏ có thể xem mà không sửa số lượng.'),
  ('proof','declare','extend','có bằng chứng','Khai báo không bắt buộc đính kèm ảnh.'),
  ('estimate','geometry','include','','Ước tính mới phải phân tích mô hình đã chọn; không phát hành formal Quote.')])
 actor_page('d-uc02','UC02. Phân rã Khách hàng','customer',
 ['browse','cart','checkout','history','declare','request','view_quote','accept'],
 [('detail',0),('qty',1),('proof',4),('intake',5),('quote_decline',6),('convert',7)],
 [('detail','browse','extend','chọn xem sản phẩm','Cùng nghĩa với UC01; mở trực tiếp là trigger khác của cùng UC chi tiết.'),
  ('qty','cart','extend','cần đổi số lượng','Thay đổi là tùy chọn khi xem giỏ.'),
  ('proof','declare','extend','có bằng chứng','Không dùng ảnh làm bằng chứng chắc chắn đã nhận tiền.'),
  ('request','intake','include','','Yêu cầu in mới phải ghi nhận phiên bản tệp và thông số.'),
  ('quote_decline','view_quote','extend','không chấp thuận','Khách có thể chỉ xem mà chưa quyết định.'),
  ('accept','convert','include','','Chấp thuận thành công gắn một đơn đủ lượng; retry nhận đơn cũ, không thêm đơn.')])
 actor_page('d-uc03','UC03. Phân rã Nhân viên','staff',
 ['orders','confirm_money','reject_money','order_work','cancel','ship','complete','refund'],
 [('check_payment',1)],
 [('confirm_money','check_payment','include','','Bắt buộc kiểm quyền/khoản chờ trước khi ghi quyết định xác nhận.'),
  ('reject_money','check_payment','include','','Tái dùng cùng kiểm tra khoản chờ trước quyết định từ chối.')])
 actor_page('d-uc05','UC05. Phân rã Người duyệt tệp','reviewer',
 ['requests','inspect','fix_file','issue','revise','revision_history'],
 [('rights',1),('printable',2),('specs',3)],
 [('inspect','rights','include','','Kiểm khai báo quyền sử dụng trong thẩm định; không khẳng định kiểm pháp lý tuyệt đối.'),
  ('inspect','printable','include','','Đánh giá khả năng in bắt buộc, gồm dữ liệu hình học và điều kiện chế tác.'),
  ('issue','specs','include','','Phát hành phải chốt phiên bản thông số, lượng và giá; giá STL chưa đủ.')])
 actor_page('d-uc04','UC04. Phân rã Thợ vận hành','operator',
 ['jobs','prepare','start_print','postprocess','qc','consumption','reprint_request'],
 [('equipment',1),('qc_record',4)],
 [('prepare','equipment','include','','Chuẩn bị công việc bắt buộc kiểm máy/profile/vật tư tương ứng.'),
  ('qc','qc_record','include','','Mỗi lần QC phải ghi số lượng đạt/lỗi, giữ lịch sử lượt in.'),
  ('reprint_request','qc','extend','có lượng chưa đạt','QC đạt vẫn hoàn tất độc lập; chỉ đề nghị in lại phần thiếu, không tự duyệt.')])
 actor_page('d-uc06','UC06. Phân rã Quản trị viên','admin',
 ['products','publish','resources','plan_review','apply','confirm_money','order_work','quality_review'],
 [('publication_check',1),('slicer',3),('snapshot',4),('check_payment',5)],
 [('publish','publication_check','include','','Xuất bản phải kiểm nội dung, quyền sử dụng và điều kiện bán.'),
  ('plan_review','slicer','include','','Bằng chứng slicer là điều kiện bắt buộc cho kế hoạch hợp lệ.'),
  ('apply','snapshot','include','','Nguồn thay đổi làm plan stale; không phát hành job theo snapshot cũ.'),
  ('confirm_money','check_payment','include','','ADMIN có quyền đối soát, không bỏ qua kiểm tra khoản chờ.')])
 details('uc-detail-checkout','UC07. Chi tiết đặt hàng sản phẩm',['guest','customer'],
 [('guest','checkout'),('customer','checkout')],
 {'checkout':(0,1),'shipping':(1,0),'total':(1,1),'qr':(1,2)},
 [('checkout','shipping','include','','Mỗi đơn mới cần snapshot người nhận/địa chỉ; có thể chọn thông tin đã lưu.'),
  ('checkout','total','include','','Tổng từ nguồn giá có thẩm quyền, không lấy giá browser.'),
  ('checkout','qr','include','','Checkout mới VietQR: sau tạo đơn thành công có hướng dẫn thanh toán; chuyển tiền ngoài website.')])
 details('uc-detail-quote','UC08. Chi tiết yêu cầu in và báo giá',['customer','reviewer'],
 [('customer','request'),('customer','view_quote'),('customer','accept'),('reviewer','inspect'),('reviewer','issue')],
 {'request':(0,0),'intake':(1,0),'view_quote':(0,1),'inspect':(1,1),'accept':(0,2),'issue':(1,2),'convert':(0,3)},
 [('request','intake','include','','Lưu tệp/thông số phiên bản trước khi nhận yêu cầu hoàn chỉnh.'),
  ('accept','convert','include','','Một acceptance tạo tối đa một đơn đủ lượng đã duyệt; retry trả đơn cũ.')])
 details('uc-detail-reconcile','UC09. Chi tiết đối soát chuyển khoản',['staff','admin'],
 [('staff','confirm_money'),('staff','reject_money'),('admin','confirm_money'),('admin','reject_money')],
 {'confirm_money':(0,0),'reject_money':(0,2),'check_payment':(1,1)},
 [('confirm_money','check_payment','include','','Bắt buộc kiểm khoản chờ; kiểm ngân hàng thủ công là tiền điều kiện ngoài hệ thống.'),
  ('reject_money','check_payment','include','','Khoản đã xác nhận hoặc đơn đã hủy không được ghi đè bằng từ chối.')])
 details('uc-detail-plan','UC10. Chi tiết rà soát và duyệt kế hoạch',['admin'],
 [('admin','plan_review'),('admin','apply'),('admin','plan_reject')],
 {'plan_review':(0,0),'compatibility':(1,0),'slicer':(1,1),'apply':(0,2),'snapshot':(1,2),'plan_reject':(0,3)},
 [('plan_review','compatibility','include','','Kiểm điều kiện nhóm vật lý và nguồn nhu cầu catalogue, không gồm custom STL.'),
  ('plan_review','slicer','include','','Kiểm profile/layout/duration và bằng chứng slicer.'),
  ('apply','snapshot','include','','Revalidate trước khi ghi job/allocation; stale thì không ghi hiệu lực.')])
 details('uc-detail-account','UC11. Chi tiết tài khoản và phiên',['guest','customer'],
 [('guest','register'),('guest','login'),('guest','reset'),('guest','verify_email'),('customer','profile'),('customer','logout')],
 {'register':(0,0),'login':(0,1),'reset':(0,2),'reset_link':(0,3),'verify_email':(1,0),'profile':(1,1),'logout':(1,2)},
 [('reset','reset_link','include','','Luồng đặt lại mật khẩu phải cấp/nhận liên kết một lần; token hợp lệ là điều kiện cho bước đặt mật khẩu mới.')])
 details('uc-detail-qc','UC12. Chi tiết vận hành in và kiểm định',['operator','admin'],
 [('operator','prepare'),('operator','qc'),('operator','reprint_request'),('admin','quality_review')],
 {'prepare':(0,0),'equipment':(1,0),'qc':(0,1),'qc_record':(1,1),'reprint_request':(0,2),'quality_review':(1,2)},
 [('prepare','equipment','include','','Kiểm dữ liệu/máy/vật tư đúng công việc trước ghi nhận vận hành.'),
  ('qc','qc_record','include','','Ghi đạt/lỗi theo allocation/lượt chạy, không ghi đè lịch sử.'),
  ('reprint_request','qc','extend','có lượng chưa đạt','Chỉ đề nghị lượng thiếu; người có quyền rà soát, không tự động phát hành lệnh in.')])


def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--output',type=Path,default=ROOT/'docs/ooad/exports/MinhLab_UseCase_PhanRaTacNhan.drawio')
 parser.add_argument('--combined-output',type=Path,help='Optional new 22-page copy including the prior non-Use-Case views.')
 args=parser.parse_args()
 if args.combined_output and args.combined_output.exists():parser.error('Combined output exists; choose a new filename.')
 if args.output.exists():parser.error('Output exists; use a new filename to protect manual edits.')
 build()
 b.DOC[:]=sorted(list(b.DOC),key=lambda p:p.get('name'))
 PAGES.sort(key=lambda p:p['name'])
 for p in b.DOC:
  r=p.find('mxGraphModel/root');cells=list(r)
  r[:]=cells[:2]+[c for c in cells[2:] if c.get('edge')=='1']+[c for c in cells[2:] if c.get('edge')!='1']
  ids=[c.get('id') for c in r];assert len(ids)==len(set(ids)),p.get('name')
  for c in r:
   for k in ['source','target','parent']:
    if c.get(k):assert c.get(k) in ids,(p.get('name'),c.get('id'),k)
 args.output.parent.mkdir(parents=True,exist_ok=True)
 ET.indent(b.DOC,space='  ');ET.ElementTree(b.DOC).write(args.output,encoding='utf-8',xml_declaration=True)
 args.output.with_suffix('.manifest.json').write_text(json.dumps({
  'artifact':args.output.name,'sha256':hashlib.sha256(args.output.read_bytes()).hexdigest(),
  'actors':ACTORS,'pages':PAGES,'goals':G,'relationships':REL,
  'style_reference':'/Users/nguyenphucphu/Downloads/giuaki_chan_chim.drawio',
  'scope':'TARGET_DESIGN_NOT_IMPLEMENTATION_CLAIM',
 },ensure_ascii=False,indent=2)+'\n')
 if args.combined_output:
  combined=ET.Element('mxfile',host='app.diagrams.net',type='device')
  for pg in b.DOC:combined.append(pg)
  previous=ET.parse(ROOT/'docs/ooad/exports/MinhLab_OOAD_ThietKe.drawio').getroot()
  for pg in list(previous)[2:]:combined.append(pg)
  assert len(combined)==22 and len({pg.get('id') for pg in combined})==22
  ET.indent(combined,space='  ');args.combined_output.parent.mkdir(parents=True,exist_ok=True)
  ET.ElementTree(combined).write(args.combined_output,encoding='utf-8',xml_declaration=True)
 print(f'{len(b.DOC)} native use-case pages; {len(REL)} include/extend relationships.')


if __name__=='__main__':main()
