#!/usr/bin/env python3
"""Build native OOAD report diagrams from the user's selected drawing style.

The original is immutable. Original page IDs stay stable in the derived set.
All business extensions are design, never evidence of deployed functionality.
"""
from pathlib import Path
import argparse
import copy
import hashlib
import html
import json
import math
import re
import xml.etree.ElementTree as ET
from PIL import ImageFont

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = Path('/Users/nguyenphucphu/Downloads/MinhLab_Elaboration_UseCase_TheoMau (2) (1).drawio')
DEFAULT_OUTPUT = ROOT / 'docs/ooad/exports/minhlab-ooad-day-du-theo-mau-2026-11-07.drawio'
INK = '#222222'
BASE = f'html=0;whiteSpace=wrap;fontFamily=Arial;fontSize=24;fontColor=#111111;strokeColor={INK};strokeWidth=1.6;fillColor=#FFFFFF;shadow=0;'
ACTORS = {'guest':'Khách vãng lai','customer':'Khách hàng','staff':'Nhân viên',
          'reviewer':'Nhân viên duyệt tệp','operator':'Thợ vận hành','admin':'Quản trị viên'}


def wrap(value, width=30):
    result=[]
    for paragraph in value.split('\n'):
        line=''
        for word in paragraph.split():
            if line and len(line)+len(word)+1 > width:
                result.append(line); line=word
            else:
                line=(line+' '+word).strip()
        result.append(line)
    return '\n'.join(result)


class Page:
    def __init__(self, book, key, name, typ, width=2440, height=1700, source=None, ucs=()):
        self.book=book; self.key=key; self.name=name; self.typ=typ
        self.width=width; self.height=height; self.serial=0; self.boxes={}; self.relations=[]
        self.element=ET.Element('diagram',id=key,name=name)
        self.model=ET.SubElement(self.element,'mxGraphModel',grid='0',gridSize='10',guides='1',
            tooltips='1',connect='1',arrows='1',fold='1',page='1',pageScale='1',
            pageWidth=str(width),pageHeight=str(height),math='0',shadow='0',background='#FFFFFF')
        self.root=ET.SubElement(self.model,'root')
        ET.SubElement(self.root,'mxCell',id='0'); ET.SubElement(self.root,'mxCell',id='1',parent='0')
        title_id=source.findall('.//mxCell')[2].get('id') if source is not None else 'title'
        self.node(title_id,name.upper(),64,35,width-128,76,'text;strokeColor=none;fillColor=none;align=left;fontSize=32;fontStyle=1;',is_body=False)
        self.record={'id':key,'name':name,'type':typ,'source_page':source.get('name') if source is not None else None,
                     'use_cases':list(ucs),'implementation':'DESIGN_MODEL','relations':self.relations}
        book.pages.append(self)

    def uid(self):
        self.serial+=1; return f'{self.key}-n{self.serial:03}'

    def node(self,key,label,x,y,w,h,style='',is_body=True):
        c=ET.SubElement(self.root,'mxCell',id=key,value=label,vertex='1',parent='1',
            style=BASE+'align=center;verticalAlign=middle;spacing=10;'+style)
        ET.SubElement(c,'mxGeometry',x=str(x),y=str(y),width=str(w),height=str(h),**{'as':'geometry'})
        if is_body:self.boxes[key]=(float(x),float(y),float(w),float(h))
        return c

    def text(self,key,label,x,y,w,h,size=22,align='left',bold=False):
        return self.node(key,label,x,y,w,h,f'text;fillColor=none;strokeColor=none;fontSize={size};align={align};spacing=0;fontStyle={1 if bold else 0};',False)

    def edge(self,a,b,label='',kind='assoc',points=None,ports=None,key=None):
        markers={'assoc':'startArrow=none;endArrow=none;',
                 'include':'dashed=1;endArrow=open;endFill=0;startArrow=none;',
                 'extend':'dashed=1;endArrow=open;endFill=0;startArrow=none;',
                 'dependency':'dashed=1;endArrow=open;endFill=0;startArrow=none;',
                 'composition':'startArrow=diamond;startFill=1;endArrow=none;',
                 'flow':'endArrow=block;endFill=1;startArrow=none;',
                 'message':'endArrow=block;endFill=1;startArrow=none;',
                 'return':'dashed=1;endArrow=open;endFill=0;startArrow=none;'}
        key=key or self.uid()
        if ports is None:
            ax,ay,aw,ah=self.boxes[a]; bx,by,bw,bh=self.boxes[b]
            if abs((ax+aw/2)-(bx+bw/2)) < 80:
                ports='exitX=0.5;exitY=1;entryX=0.5;entryY=0;' if by>ay else 'exitX=0.5;exitY=0;entryX=0.5;entryY=1;'
            else:
                ports='exitX=1;exitY=0.5;entryX=0;entryY=0.5;' if bx>ax else 'exitX=0;exitY=0.5;entryX=1;entryY=0.5;'
        c=ET.SubElement(self.root,'mxCell',id=key,value=label,edge='1',parent='1',source=a,target=b,
            style=BASE+'edgeStyle=none;rounded=0;curved=0;whiteSpace=nowrap;labelWidth=480;fontSize=21;labelBackgroundColor=#FFFFFF;fillColor=none;startSize=20;endSize=20;'+markers.get(kind,kind)+ports)
        g=ET.SubElement(c,'mxGeometry',relative='1',**{'as':'geometry'})
        if points:
            array=ET.SubElement(g,'Array',**{'as':'points'})
            for x,y in points:ET.SubElement(array,'mxPoint',x=str(x),y=str(y))
        self.relations.append({'id':key,'source':a,'target':b,'kind':kind,'label':label})
        return key

    def mult(self,edge_id,left,right):
        for suffix,value,x in [('a',left,-0.78),('b',right,0.78)]:
            c=ET.SubElement(self.root,'mxCell',id=edge_id+'-'+suffix,value=value,vertex='1',connectable='0',parent=edge_id,
                style='edgeLabel;html=0;fontFamily=Arial;fontSize=22;align=center;verticalAlign=middle;labelBackgroundColor=#FFFFFF;')
            g=ET.SubElement(c,'mxGeometry',x=str(x),y='-20',relative='1',**{'as':'geometry'})
            ET.SubElement(g,'mxPoint',x='0',y='0',**{'as':'offset'})

    def line(self,key,x1,y1,x2,y2,dashed=False):
        c=ET.SubElement(self.root,'mxCell',id=key,edge='1',parent='1',value='',
            style=f'edgeStyle=none;html=0;strokeColor={INK};strokeWidth=1.4;startArrow=none;endArrow=none;'+('dashed=1;' if dashed else ''))
        g=ET.SubElement(c,'mxGeometry',relative='1',**{'as':'geometry'})
        ET.SubElement(g,'mxPoint',x=str(x1),y=str(y1),**{'as':'sourcePoint'})
        ET.SubElement(g,'mxPoint',x=str(x2),y=str(y2),**{'as':'targetPoint'})

    def final(self,key,x,y):
        self.node(key,'',x,y,42,42,'ellipse;fillColor=#FFFFFF;strokeWidth=2.4;')
        self.node(key+'-dot','',x+9,y+9,24,24,'ellipse;fillColor=#222222;',False)


class Book:
    def __init__(self,source):
        self.source=source; self.original=ET.parse(source).getroot(); self.pages=[]
        self.doc=ET.Element('mxfile',host='app.diagrams.net',agent='MinhLab native OOAD report set',type='device')

    def page(self,source_index,key,name,typ,**kwargs):
        original=self.original.findall('diagram')[source_index-1] if source_index else None
        return Page(self,original.get('id') if original is not None else key,name,typ,source=original,**kwargs)


def uc(book,index,key,name,actors,goals,aux=(),links=(),ucs=()):
    """Actors communicate with independent goals; auxiliary behavior has semantics."""
    rows=max(len(goals),max((row+1 for _,_,row in aux),default=0))
    h=max(1280,340+rows*185)
    p=book.page(index,key,name,'UseCase',width=2700 if len(actors)>1 else 2440,height=h,ucs=ucs)
    p.node('system','MinhLab 3D',360,150,1920,h-240,
           'swimlane;startSize=42;horizontal=1;collapsible=0;container=0;align=left;spacingLeft=18;fontSize=22;fontStyle=1;')
    # Place two actors outside opposite sides; both attach to the same goal column.
    for i,actor in enumerate(actors):
        x=70 if i==0 else 2420
        y=h/2-140 if len(actors)==1 else 330+i*max(300,(h-850)/2)
        p.node(actor,ACTORS.get(actor,actor),x,y,210,180,
               'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;spacingTop=12;fontSize=24;')
    gx=560 if aux else 820; gw=720 if aux else 900
    for n,(gid,label,who) in enumerate(goals):
        p.node(gid,wrap(label,34),gx,260+n*185,gw,105,'ellipse;fontSize=25;spacing=14;')
        for actor in who:
            # Opposite-side actors with auxiliaries need a perimeter corridor.
            pts=None;ports=None
            if actor in actors and actors.index(actor)==1 and aux:
                sy=p.boxes[actor][1]+90;ty=312.5+n*185
                pts=[(2240,sy),(2240,h-150),(1410,h-150),(1410,ty)]
                ports='exitX=0;exitY=0.5;entryX=1;entryY=0.5;'
            p.edge(actor,gid,points=pts,ports=ports)
    for gid,label,row in aux:p.node(gid,wrap(label,28),1600,260+row*185,600,105,'ellipse;fontSize=24;')
    for a,b,kind,condition in links:
        p.edge(a,b,'«'+kind+'»',kind)
        p.relations[-1]['condition_or_reason']=condition
    return p


def overview(book):
    p=book.page(1,'','UC00 - Use Case tổng quan MinhLab 3D','UseCase',width=2650,height=1880)
    p.node('system','MinhLab 3D',350,145,1930,1590,'swimlane;startSize=42;container=0;collapsible=0;align=left;spacingLeft=18;fontSize=22;fontStyle=1;')
    groups=[('guest',70,300,530,260,[('browse','Catalogue và phòng lab 3D'),('estimate','Ước tính giá in STL')]),
            ('customer',70,820,530,760,[('checkout','Đặt hàng catalogue'),('request','Gửi yêu cầu in và nhận báo giá')]),
            ('staff',70,1350,530,1260,[('payment','Đối soát thanh toán'),('orders','Điều phối đơn hàng')]),
            ('reviewer',2390,300,1450,260,[('inspect','Thẩm định yêu cầu in'),('quote','Phát hành báo giá')]),
            ('operator',2390,820,1450,760,[('operate','Vận hành công việc in'),('qc','Kiểm định chất lượng')]),
            ('admin',2390,1350,1450,1260,[('products','Quản lý catalogue'),('plan','Phê duyệt kế hoạch in')])]
    for who,ax,ay,gx,gy,items in groups:
        p.node(who,ACTORS[who],ax,ay,200,180,'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;fontSize=24;')
        for j,(gid,label) in enumerate(items):
            p.node(gid,wrap(label,32),gx,gy+j*200,660,105,'ellipse;')
            p.edge(who,gid)
    p.record['use_cases']=['UC-01','UC-06','UC-08','UC-10','UC-11','UC-12','UC-13','UC-15']


def class_page(book,index,key,name,classes,relations,ucs=(),erd=False):
    # Six detailed classes per view at most; split by responsibility otherwise.
    cols=2
    rows=math.ceil(len(classes)/cols); w=900; pitch=1120; rowpitch=1000
    width=140+cols*pitch; height=230+rows*rowpitch
    p=book.page(index,key,name,'ERD' if erd else 'Class',width=width,height=height,ucs=ucs)
    for n,(cid,label,attrs,ops) in enumerate(classes):
        x=90+(n%cols)*pitch; y=190+(n//cols)*rowpitch
        font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',52)
        def line_count(lines):
            count=0
            for line in lines:
                occupied=0;count+=1
                for word in line.split():
                    width=font.getlength(word+' ')
                    if occupied and occupied+width>(w-40)*1.5-45:count+=1;occupied=0
                    occupied+=width
            return count
        ah=max(110,line_count(attrs)*48+35);oh=max(85,line_count(ops)*48+35) if not erd else 0
        h=80+ah+oh
        p.node(cid,label,x,y,w,h,'swimlane;startSize=80;collapsible=0;container=0;align=center;fontStyle=1;')
        p.text(cid+'-attrs','\n'.join(attrs),x+20,y+90,w-40,ah-15,22)
        if not erd:
            p.line(cid+'-sep',x,y+80+ah,x+w,y+80+ah)
            p.text(cid+'-ops','\n'.join(ops),x+20,y+92+ah,w-40,oh-20,22)
    # Separate ports prevent a composition diamond from appearing to own an
    # unrelated association that happens to share the same vertical segment.
    sides=[]; incidents={}
    for n,(a,b,left,right,kind) in enumerate(relations):
        ax,ay,aw,ah=p.boxes[a];bx,by,bw,bh=p.boxes[b]
        if abs(ay-by)>rowpitch+10 and ax==bx:s1=s2='left' if ax<500 else 'right'
        elif ay==by and abs(ax-bx)>pitch+10:s1=s2='bottom'
        elif ay==by:s1,s2=('right','left') if bx>ax else ('left','right')
        else:s1,s2=('bottom','top') if by>ay else ('top','bottom')
        sides.append((s1,s2))
        for node,side,other in [(a,s1,b),(b,s2,a)]:
            ox,oy,ow,oh=p.boxes[other]
            incidents.setdefault((node,side),[]).append((n,ox+ow/2 if side in ['top','bottom'] else oy+oh/2))
    fractions={}
    for endpoint,entries in incidents.items():
        entries.sort(key=lambda item:item[1])
        for rank,(n,_) in enumerate(entries):fractions[(n,)+endpoint]=(rank+1)/(len(entries)+1)
    def port(key,side,fraction):
        x,y,w,h=p.boxes[key]
        return {'top':(fraction,0,x+w*fraction,y),'bottom':(fraction,1,x+w*fraction,y+h),
                'left':(0,fraction,x,y+h*fraction),'right':(1,fraction,x+w,y+h*fraction)}[side]
    for n,(a,b,left,right,kind) in enumerate(relations):
        ax,ay,aw,ah=p.boxes[a];bx,by,bw,bh=p.boxes[b]
        s1,s2=sides[n];fx,fy,sx,sy=port(a,s1,fractions[(n,a,s1)]);tx,ty,ex,ey=port(b,s2,fractions[(n,b,s2)])
        ports=f'exitX={fx};exitY={fy};entryX={tx};entryY={ty};exitPerimeter=0;entryPerimeter=0;'
        points=None
        if abs(ay-by)>rowpitch+10 and ax==bx:
            xx=30+n*4 if s1=='left' else width-30-n*4
            points=[(xx,sy),(xx,ey)]
        elif abs(ay-by)>rowpitch+10:
            yy1=ay+ah+80 if by>ay else ay-80
            yy2=by-80 if by>ay else by+bh+80
            xx=90+w+(pitch-w)/2
            points=[(sx,yy1),(xx,yy1),(xx,yy2),(ex,yy2)]
        elif ay==by and s1=='bottom':
            yy=max(y+h for x,y,w,h in p.boxes.values() if y==ay)+80+n*18
            points=[(sx,yy),(ex,yy)]
        elif ay!=by:
            yy=min(ay,by)+820+n*19
            points=[(sx,yy),(ex,yy)] if abs(sx-ex)>1 else None
        if erd:
            starts={'1':'ERmandOne','0..1':'ERzeroToOne','0..*':'ERzeroToMany','1..*':'ERoneToMany'}
            marker=f'startArrow={starts[left]};endArrow={starts[right]};startFill=0;endFill=0;startSize=24;endSize=24;'
            p.edge(a,b,kind=marker,points=points,ports=ports)
        else:
            e=p.edge(a,b,kind=kind,points=points,ports=ports)
            if left and right:p.mult(e,left,right)
    return p


def activity(book,index,key,name,steps,branches=(),ucs=()):
    """Linear success spine; each guarded rejection has a separate terminating path."""
    h=420+len(steps)*230
    p=book.page(index,key,name,'Activity',width=2520,height=h,ucs=ucs)
    p.node('__initial','',1220,170,42,42,'ellipse;fillColor=#222222;')
    previous='__initial'
    for i,(sid,label,decision) in enumerate(steps):
        y=300+i*230
        p.node(sid,wrap(label,38 if not decision else 22),900 if not decision else 1080,y,680 if not decision else 320,110 if not decision else 160,
               'rounded=0;fontSize=24;' if not decision else 'rhombus;fontSize=22;')
        p.edge(previous,sid,'[có]' if i and steps[i-1][2] else '',kind='flow')
        previous=sid
    p.final('end',1220,h-90);p.edge(previous,'end','[có]' if steps[-1][2] else '',kind='flow')
    for n,(sid,label,guard) in enumerate(branches):
        _,sy,_,sh=p.boxes[sid];x=80 if n%2==0 else 1740
        bid='branch'+str(n);p.node(bid,wrap(label,30),x,sy+10,650,105,'rounded=0;fontSize=23;')
        p.edge(sid,bid,guard,'flow');p.final(bid+'-end',x+300,sy+160);p.edge(bid,bid+'-end',kind='flow')
    return p


def sequence(book,index,key,name,participants,events,frames=(),ucs=()):
    gap=650;width=200+gap*len(participants);height=570+len(events)*160
    p=book.page(index,key,name,'Sequence',width=width,height=height,ucs=ucs)
    centers={}
    for i,(pid,label) in enumerate(participants):
        x=100+i*gap;centers[pid]=x+190
        p.node(pid,wrap(label,25),x,180,380,90,'rounded=0;fontSize=24;')
        p.line(pid+'-life',x+190,270,x+190,height-70,True)
    for n,(a,b,label,returned) in enumerate(events):
        y=400+n*160;eid=p.uid();x1=centers[a];x2=centers[b]
        style=BASE+'edgeStyle=none;rounded=0;whiteSpace=nowrap;labelWidth=580;fillColor=none;fontSize=22;labelBackgroundColor=#FFFFFF;endArrow=open;endFill=0;'+('dashed=1;' if returned else 'endArrow=block;endFill=1;')
        e=ET.SubElement(p.root,'mxCell',id=eid,value=wrap(label,48),edge='1',parent='1',style=style)
        g=ET.SubElement(e,'mxGeometry',relative='1',**{'as':'geometry'})
        ET.SubElement(g,'mxPoint',x=str(x1),y=str(y),**{'as':'sourcePoint'})
        ET.SubElement(g,'mxPoint',x=str(x2),y=str(y if a!=b else y+55),**{'as':'targetPoint'})
        if a==b:
            pts=ET.SubElement(g,'Array',**{'as':'points'})
            ET.SubElement(pts,'mxPoint',x=str(x1+140),y=str(y));ET.SubElement(pts,'mxPoint',x=str(x1+140),y=str(y+55))
        p.relations.append({'id':eid,'source':a,'target':b,'kind':'return' if returned else 'message','label':label,'y':y})
    for fi,(start,end,operator,conditions) in enumerate(frames):
        top=300+start*160;bottom=450+end*160
        frame=p.node(f'frame{fi}',operator,60,top,width-120,bottom-top,'rounded=0;fillColor=none;align=left;verticalAlign=top;fontSize=24;fontStyle=1;spacing=12;',False)
        # Frame borders should stay behind messages and labels.
        p.root.remove(frame);p.root.insert(3,frame)
        for j,(row,condition) in enumerate(conditions):
            yy=top+30 if j==0 else 300+row*160
            if j:p.line(f'frame{fi}-sep{j}',60,yy,width-60,yy,True)
            p.text(f'frame{fi}-guard{j}',condition,190,yy+8,width-400,42,22)
    return p


def state(book,key,name,states,transitions,ucs=()):
    cols=3;rows=math.ceil(len(states)/cols);width=2920;rowpitch=750;height=420+rows*rowpitch
    p=book.page(None,key,name,'State',width=width,height=height,ucs=ucs)
    p.node('start','',55,290,38,38,'ellipse;fillColor=#222222;')
    for n,(sid,label) in enumerate(states):
        p.node(sid,wrap(label,26),240+(n%cols)*900,240+(n//cols)*rowpitch,600,125,'rounded=1;arcSize=15;fontSize=25;')
    p.edge('start',states[0][0],kind='flow')
    gutter_lanes={};earlier=set()
    for i,(a,b,label) in enumerate(transitions):
        ax,ay,aw,ah=p.boxes[a];bx,by,bw,bh=p.boxes[b];points=None;ports=None
        upper=min(ay,by)
        def gutter():
            lane=gutter_lanes.get(upper,0);gutter_lanes[upper]=lane+1
            return upper+230+lane*100
        if ay==by and (b,a) in earlier:
            yy=ay-65
            points=[(ax+aw/2,yy),(bx+bw/2,yy)]
            ports='exitX=0.5;exitY=0;entryX=0.5;entryY=0;'
        elif ay==by and abs(ax-bx)>910:
            yy=gutter()
            points=[(ax+aw/2,yy),(bx+bw/2,yy)]
            ports='exitX=0.5;exitY=1;entryX=0.5;entryY=1;'
        elif ax==bx and abs(ay-by)>rowpitch+10:
            xx=ax-100-i*15
            points=[(xx,ay+ah*.85),(xx,by+bh/2)]
            ports='exitX=0;exitY=0.85;entryX=0;entryY=0.5;'
        elif ay!=by and ax!=bx:
            yy=gutter()
            points=[(ax+aw/2,yy),(bx+bw/2,yy)]
            ports='exitX=0.5;exitY=1;entryX=0.5;entryY=0;' if ay<by else 'exitX=0.5;exitY=0;entryX=0.5;entryY=1;'
        if a==b:
            points=[(ax+aw+100,ay+ah/2),(ax+aw+100,ay-65),(ax+aw/2,ay-65)]
            ports='exitX=1;exitY=0.5;entryX=0.5;entryY=0;'
        edge_id=p.edge(a,b,wrap(label,31),'flow',points,ports)
        if ax==bx and abs(ay-by)>rowpitch+10:
            geometry=p.root.find(f'mxCell[@id="{edge_id}"]/mxGeometry')
            geometry.set('x','-0.55')
            ET.SubElement(geometry,'mxPoint',x='200',y='0',**{'as':'offset'})
        earlier.add((a,b))
    return p


def architecture(book,index,key,name,items,relations,ucs=(),deployment=False):
    p=book.page(index,key,name,'Deployment' if deployment else 'Component',width=2850,height=1880,ucs=ucs)
    for cid,label,x,y,kind in items:
        shape={'component':'shape=component;','database':'shape=cylinder3;size=18;','node':'shape=cube;size=24;','box':'rounded=0;'}[kind]
        p.node(cid,wrap(label,28),x,y,580,200,shape+'fontSize=25;')
    for a,b,label in relations:
        ax,ay,aw,ah=p.boxes[a];bx,by,bw,bh=p.boxes[b]
        points=None;ports=None
        if ay==by and abs(ax-bx)>1100:
            yy=ay+ah+120;points=[(ax+aw/2,yy),(bx+bw/2,yy)]
            ports='exitX=0.5;exitY=1;entryX=0.5;entryY=1;'
        p.edge(a,b,label,'dependency',points,ports)
    return p


def build_usecases(book):
    overview(book)
    uc(book,2,'','UC01 - Use Case — Khách vãng lai',['guest'],[
        ('browse','Tra cứu sản phẩm',['guest']),('cart','Quản lý giỏ hàng',['guest']),
        ('checkout','Đặt hàng catalogue',['guest']),('track','Tra cứu đơn bằng liên kết',['guest']),
        ('estimate','Ước tính giá in STL',['guest']),('advice','Liên hệ tư vấn in',['guest']),
        ('register','Đăng ký tài khoản',['guest']),('login','Đăng nhập tài khoản đã có',['guest']),
        ('tour','Khám phá phòng lab 3D',['guest'])],
        [('detail','Xem chi tiết sản phẩm',0),('geometry','Phân tích hình học STL',4)],
        [('detail','browse','extend','Khi chọn xem một sản phẩm trong danh sách; còn có trigger mở trực tiếp.'),
         ('estimate','geometry','include','Ước tính mới phải phân tích mô hình được chọn.')],['UC-01','UC-02','UC-03.1','UC-04.1','UC-06','UC-09.1','UC-11'])
    uc(book,3,'','UC02 - Use Case — Khách hàng',['customer'],[
        ('cart','Quản lý giỏ hàng',['customer']),('checkout','Đặt hàng catalogue',['customer']),
        ('history','Xem lịch sử đơn hàng',['customer']),('request','Gửi yêu cầu in theo tệp',['customer']),
        ('view','Xem báo giá chính thức',['customer']),('accept','Chấp thuận báo giá và đặt in',['customer']),
        ('decline','Từ chối báo giá',['customer']),('profile','Cập nhật hồ sơ cá nhân',['customer'])],
        [('intake','Ghi nhận tệp và thông số',3),('convert','Chuyển báo giá thành đơn',5)],
        [('request','intake','include','Lưu tệp/spec revision để thẩm định.'),
         ('accept','convert','include','Một acceptance một đơn đủ lượng; retry trả kết quả cũ.')],
        ['UC-02','UC-06','UC-09.2','UC-12.1','UC-12.7','UC-12.8','UC-12.9','DESIGN-PROFILE'])
    uc(book,4,'','UC03 - Use Case — Nhân viên',['staff'],[
        ('orders','Tra cứu đơn hàng cần xử lý',['staff']),('verify','Xác nhận đã nhận tiền',['staff']),
        ('reject','Từ chối khoản chờ đối soát',['staff']),('coordinate','Điều phối tiến độ đơn hàng',['staff']),
        ('cancel','Hủy đơn chưa thu tiền',['staff']),('ship','Ghi nhận bàn giao vận chuyển',['staff']),
        ('complete','Xác nhận giao hàng hoàn tất',['staff']),('refund','Tiếp nhận yêu cầu hoàn tiền',['staff'])],
        ucs=['UC-08','UC-10','UC-14'])
    uc(book,5,'','UC04 - Use Case — Thợ vận hành',['operator'],[
        ('jobs','Xem công việc in được giao',['operator']),('prepare','Chuẩn bị công việc in',['operator']),
        ('start','Ghi nhận bắt đầu in',['operator']),('finish','Ghi nhận hậu xử lý',['operator']),
        ('qc','Kiểm định chất lượng',['operator']),('material','Ghi nhận tiêu hao vật tư',['operator']),
        ('reprint','Đề nghị in lại phần thiếu',['operator'])],ucs=['UC-13.1','UC-13.2','UC-13.3','UC-13.4','UC-13.5','UC-13.6','UC-13.7'])
    uc(book,6,'','UC05 - Use Case — Nhân viên duyệt tệp',['reviewer'],[
        ('queue','Xem yêu cầu chờ thẩm định',['reviewer']),('inspect','Thẩm định yêu cầu in',['reviewer']),
        ('fix','Yêu cầu sửa hoặc thay tệp',['reviewer']),('issue','Phát hành báo giá chính thức',['reviewer']),
        ('revision','Lập phiên bản báo giá mới',['reviewer']),('history','Xem lịch sử tệp và thông số',['reviewer'])],
        [('rights','Kiểm tra khai báo quyền sử dụng',1),('printable','Đánh giá khả năng in',2),('price','Chốt thông số và đơn giá',3)],
        [('inspect','rights','include','Kiểm khai báo quyền không là bảo đảm pháp lý tuyệt đối.'),
         ('inspect','printable','include','Thẩm định phải đánh giá khả năng chế tạo.'),
         ('issue','price','include','Báo giá phát hành phải có thông số và giá chốt.')],['UC-12.2','UC-12.3','UC-12.4','UC-12.5','UC-12.6','UC-12.10'])
    uc(book,7,'','UC06 - Use Case — Quản trị viên',['admin'],[
        ('products','Quản lý sản phẩm và biến thể',['admin']),('accounts','Quản lý tài khoản nhân sự',['admin']),
        ('resources','Quản lý vật tư và máy in',['admin']),('review','Rà soát kế hoạch sản xuất',['admin']),
        ('apply','Phê duyệt và áp dụng kế hoạch',['admin']),('reject','Từ chối kế hoạch sản xuất',['admin']),
        ('money','Đối soát thanh toán',['admin']),('quality','Rà soát kết quả kiểm định',['admin'])],
        ucs=['UC-08','UC-13.8','UC-13.9','UC-13.10','UC-13.11','UC-13.12','UC-15','DESIGN-STAFF-ACCOUNTS'])
    uc(book,8,'','UC07 - Use Case — Yêu cầu in STL và báo giá',['customer','reviewer'],[
        ('send','Gửi yêu cầu in theo tệp',['customer']),('view','Xem báo giá chính thức',['customer']),
        ('accept','Chấp thuận báo giá và đặt in',['customer']),('inspect','Thẩm định yêu cầu in',['reviewer']),
        ('issue','Phát hành báo giá chính thức',['reviewer'])],ucs=['UC-12'])
    uc(book,9,'','UC08 - Use Case — Dịch vụ thông báo bên ngoài',['Dịch vụ email','Telegram Bot API'],[
        ('account','Gửi thư xác minh hoặc khôi phục',['Dịch vụ email']),
        ('payment','Gửi thông báo kết quả đối soát',['Dịch vụ email']),
        ('notify','Gửi thông báo nghiệp vụ sau commit',['Telegram Bot API'])],ucs=['UC-03','UC-05','UC-08'])
    uc(book,10,'','EL02 - Use Case — Đặt hàng và chuyển khoản',['guest','customer'],[
        ('checkout','Đặt hàng catalogue',['guest','customer']),('qr','Xem hướng dẫn VietQR',['guest','customer']),
        ('track','Tra cứu đơn được phép xem',['guest','customer']),('declare','Khai báo chuyển khoản tùy chọn',['guest','customer'])],
        ucs=['UC-06','UC-07','UC-09.1'])
    uc(book,11,'','EL03 - Use Case — Ước tính STL và yêu cầu in',['guest','customer'],[
        ('estimate','Ước tính giá in STL',['guest','customer']),('advice','Bàn giao thông tin tư vấn',['guest','customer']),
        ('request','Gửi yêu cầu in theo tệp',['customer'])],ucs=['UC-11','UC-12.1'])
    uc(book,12,'','EL04 - Use Case — Lập và duyệt kế hoạch in',['admin'],[
        ('review','Rà soát đề xuất kế hoạch',['admin']),('apply','Phê duyệt và áp dụng kế hoạch',['admin']),
        ('reject','Từ chối kế hoạch sản xuất',['admin'])],
        [('snapshot','Kiểm tra lại nguồn kế hoạch',0),('slicer','Kiểm tra bằng chứng slicer',1)],
        [('apply','snapshot','include','Kiểm/khóa lại snapshot ngay khi áp dụng; stale không tạo job.'),
         ('apply','slicer','include','Chỉ áp dụng khi bằng chứng slicer/profile còn hợp lệ.')],['UC-13.9','UC-13.10','UC-13.11'])
    # Independent CRUD operations, never all included by a generic manage case.
    extras=[
        ('uc09-account','UC09 - Use Case — Tài khoản và phiên',['Người có tài khoản'],[
            ('login','Đăng nhập'),('verify','Xác minh email'),('reset','Khôi phục mật khẩu'),('logout','Đăng xuất')],['UC-03.2','UC-04','UC-05']),
        ('uc10-product','UC10 - Use Case — Thêm sửa xóa sản phẩm',['admin'],[
            ('add','Thêm sản phẩm nháp'),('edit','Sửa nội dung sản phẩm'),('delete','Xóa sản phẩm nháp chưa sử dụng'),
            ('publish','Xuất bản sản phẩm'),('unpublish','Ngừng bán sản phẩm')],['UC-15','CRUD-PRODUCT']),
        ('uc11-category','UC11 - Use Case — Quản lý danh mục',['admin'],[
            ('add','Thêm danh mục'),('edit','Sửa danh mục'),('delete','Xóa danh mục chưa sử dụng')],['CRUD-CATEGORY']),
        ('uc12-variant','UC12 - Use Case — Quản lý biến thể',['admin'],[
            ('add','Thêm biến thể sản phẩm'),('edit','Sửa màu giá và thông số'),('delete','Xóa biến thể nháp chưa sử dụng'),
            ('stop','Ngừng bán biến thể'),('enable','Mở bán lại biến thể đủ điều kiện')],['UC-15.1','CRUD-VARIANT']),
        ('uc13-staff-account','UC13 - Use Case — Quản lý tài khoản nhân sự',['admin'],[
            ('add','Thêm tài khoản nhân sự'),('edit','Sửa hồ sơ nhân sự'),('role','Cấp hoặc thu hồi vai trò cố định'),
            ('lock','Khóa tài khoản'),('unlock','Mở khóa tài khoản'),('delete','Xóa tài khoản nháp chưa sử dụng')],['DESIGN-STAFF-ACCOUNTS']),
        ('uc14-material','UC14 - Use Case — Quản lý vật tư',['admin'],[
            ('add','Thêm vật tư'),('edit','Sửa thông tin vật tư'),('disable','Ngừng sử dụng vật tư'),
            ('delete','Xóa vật tư chưa sử dụng')],['UC-13.8','CRUD-MATERIAL']),
        ('uc15-printer','UC15 - Use Case — Quản lý máy in',['admin'],[
            ('add','Thêm máy in'),('edit','Sửa cấu hình máy in'),('maintenance','Cập nhật khả dụng và bảo trì'),
            ('disable','Ngừng sử dụng máy in'),('delete','Xóa máy chưa phát sinh công việc')],['UC-13.8','CRUD-PRINTER']),
        ('uc16-stock','UC16 - Use Case — Ghi nhận và điều chỉnh kho',['admin'],[
            ('receipt','Ghi nhận nhập vật tư hoặc thành phẩm'),('issue','Ghi nhận xuất kho'),
            ('adjust','Điều chỉnh tồn có lý do'),('history','Xem lịch sử biến động kho')],['UC-13.6','DESIGN-STOCK']),
        ('uc17-bom','UC17 - Use Case — Quản lý BOM và phiên bản',['admin'],[
            ('add','Tạo phiên bản BOM nháp'),('edit','Sửa định mức linh kiện bản nháp'),
            ('delete','Xóa dòng BOM trong bản nháp'),('release','Phát hành phiên bản BOM')],['DESIGN-BOM']),
        ('uc18-qc','UC18 - Use Case — Kiểm định và in lại',['operator'],[
            ('qc','Kiểm định chất lượng'),('reprint','Đề nghị in lại phần thiếu')],['UC-13.5','UC-13.7']),
        ('uc19-refund','UC19 - Use Case — Tiếp nhận hoàn tiền',['staff'],[
            ('receive','Tiếp nhận yêu cầu hoàn tiền'),('view','Theo dõi hồ sơ yêu cầu hoàn')],['UC-14']),
        ('uc20-cart','UC20 - Use Case — Thêm sửa xóa giỏ hàng',['guest','customer'],[
            ('view','Xem giỏ hàng'),('add','Thêm biến thể vào giỏ'),('edit','Thay đổi số lượng'),('remove','Xóa dòng khỏi giỏ')],['UC-02']),
        ('uc21-quote-decision','UC21 - Use Case — Khách quyết định báo giá',['customer'],[
            ('view','Xem báo giá chính thức'),('accept','Chấp thuận báo giá và đặt in'),('reject','Từ chối báo giá')],['UC-12.7','UC-12.8','UC-12.9']),
        ('uc22-order-work','UC22 - Use Case — Điều phối và giao hàng',['staff','admin'],[
            ('view','Tra cứu đơn cần xử lý'),('move','Điều phối tiến độ đơn'),('cancel','Hủy đơn chưa thu tiền'),
            ('ship','Ghi nhận bàn giao vận chuyển'),('complete','Xác nhận giao hàng hoàn tất')],['UC-10']),
        ('uc23-profile','UC23 - Use Case — Hồ sơ khách hàng',['customer'],[
            ('view','Xem thông tin cá nhân'),('edit','Cập nhật hồ sơ cá nhân')],['DESIGN-PROFILE']),
    ]
    for key,name,actors,goals,ids in extras:
        p=uc(book,None,key,name,actors,[(i,l,actors) for i,l in goals],ucs=ids)
        if key=='uc18-qc':
            p.edge('reprint','qc','«extend»','extend')
            p.relations[-1]['condition_or_reason']='Chỉ khi QC lỗi hoặc thiếu lượng; thợ đề nghị, không tự phê duyệt.'
        if any(i.startswith(('CRUD-','DESIGN-')) for i in ids):
            p.record['new_design_scope']='CRUD requested 07/11; delete only unused drafts, otherwise stop/lock; no implementation claim.'


def C(key,name,attrs,ops=()):
    return (key,name,list(attrs),list(ops))


def build_static(book):
    class_page(book,13,'','ERD01 - ERD catalogue và biến thể',[
        C('category','DANH_MUC',['PK maDanhMuc: UUID','UQ duongDan: String','ten: String']),
        C('product','SAN_PHAM',['PK maSanPham: UUID','FK maDanhMuc: UUID','ten: String','trangThaiXuatBan: String','phienBan: Integer']),
        C('variant','BIEN_THE',['PK maBienThe: UUID','FK maSanPham: UUID','UQ sku: String','giaBan: Money','trangThaiBan: String']),
        C('image','ANH_SAN_PHAM',['PK maAnh: UUID','FK maSanPham: UUID','diaChiAnh: String','thuTu: Integer'])],
        [('category','product','1','0..*','assoc'),('product','variant','1','0..*','assoc'),('product','image','1','0..*','assoc')],['UC-01','UC-15'],True)
    class_page(book,14,'','ERD02 - ERD đơn hàng và đối soát thủ công',[
        C('user','NGUOI_DUNG',['PK maNguoiDung: UUID','UQ email: String']),
        C('order','DON_HANG',['PK maDon: UUID','FK maKhach: UUID?','UQ soDon: String','tongTien: Money','diaChiChot: Snapshot']),
        C('item','DONG_DON_HANG',['PK maDong: UUID','FK maDon: UUID','FK maBienThe: UUID?','FK maThongSo: UUID?','soLuong: Integer','donGiaChot: Money']),
        C('tracking','QUYEN_TRA_CUU',['PK maQuyen: UUID','FK maDon: UUID','tokenHash: String','hetHan: Instant']),
        C('payment','THANH_TOAN',['PK maThanhToan: UUID','FK maDon: UUID','soTien: Money','trangThaiDoiSoat: String','taiKhoanNhanChot: Snapshot']),
        C('history','LICH_SU_DON',['PK maSuKien: UUID','FK maDon: UUID','trangThaiCu: String','trangThaiMoi: String','nguoiThucHien: UUID?'])],
        [('user','order','0..1','0..*','assoc'),('order','item','1','0..*','assoc'),('order','payment','1','0..*','assoc'),
         ('order','tracking','1','0..*','assoc'),('order','history','1','0..*','assoc')],['UC-06','UC-08','UC-09','UC-10'],True)
    class_page(book,15,'','EL05 - Lớp đơn hàng giá chốt và thanh toán',[
        C('user','NguoiDung',['- ma: UUID','- email: String'],['+ xemLichSu(): DonHang[]']),
        C('order','DonHang',['- ma: UUID','- trangThai: TrangThaiDon','- tongTien: Money'],['+ tinhTong(): Money','+ chuyenTrangThai(moi: TrangThaiDon): void']),
        C('item','DongDonHang',['- soLuong: Integer','- donGiaChot: Money','- tenChot: String'],['+ thanhTien(): Money']),
        C('address','ThongTinGiaoChot',['- nguoiNhan: String','- dienThoai: String','- diaChi: String'],['+ hopLe(): Boolean']),
        C('payment','ThanhToan',['- ma: UUID','- soTien: Money','- trangThai: TrangThaiDoiSoat'],['+ xacNhan(nguoiDuyet: UUID): void','+ tuChoi(lyDo: String): void']),
        C('history','LichSuDon',['- thoiDiem: Instant','- trangThaiCu: TrangThaiDon','- trangThaiMoi: TrangThaiDon'],['+ ghiSuKien(nguoi: UUID): void'])],
        [('user','order','0..1','0..*','assoc'),('order','item','1','1..*','composition'),('order','address','1','1','composition'),
         ('order','payment','1','0..*','assoc'),('order','history','1','0..*','assoc')],['UC-06','UC-08','UC-10'])
    class_page(book,16,'','EL06 - Lớp yêu cầu in báo giá và chấp thuận',[
        C('request','YeuCauIn',['- ma: UUID','- maKhach: UUID','- trangThai: TrangThaiYeuCau'],['+ gui(): void','+ yeuCauSua(lyDo: String): void']),
        C('quote','BaoGia',['- ma: UUID','- revision: Integer','- hanChapThuan: Instant','- trangThai: TrangThaiBaoGia'],['+ phatHanh(): void','+ conHieuLuc(luc: Instant): Boolean']),
        C('line','DongBaoGia',['- soLuongDuyet: Integer','- donGiaChot: Money','- maThongSo: UUID'],['+ thanhTien(): Money']),
        C('spec','PhienBanThongSo',['- ma: UUID','- maPhienBanTep: UUID','- vatLieu: String','- kichThuoc: Vector3'],['+ hopLe(): Boolean']),
        C('approval','ChapThuanBaoGia',['- ma: UUID','- maKhach: UUID','- snapshotHash: String','- thoiDiem: Instant'],['+ khopBanChot(hash: String): Boolean']),
        C('order','DonHang',['- ma: UUID','- tongTien: Money','- trangThai: TrangThaiDon'],['+ duLuongDaDuyet(): Boolean'])],
        [('request','quote','1','0..*','assoc'),('quote','line','1','1..*','composition'),('spec','line','1','0..*','assoc'),
         ('quote','approval','1','0..1','assoc'),('approval','order','0..1','1','assoc')],['UC-12'])
    class_page(book,17,'','EL07 - Lớp kế hoạch nhu cầu và phân bổ công việc',[
        C('plan','KeHoachSanXuat',['- ma: UUID','- revision: Integer','- snapshotHash: String','- trangThai: TrangThaiKeHoach'],['+ danhDauCu(): void','+ ghiQuyetDinh(nguoi: UUID): void']),
        C('batch','MeDeXuat',['- ma: UUID','- congNghe: CongNgheIn','- bangChungSlicer: String'],['+ tuongThichToanMe(): Boolean']),
        C('candidate','PhanBoDeXuat',['- maNhuCau: UUID','- soLuong: Integer'],['+ hopLe(): Boolean']),
        C('job','CongViecIn',['- ma: UUID','- trangThai: TrangThaiCongViec','- maMay: UUID'],['+ ghiBatDau(): void','+ ghiHoanTat(): void']),
        C('allocation','PhanBoCongViec',['- maNhuCau: UUID','- soLuong: Integer','- luongDat: Integer','- luongLoi: Integer'],['+ luongConThieu(): Integer']),
        C('requirement','NhuCauLinhKien',['- maDongDon: UUID','- revisionLinhKien: UUID','- revisionThongSo: UUID','- luongCan: Integer'],['+ luongCanLapKeHoach(): Integer'])],
        [('plan','batch','1','0..*','composition'),('batch','candidate','1','0..*','composition'),
         ('requirement','candidate','1','0..*','assoc'),('job','allocation','1','0..*','assoc'),
         ('requirement','allocation','1','0..*','assoc')],['UC-13'])
    # The original EL12 is an overview projection; detailed keys live in ERD03–08.
    overview_classes=[C(k,n,['PK '+pk+': UUID']) for k,n,pk in [
        ('user','NGUOI_DUNG','maNguoiDung'),('request','YEU_CAU_IN','maYeuCau'),('quote','BAO_GIA','maBaoGia'),
        ('product','SAN_PHAM','maSanPham'),('order','DON_HANG','maDon'),('accept','CHAP_THUAN','maChapThuan'),
        ('variant','BIEN_THE','maBienThe'),('item','DONG_DON_HANG','maDong'),('payment','THANH_TOAN','maThanhToan'),
        ('plan','KE_HOACH','maKeHoach'),('job','CONG_VIEC_IN','maCongViec'),('allocation','PHAN_BO','maPhanBo')]]
    class_page(book,22,'','EL12 - ERD tổng quan các miền thiết kế',overview_classes,[
        ('user','request','1','0..*','assoc'),('request','quote','1','0..*','assoc'),('quote','accept','1','0..1','assoc'),
        ('accept','order','0..1','0..1','assoc'),('product','variant','1','0..*','assoc'),('order','item','1','0..*','assoc'),
        ('order','payment','1','0..*','assoc'),('job','allocation','1','0..*','assoc')],['UC-06','UC-12','UC-13','UC-15'],True)
    extras=[
        ('cl16-account','EL16 - Lớp tài khoản vai trò và phiên',[
            C('user','NguoiDung',['- ma: UUID','- email: String','- trangThai: TrangThaiTaiKhoan'],['+ khoa(): void','+ moKhoa(): void']),
            C('role','VaiTro',['- ma: MaVaiTro','- ten: String'],['+ choPhep(hanhDong: String): Boolean']),
            C('session','PhienDangNhap',['- tokenHash: String','- hetHan: Instant','- thuHoiLuc: Instant?'],['+ conHieuLuc(luc: Instant): Boolean','+ thuHoi(): void']),
            C('token','TokenTaiKhoan',['- tokenHash: String','- mucDich: MucDichToken','- hetHan: Instant'],['+ dungMotLan(): void'])],
            [('user','role','0..*','1..*','assoc'),('user','session','1','0..*','assoc'),('user','token','1','0..*','assoc')],['UC-03','UC-04','UC-05','DESIGN-STAFF-ACCOUNTS']),
        ('cl17-catalogue','EL17 - Lớp catalogue và vòng đời xuất bản',[
            C('category','DanhMuc',['- ma: UUID','- ten: String'],['+ doiTen(ten: String): void']),
            C('product','SanPham',['- ma: UUID','- revision: Integer','- trangThai: TrangThaiSanPham'],['+ capNhat(duLieu: NoiDung): void','+ xuatBan(): void','+ ngungBan(): void']),
            C('variant','BienThe',['- ma: UUID','- sku: String','- giaBan: Money','- trangThai: TrangThaiBan'],['+ capNhatGia(gia: Money): void','+ ngungBan(): void']),
            C('review','KetQuaRaSoat',['- nguoiDuyet: UUID','- quyenSuDungDaKiem: Boolean','- ghiChu: String'],['+ duDieuKienXuatBan(): Boolean'])],
            [('category','product','1','0..*','assoc'),('product','variant','1','1..*','assoc'),('product','review','1','0..*','assoc')],['UC-15','CRUD-PRODUCT','CRUD-CATEGORY','CRUD-VARIANT']),
        ('cl18-file','EL18 - Lớp tệp phiên bản và thẩm định',[
            C('request','YeuCauIn',['- ma: UUID','- maKhach: UUID'],['+ themPhienBanTep(): void']),
            C('file','PhienBanTep',['- ma: UUID','- hashNoiDung: String','- khoaLuuTru: String','- revision: Integer'],['+ kiemTraToanVen(): Boolean']),
            C('inspection','KetQuaThamDinh',['- ma: UUID','- nguoiDuyet: UUID','- ketLuan: String'],['+ ghiKetQua(noiDung: String): void']),
            C('spec','PhienBanThongSo',['- ma: UUID','- revision: Integer','- vatLieu: String','- tiLe: Decimal'],['+ hopLe(): Boolean'])],
            [('request','file','1','0..*','assoc'),('file','inspection','1','0..*','assoc'),('file','spec','1','0..*','assoc')],['UC-12.1','UC-12.3','UC-12.4','UC-12.10']),
        ('cl19-bom','EL19 - Lớp BOM linh kiện và nguồn tồn',[
            C('variant','BienThe',['- ma: UUID','- sku: String'],['+ chonBomDaPhatHanh(): PhienBanBOM']),
            C('bom','PhienBanBOM',['- ma: UUID','- revision: Integer','- trangThai: TrangThaiBOM'],['+ phatHanh(): void']),
            C('line','DongBOM',['- maLinhKien: UUID','- maThongSo: UUID','- dinhMuc: Integer'],['+ tinhNhuCau(soBo: Integer): Integer']),
            C('component','PhienBanLinhKien',['- ma: UUID','- hashTep: String','- revision: Integer'],['+ khopQuyCach(): Boolean']),
            C('stock','NguonTon',['- maThongSo: UUID','- luongDatQC: Integer','- luongDaGiu: Integer'],['+ luongKhaDung(): Integer']),
            C('requirement','NhuCauLinhKien',['- luongCanN: Integer','- luongTonE: Integer','- luongDatG: Integer','- luongJobA: Integer'],['+ luongConThieu(): Integer'])],
            [('variant','bom','1','0..*','assoc'),('bom','line','1','1..*','composition'),('component','line','1','0..*','assoc'),
             ('component','stock','1','0..*','assoc'),('line','requirement','1','0..*','assoc')],['UC-13','DESIGN-BOM','DESIGN-STOCK']),
        ('cl20-qc','EL20 - Lớp lần in kiểm định và tiêu hao',[
            C('job','CongViecIn',['- ma: UUID','- trangThai: TrangThaiCongViec'],['+ choPhepBatDau(): Boolean']),
            C('attempt','LanIn',['- ma: UUID','- batDau: Instant','- ketThuc: Instant?','- thongSoThucTe: Snapshot'],['+ ghiHoanTat(): void']),
            C('allocation','PhanBoCongViec',['- ma: UUID','- luongDuocGiao: Integer'],['+ luongConThieu(): Integer']),
            C('qc','KetQuaQC',['- luongDat: Integer','- luongLoi: Integer','- nguoiKiem: UUID'],['+ hopLe(): Boolean']),
            C('consumption','TieuHaoVatTu',['- maVatTu: UUID','- luongThucTe: Decimal','- donVi: String'],['+ ghiNhan(): void']),
            C('reprint','DeNghiInLai',['- luongThieu: Integer','- lyDo: String','- trangThai: TrangThaiDeNghi'],['+ guiDeNghi(): void'])],
            [('job','attempt','1','0..*','assoc'),('job','allocation','1','0..*','assoc'),('attempt','qc','1','0..*','assoc'),
             ('allocation','qc','1','0..*','assoc'),('attempt','consumption','1','0..*','assoc'),('qc','reprint','1','0..*','assoc')],['UC-13.1','UC-13.3','UC-13.4','UC-13.5','UC-13.6','UC-13.7'])]
    for key,name,classes,rels,ids in extras:class_page(book,None,key,name,classes,rels,ids)
    # Explicit service responsibility views for receivers used by sequences.
    class_page(book,None,'cl21-services','EL21 - Lớp dịch vụ tài khoản đơn hàng và thanh toán',[
        C('auth','DichVuTaiKhoan',[],['+ dangKy(email: String): NguoiDung','+ dangNhap(thongTin: DangNhap): PhienDangNhap','+ datLaiMatKhau(token: String): void']),
        C('orders','DichVuDonHang',[],['+ datCatalogue(yeuCau: DatHang): DonHang','+ traCuu(quyen: QuyenXem): DonHang','+ chuyenTrangThai(moi: TrangThaiDon): void']),
        C('payment','DichVuThanhToan',[],['+ xacNhan(ma: UUID, nguoi: UUID): ThanhToan','+ tuChoi(ma: UUID, lyDo: String): void']),
        C('repo','KhoNghiepVu',[],['+ trongGiaoDich(): void','+ docVaKhoa(ma: UUID): DuLieu','+ luuBanChot(duLieu: Snapshot): void'])],
        [('auth','repo','','','dependency'),('orders','repo','','','dependency'),('payment','repo','','','dependency')],['UC-03','UC-04','UC-05','UC-06','UC-08','UC-10'])
    class_page(book,None,'cl22-workshop-services','EL22 - Lớp dịch vụ tệp kế hoạch và vận hành',[
        C('file','DichVuTepBaoGia',[],['+ tiepNhan(tep: PhienBanTep): YeuCauIn','+ thamDinh(ma: UUID, ketQua: ThamDinh): void',
            '+ yeuCauSua(ma: UUID, lyDo: String): void','+ phatHanh(ma: UUID): BaoGia','+ chapThuan(banChot: Snapshot): DonHang']),
        C('plan','DichVuKeHoach',[],['+ taoDeXuat(nguon: Snapshot): KeHoachSanXuat','+ apDung(ma: UUID, revision: Integer): KetQua','+ tuChoi(ma: UUID, lyDo: String): void']),
        C('operator','DichVuVanHanh',[],['+ ghiBatDau(ma: UUID): LanIn','+ ghiQC(ketQua: KetQuaQC): void','+ deNghiInLai(luongThieu: Integer): void',
            '+ ghiBienDongKho(duLieu: BienDongKho): KetQua']),
        C('catalogue','DichVuCatalogue',[],['+ them(duLieu: NoiDung): SanPham','+ sua(ma: UUID, revision: Integer): void','+ xoaNhapChuaDung(ma: UUID): void','+ xuatBan(ma: UUID): void']),
        C('policy','ChinhSachSanXuat',[],['+ kiemDieuKienCung(): KetQuaKiem','+ kiemSnapshot(hash: String): Boolean']),
        C('repo','KhoNghiepVu',[],['+ trongGiaoDich(): void','+ docVaKhoa(ma: UUID): DuLieu'])],
        [('file','repo','','','dependency'),('plan','policy','','','dependency'),('plan','repo','','','dependency'),
         ('operator','repo','','','dependency'),('catalogue','repo','','','dependency')],['UC-12','UC-13','UC-15'])
    class_page(book,None,'cl23-estimate','EL23 - Lớp phân tích STL và giá tham khảo',[
        C('request','YeuCauUocTinh',['- tep: TepSTL','- cauHinh: CauHinhFDM','- soLuong: Integer'],['+ hopLe(): Boolean']),
        C('features','DacTrungHinhHoc',['- theTich: Decimal','- dienTich: Decimal','- kichThuoc: Vector3'],['+ trichXuat(tep: TepSTL): void']),
        C('model','MoHinhDuDoan',['- phienBanModel: String','- heSoGram: Decimal[]','- heSoThoiGian: Decimal[]'],['+ duDoan(dacTrung: DacTrungHinhHoc): KetQuaDuDoan']),
        C('service','DichVuUocTinh',['- gioiHanTep: Integer'],['+ phanTich(yeuCau: YeuCauUocTinh): DacTrungHinhHoc','+ uocTinh(yeuCau: YeuCauUocTinh): GiaThamKhao']),
        C('price','GiaThamKhao',['- donGiaDuKien: Money','- tongDuKien: Money','- canhBao: String[]'],['+ tinhTong(soLuong: Integer): Money']),
        C('result','KetQuaDuDoan',['- khoiLuongGram: Decimal','- thoiGianPhut: Decimal','- phienBanModel: String'],['+ namTrongPhamVi(): Boolean'])],
        [('service','request','','','dependency'),('service','features','','','dependency'),('service','model','','','dependency'),
         ('model','result','','','dependency'),('service','price','','','dependency')],['UC-11.1','UC-11.2'])


def build_erd_details(book):
    defs=[
        ('erd03-auth','ERD03 - ERD tài khoản vai trò và phiên',[
            C('user','NGUOI_DUNG',['PK maNguoiDung: UUID','UQ email: String','matKhauHash: String','trangThai: String']),
            C('membership','NGUOI_DUNG_VAI_TRO',['PK FK maNguoiDung: UUID','PK FK maVaiTro: String']),
            C('role','VAI_TRO',['PK maVaiTro: String','ten: String']),
            C('session','PHIEN_DANG_NHAP',['PK maPhien: UUID','FK maNguoiDung: UUID','UQ tokenHash: String','hetHan: Instant','thuHoiLuc: Instant?']),
            C('token','TOKEN_TAI_KHOAN',['PK maToken: UUID','FK maNguoiDung: UUID','UQ tokenHash: String','mucDich: String','hetHan: Instant','daDungLuc: Instant?'])],
            [('user','membership','1','0..*','assoc'),('role','membership','1','0..*','assoc'),('user','session','1','0..*','assoc'),
             ('user','token','1','0..*','assoc')],['UC-03','UC-04','UC-05']),
        ('erd04-file','ERD04 - ERD tệp phiên bản và thẩm định',[
            C('user','NGUOI_DUNG',['PK maNguoiDung: UUID']),
            C('request','YEU_CAU_IN',['PK maYeuCau: UUID','FK maKhach: UUID','trangThai: String','khaiBaoQuyenSuDung: Boolean']),
            C('file','PHIEN_BAN_TEP',['PK maPhienBanTep: UUID','FK maYeuCau: UUID','revision: Integer','hashNoiDung: String','khoaLuuTru: String']),
            C('inspection','THAM_DINH_TEP',['PK maThamDinh: UUID','FK maPhienBanTep: UUID','FK maNguoiDuyet: UUID','ketLuan: String']),
            C('spec','PHIEN_BAN_THONG_SO',['PK maThongSo: UUID','FK maPhienBanTep: UUID','revision: Integer','vatLieu: String','kichThuoc: Vector3'])],
            [('user','request','1','0..*','assoc'),('request','file','1','0..*','assoc'),('file','inspection','1','0..*','assoc'),
             ('file','spec','1','0..*','assoc')],['UC-12.1','UC-12.3','UC-12.4','UC-12.10']),
        ('erd05-accept','ERD05 - ERD báo giá chấp thuận và một đơn',[
            C('request','YEU_CAU_IN',['PK maYeuCau: UUID','FK maKhach: UUID']),
            C('quote','BAO_GIA',['PK maBaoGia: UUID','FK maYeuCau: UUID','revision: Integer','hanChapThuan: Instant','snapshotHash: String']),
            C('line','DONG_BAO_GIA',['PK maDongBaoGia: UUID','FK maBaoGia: UUID','FK maThongSo: UUID','soLuongDuyet: Integer','donGiaChot: Money']),
            C('spec','PHIEN_BAN_THONG_SO',['PK maThongSo: UUID','FK maPhienBanTep: UUID']),
            C('approval','CHAP_THUAN',['PK maChapThuan: UUID','FK UQ maBaoGia: UUID','FK maKhach: UUID','snapshotHash: String']),
            C('order','DON_HANG',['PK maDon: UUID','FK UQ maChapThuan: UUID?','FK maKhach: UUID?','tongTien: Money'])],
            [('request','quote','1','0..*','assoc'),('quote','line','1','0..*','assoc'),('quote','approval','1','0..1','assoc'),
             ('approval','order','0..1','0..1','assoc'),('spec','line','1','0..*','assoc')],['UC-12.5','UC-12.6','UC-12.7','UC-12.8','UC-12.9']),
        ('erd06-bom','ERD06 - ERD BOM phiên bản và nhu cầu',[
            C('variant','BIEN_THE',['PK maBienThe: UUID']),
            C('bom','PHIEN_BAN_BOM',['PK maBOM: UUID','FK maBienThe: UUID','revision: Integer','trangThai: String']),
            C('line','DONG_BOM',['PK maDongBOM: UUID','FK maBOM: UUID','FK maLinhKien: UUID','maThongSo: UUID','dinhMuc: Integer']),
            C('component','PHIEN_BAN_LINH_KIEN',['PK maLinhKien: UUID','revision: Integer','hashTep: String']),
            C('requirement','NHU_CAU_LINH_KIEN',['PK maNhuCau: UUID','FK maDongBOM: UUID','FK maDongDon: UUID','luongCan: Integer','revision: Integer']),
            C('item','DONG_DON_HANG',['PK maDongDon: UUID','FK maBienThe: UUID?','soLuong: Integer'])],
            [('variant','bom','1','0..*','assoc'),('bom','line','1','0..*','assoc'),('component','line','1','0..*','assoc'),
             ('line','requirement','1','0..*','assoc'),('item','requirement','1','0..*','assoc')],['UC-13','DESIGN-BOM']),
        ('erd07-plan','ERD07 - ERD kế hoạch job và phân bổ đa đơn',[
            C('plan','KE_HOACH',['PK maKeHoach: UUID','revision: Integer','snapshotHash: String','trangThai: String']),
            C('batch','ME_DE_XUAT',['PK maMe: UUID','FK maKeHoach: UUID','bangChungSlicerHash: String']),
            C('candidate','PHAN_BO_DE_XUAT',['PK maDongDeXuat: UUID','FK maMe: UUID','FK maNhuCau: UUID','soLuong: Integer']),
            C('job','CONG_VIEC_IN',['PK maCongViec: UUID','FK UQ maMe: UUID','FK maMay: UUID','trangThai: String']),
            C('allocation','PHAN_BO_CONG_VIEC',['PK maPhanBo: UUID','FK maCongViec: UUID','FK maNhuCau: UUID','soLuong: Integer']),
            C('requirement','NHU_CAU_LINH_KIEN',['PK maNhuCau: UUID','FK maDongDon: UUID','maThongSo: UUID'])],
            [('plan','batch','1','0..*','assoc'),('batch','candidate','1','0..*','assoc'),('requirement','candidate','1','0..*','assoc'),
             ('batch','job','1','0..1','assoc'),('job','allocation','1','0..*','assoc'),('requirement','allocation','1','0..*','assoc')],['UC-13.9','UC-13.10','UC-13.11']),
        ('erd08-qc','ERD08 - ERD lần in QC và in lại',[
            C('job','CONG_VIEC_IN',['PK maCongViec: UUID','FK maMay: UUID']),
            C('attempt','LAN_IN',['PK maLanIn: UUID','FK maCongViec: UUID','batDau: Instant','thongSoThucTe: Snapshot']),
            C('allocation','PHAN_BO_CONG_VIEC',['PK maPhanBo: UUID','FK maCongViec: UUID','FK maNhuCau: UUID']),
            C('consumption','TIEU_HAO',['PK maTieuHao: UUID','FK maLanIn: UUID','FK maVatTu: UUID','soLuong: Decimal']),
            C('qc','KET_QUA_QC',['PK maQC: UUID','FK maLanIn: UUID','FK maPhanBo: UUID','luongDat: Integer','luongLoi: Integer']),
            C('reprint','DE_NGHI_IN_LAI',['PK maDeNghi: UUID','FK maQC: UUID','luongThieu: Integer','trangThai: String'])],
            [('job','attempt','1','0..*','assoc'),('job','allocation','1','0..*','assoc'),('attempt','consumption','1','0..*','assoc'),
             ('attempt','qc','1','0..*','assoc'),('allocation','qc','1','0..*','assoc'),('qc','reprint','1','0..*','assoc')],['UC-13.3','UC-13.5','UC-13.6','UC-13.7']),
        ('erd09-stock','ERD09 - ERD vật tư máy và biến động kho',[
            C('material','VAT_TU',['PK maVatTu: UUID','ten: String','donVi: String','trangThai: String']),
            C('movement','BIEN_DONG_KHO',['PK maBienDong: UUID','FK maVatTu: UUID?','FK maBienThe: UUID?','soLuongCoDau: Decimal','lyDo: String']),
            C('variant','BIEN_THE',['PK maBienThe: UUID','sku: String']),
            C('printer','MAY_IN',['PK maMay: UUID','congNghe: String','revisionCauHinh: Integer','trangThai: String']),
            C('booking','GIU_LICH_MAY',['PK maGiuLich: UUID','FK maMay: UUID','FK UQ maCongViec: UUID','batDau: Instant','ketThuc: Instant']),
            C('job','CONG_VIEC_IN',['PK maCongViec: UUID','FK maMay: UUID'])],
            [('material','movement','0..1','0..*','assoc'),('variant','movement','0..1','0..*','assoc'),
             ('printer','job','1','0..*','assoc'),('printer','booking','1','0..*','assoc'),('job','booking','1','0..1','assoc')],['UC-13.8','DESIGN-STOCK','CRUD-MATERIAL','CRUD-PRINTER']),
        ('erd10-component-stock','ERD10 - ERD tồn linh kiện và giữ lượng cho đơn',[
            C('component','PHIEN_BAN_LINH_KIEN',['PK maLinhKien: UUID','revision: Integer']),
            C('lot','LO_LINH_KIEN_DAT',['PK maLo: UUID','FK maLinhKien: UUID','FK maThongSoCheTao: UUID','luongDat: Integer']),
            C('spec','THONG_SO_CHE_TAO',['PK maThongSoCheTao: UUID','revision: Integer','vatLieuMau: String']),
            C('movement','BIEN_DONG_LINH_KIEN',['PK maBienDong: UUID','FK maLo: UUID','soLuongCoDau: Integer','lyDo: String']),
            C('hold','GIU_TON_LINH_KIEN',['PK maGiuTon: UUID','FK maLo: UUID','FK maNhuCau: UUID','soLuong: Integer']),
            C('requirement','NHU_CAU_LINH_KIEN',['PK maNhuCau: UUID','FK maDongDon: UUID','maLinhKien: UUID','maThongSoCheTao: UUID'])],
            [('component','lot','1','0..*','assoc'),('spec','lot','1','0..*','assoc'),('lot','movement','1','0..*','assoc'),
             ('lot','hold','1','0..*','assoc'),('requirement','hold','1','0..*','assoc')],['UC-13','DESIGN-STOCK']),
        ('erd11-finished-stock','ERD11 - ERD giữ thành phẩm trước khi nổ BOM',[
            C('variant','BIEN_THE',['PK maBienThe: UUID','sku: String']),
            C('lot','LO_THANH_PHAM_DAT',['PK maLoThanhPham: UUID','FK maBienThe: UUID','luongDatQC: Integer']),
            C('hold','GIU_TON_THANH_PHAM',['PK maGiuTon: UUID','FK maLoThanhPham: UUID','FK maDongDon: UUID','soLuong: Integer']),
            C('item','DONG_DON_HANG',['PK maDongDon: UUID','FK maBienThe: UUID?','soLuong: Integer'])],
            [('variant','lot','1','0..*','assoc'),('lot','hold','1','0..*','assoc'),('item','hold','1','0..*','assoc')],['UC-13','DESIGN-STOCK'])]
    for key,name,classes,relations,ids in defs:class_page(book,None,key,name,classes,relations,ids,True)


def crud_activity(book,key,name,entity,ucs):
    p=book.page(None,key,name,'Activity',width=2650,height=1840,ucs=ucs)
    p.node('start','',1290,160,42,42,'ellipse;fillColor=#222222;')
    p.node('choose',f'Chọn thao tác với {entity}',975,275,680,100,'rounded=0;')
    p.node('decision','Thao tác?',1150,470,330,160,'rhombus;')
    p.edge('start','choose',kind='flow');p.edge('choose','decision',kind='flow')
    for i,(sid,label,guard) in enumerate([
        ('add',f'Nhập dữ liệu {entity} mới','[thêm]'),('edit','Đọc bản hiện tại; nhập thay đổi','[sửa]'),
        ('delete','Chọn xóa nháp hoặc ngừng dùng','[xóa / ngừng dùng]')]):
        x=100+i*870;p.node(sid,wrap(label,29),x,780,700,110,'rounded=0;')
        points=None if i==1 else [(1315,690),(x+350,690)]
        p.edge('decision',sid,guard,'flow',points, 'exitX=0.5;exitY=1;entryX=0.5;entryY=0;')
    p.node('merge','',1290,1040,45,45,'rhombus;')
    for sid in ['add','edit','delete']:
        x,y,w,h=p.boxes[sid];p.edge(sid,'merge',kind='flow',points=[(x+w/2,980),(1312,980)],ports='exitX=0.5;exitY=1;entryX=0.5;entryY=0;')
    p.node('valid','Đúng quyền, dữ liệu\nvà điều kiện lịch sử?',1100,1170,420,180,'rhombus;fontSize=23;')
    p.edge('merge','valid',kind='flow')
    p.node('save','Lưu đúng revision và audit\nXóa chỉ bản nháp chưa được tham chiếu',970,1450,720,115,'rounded=0;')
    p.edge('valid','save','[có]','flow');p.final('end',1290,1730);p.edge('save','end',kind='flow')
    p.node('deny','Từ chối; nêu lý do\nGiữ nguyên dữ liệu',70,1190,680,110,'rounded=0;')
    p.edge('valid','deny','[không]','flow');p.final('deny-end',385,1420);p.edge('deny','deny-end',kind='flow')
    return p


def build_activities(book):
    activity(book,18,'','EL08 - Activity — Đặt hàng catalogue và VietQR',[
        ('cart','Khách xác nhận giỏ và địa chỉ',False),('identity','Đọc phiên nếu có; cho phép guest',False),
        ('valid','Giỏ và mặt hàng đủ điều kiện?',True),('prior','Chưa có đơn cho cùng khóa lặp?',True),
        ('save','Tạo đơn, dòng giá chốt, khoản chờ và quyền tra cứu trong transaction',False),
        ('commit','Giao dịch thành công?',True),('qr','Trả mã đơn và hướng dẫn VietQR; chưa xác nhận nhận tiền',False)],
        [('valid','Không tạo đơn; yêu cầu sửa giỏ hoặc địa chỉ','[không]'),
         ('prior','Cùng dữ liệu: trả đơn cũ; khác dữ liệu: conflict','[đã có kết quả / conflict]'),
         ('commit','Rollback toàn bộ; thông báo thử lại','[không]')],['UC-06'])
    activity(book,19,'','EL09 - Activity — Ước tính STL bằng Ridge',[
        ('select','Chọn STL và cấu hình FDM',False),('valid','Tệp hợp lệ và đọc được?',True),
        ('mesh','Phân tích hình học; trích đặc trưng',False),('features','Phân tích thành công?',True),
        ('predict','Dự đoán gram và thời gian theo model',False),('quantity','Tính giá một sản phẩm và tổng theo số lượng',False),
        ('show','Hiển thị giá tham khảo và giới hạn; có thể bàn giao tư vấn',False)],
        [('valid','Thông báo lỗi tệp; chọn tệp khác','[không]'),('features','Thông báo giới hạn; chuyển tư vấn','[không]')],['UC-11.1','UC-11.2'])
    activity(book,20,'','EL10 - Activity — Lập kiểm và duyệt kế hoạch',[
        ('source','Chọn đơn catalogue đủ điều kiện; chốt BOM và spec',False),
        ('stock','Phân bổ thành phẩm đúng biến thể; nổ BOM phần thiếu',False),
        ('need','Trừ E, G, A không đếm trùng; cộng nhu cầu cùng revision và spec',False),
        ('group','Có phương án máy profile và layout hợp lệ?',True),
        ('slicer','Xác minh slicer cả mẻ, vật tư, chất lượng và lịch',False),
        ('decision','Người có quyền chấp thuận?',True),('snapshot','Mở transaction; khóa và kiểm lại nguồn',False),
        ('fresh','Snapshot còn đúng và tài nguyên đủ?',True),
        ('apply','Ghi job, allocation, giữ lịch và audit một lần; commit',False),
        ('result','Commit thành công?',True)],
        [('group','Chờ dữ liệu hoặc tách mẻ; có lý do','[không]'),('decision','Lưu từ chối; không phát hành job','[không]'),
         ('fresh','Đánh dấu kế hoạch cũ; không áp dụng','[không]'),('result','Rollback mọi hiệu lực; retry có kiểm soát','[không]')],['UC-13.9','UC-13.10','UC-13.11'])
    defs=[
        ('ac16-register','ACT16 - Đăng ký và xác minh email',[
            ('input','Khách nhập thông tin đăng ký',False),('valid','Dữ liệu hợp lệ và email chưa dùng?',True),
            ('create','Lưu tài khoản CUSTOMER, token và outbox trong giao dịch',False),
            ('send','Sau commit gửi email; lỗi gửi giữ hàng đợi thử lại',False),('open','Khách mở liên kết xác minh',False),
            ('token','Token đúng, chưa dùng và còn hạn?',True),('active','Xác minh email; dùng token một lần',False)],
            [('valid','Không tạo tài khoản; nêu lỗi phù hợp','[không]'),('token','Từ chối; cho yêu cầu liên kết mới','[không]')],['UC-03']),
        ('ac17-login','ACT17 - Đăng nhập và kết thúc phiên',[
            ('input','Người dùng nhập thông tin đăng nhập',False),('valid','Thông tin, tài khoản và chính sách hợp lệ?',True),
            ('session','Tạo phiên; đặt cookie bảo mật',False),('use','Người dùng sử dụng chức năng theo quyền',False),
            ('logout','Người dùng đăng xuất; thu hồi phiên và xóa cookie',False)],
            [('valid','Không cấp phiên; thông báo chung hoặc giới hạn thử','[không]')],['UC-04']),
        ('ac18-reset','ACT18 - Khôi phục mật khẩu',[
            ('request','Người dùng yêu cầu liên kết đặt lại',False),('response','Phản hồi chung; tạo token và thư nếu đủ điều kiện',False),
            ('open','Người dùng mở liên kết và nhập mật khẩu mới',False),('valid','Token và tài khoản đủ điều kiện?',True),
            ('save','Đổi hash mật khẩu; dùng token và thu hồi phiên trong transaction',False),
            ('done','Yêu cầu đăng nhập bằng mật khẩu mới',False)],
            [('valid','Không đổi mật khẩu; yêu cầu liên kết mới','[không]')],['UC-05']),
        ('ac19-payment','ACT19 - Đối soát VietQR thủ công',[
            ('select','Nhân viên mở khoản chờ',False),('permission','Đúng quyền và khoản còn được xử lý?',True),
            ('offline','Nhân viên kiểm giao dịch trong ứng dụng ngân hàng bên ngoài',False),('match','Khoản nhận thực khớp thông tin cần đối chiếu?',True),
            ('lock','Mở transaction; khóa và kiểm lại đơn cùng khoản thu',False),('allowed','Đơn chưa hủy và khoản còn đủ điều kiện?',True),
            ('save','Ghi VERIFIED, PAID, CONFIRMED; audit và outbox; commit',False)],
            [('permission','Từ chối truy cập hoặc trả kết quả đã xử lý','[không]'),('match','Không xác nhận; từ chối có lý do nếu phù hợp','[không]'),
             ('allowed','Không thay đổi tiền; trả trạng thái hiện tại','[không]')],['UC-08']),
        ('ac20-file','ACT20 - Tiếp nhận yêu cầu in và tệp',[
            ('input','Khách đăng nhập; chọn tệp, thông số, lượng và khai báo quyền',False),('owner','Đúng danh tính và dữ liệu bắt buộc?',True),
            ('validate','Kiểm tệp theo chính sách định dạng và lưu trữ',False),('valid','Tệp đủ điều kiện tiếp nhận?',True),
            ('save','Lưu yêu cầu, tệp và thông số theo revision; gửi hàng đợi thẩm định',False)],
            [('owner','Yêu cầu bổ sung; chưa tiếp nhận','[không]'),('valid','Nêu lý do; yêu cầu tệp hợp lệ khác','[không]')],['UC-12.1']),
        ('ac21-quote','ACT21 - Thẩm định và phát hành báo giá',[
            ('read','Người duyệt mở đúng revision yêu cầu và tệp',False),('inspect','Kiểm khai báo quyền và khả năng in',False),
            ('valid','Đủ dữ liệu và khả thi?',True),('spec','Chốt thông số, số lượng và đơn giá',False),
            ('publish','Phát hành revision báo giá bất biến cùng thời hạn chính sách',False),
            ('notify','Thông báo để khách xem và quyết định',False)],
            [('valid','Ghi lý do; yêu cầu sửa hoặc bổ sung tệp, giữ lịch sử','[không]')],['UC-12.3','UC-12.4','UC-12.5','UC-12.6']),
        ('ac22-accept','ACT22 - Chấp thuận báo giá và retry',[
            ('accept','Khách xác nhận bản báo giá và thông tin đặt in',False),
            ('guard','Xác thực; mở giao dịch, khóa và đọc lại báo giá',False),('auth','Đúng chủ và đúng bản chốt?',True),
            ('prior','Chưa có kết quả chuyển đổi cho acceptance?',True),('fresh','Cho chuyển đổi mới và báo giá còn hiệu lực?',True),
            ('save','Khóa và ghi acceptance, đơn đủ lượng cùng thông báo trong transaction',False),
            ('commit','Giao dịch thành công?',True),('result','Trả đơn chờ thanh toán và hướng dẫn VietQR',False)],
            [('auth','Từ chối; kết thúc giao dịch, không tiết lộ đơn người khác','[không]'),
             ('prior','Kết thúc giao dịch; trả đơn cũ dù nay đã qua hạn','[đã có]'),
             ('fresh','Kết thúc giao dịch; không tạo đơn mới từ bản không hợp lệ','[không]'),
             ('commit','Rollback; retry hoặc conflict không nhân đôi đơn','[không]')],['UC-12.8']),
        ('ac23-qc','ACT23 - Vận hành in hậu xử lý và QC',[
            ('job','Thợ mở công việc được giao và kiểm máy vật tư',False),('allowed','Công việc đã được phát hành hợp lệ?',True),
            ('start','Thợ khởi động máy thủ công; ghi lần in và thông số thực tế',False),
            ('post','Ghi hoàn tất in, hậu xử lý và tiêu hao',False),('qc','QC theo từng phân bổ; ghi lượng đạt và lỗi',False),
            ('enough','Đủ số lượng đạt?',True),('ready','Đủ linh kiện: lắp ráp và QC thành phẩm; sẵn bàn giao',False)],
            [('allowed','Không bắt đầu; báo người điều phối','[không]'),
             ('enough','Giữ kết quả cũ; đề nghị in lại phần thiếu và chờ người có quyền','[không]')],['UC-13.1','UC-13.2','UC-13.3','UC-13.4','UC-13.5','UC-13.6','UC-13.7']),
        ('ac24-order','ACT24 - Điều phối giao hàng và hủy đơn',[
            ('read','Nhân viên tra cứu đơn và chọn bước xử lý',False),('permission','Đúng quyền và cạnh trạng thái?',True),
            ('cancel','Là thao tác tiếp tục tiến độ?',True),('money','Đủ điều kiện tiền và chế tác?',True),
            ('move','Ghi trạng thái hợp lệ: sản xuất, sẵn giao hoặc đã giao',False),
            ('done','Xác nhận hoàn tất khi đủ điều kiện; COD chỉ cho đơn lịch sử',False)],
            [('permission','Từ chối; giữ trạng thái và lịch sử','[không]'),('cancel','Chỉ hủy khi chưa thu tiền và policy cho phép; nếu không thì từ chối','[hủy đơn]'),
             ('money','Chờ thanh toán hoặc hoàn thiện; không bỏ qua điều kiện','[không]')],['UC-10']),
        ('ac25-stock','ACT25 - Nhập xuất và điều chỉnh tồn',[
            ('choose','Người có quyền chọn nghiệp vụ nhập xuất hoặc điều chỉnh',False),('input','Nhập mặt hàng, lượng, đơn vị và lý do',False),
            ('valid','Đúng quyền, đúng nguồn và lượng hợp lệ?',True),('lock','Khóa và kiểm tồn khả dụng cùng reservation',False),
            ('save','Ghi biến động kho và audit một lần; không xóa lịch sử',False)],
            [('valid','Không ghi biến động; nêu lý do','[không]')],['DESIGN-STOCK','UC-13.6'])]
    for key,name,steps,branches,ids in defs:activity(book,None,key,name,steps,branches,ids)
    crud_activity(book,'ac26-product-crud','ACT26 - Thêm sửa xóa và ngừng bán sản phẩm','sản phẩm',['UC-15','CRUD-PRODUCT','CRUD-VARIANT'])
    crud_activity(book,'ac27-resource-crud','ACT27 - Thêm sửa xóa tài nguyên xưởng','tài nguyên',['CRUD-MATERIAL','CRUD-PRINTER','CRUD-CATEGORY'])


def build_sequences(book):
    sequence(book,23,'','EL13 - Sequence — Ước tính STL với nhánh lỗi',[
        ('guest','Khách'),('ui','Giao diện'),('worker','STL Worker'),('ridge','Mô hình Ridge')],[
        ('guest','ui','Chọn STL và cấu hình FDM',False),('ui','worker','Kiểm tệp và phân tích hình học',False),
        ('worker','ui','Lỗi định dạng hoặc phân tích',True),('ui','guest','Hiển thị lỗi và hướng khắc phục',True),
        ('worker','ridge','Dự đoán từ đặc trưng hợp lệ',False),('ridge','worker','Khối lượng và thời gian tham khảo',True),
        ('worker','ui','Kết quả phân tích và model version',True),('ui','guest','Giá tham khảo theo cấu hình và số lượng',True)],
        [(2,7,'alt',[(2,'[Tệp lỗi hoặc phân tích thất bại]'),(4,'[Tệp hợp lệ và phân tích thành công]')])],['UC-11.1'])
    sequence(book,25,'','EL15 - Sequence — Đặt hàng và đối soát thủ công',[
        ('customer','Khách'),('website','MinhLab 3D'),('staff','Nhân viên'),('bank','Ứng dụng ngân hàng')],[
        ('customer','website','Đặt catalogue; guest hoặc customer',False),('website','website','Tạo đơn và khoản chờ trong transaction',False),
        ('website','customer','Mã đơn và hướng dẫn VietQR',True),('customer','bank','Khách tự chuyển khoản ngoài website',False),
        ('staff','website','Mở khoản chờ cần đối soát',False),('staff','bank','Nhân viên tự kiểm giao dịch ngoài website',False),
        ('bank','staff','Thông tin giao dịch nhân viên quan sát',True),
        ('staff','website','Xác nhận đã nhận đúng khoản tiền',False),('website','website','Kiểm quyền và trạng thái; ghi VERIFIED',False),
        ('website','staff','Kết quả xác nhận',True),('staff','website','Từ chối khoản chờ có lý do',False),
        ('website','staff','Giữ đơn chưa thanh toán; ghi quyết định',True)],
        [(7,11,'alt',[(7,'[Khoản nhận khớp và đủ điều kiện]'),(10,'[Chưa nhận hoặc không khớp; đủ điều kiện từ chối]')])],['UC-06','UC-08'])
    defs=[
        ('sq16-register','SEQ16 - Đăng ký xác minh và lỗi gửi thư',
         [('actor','Khách'),('ui','Giao diện'),('svc','DichVuTaiKhoan'),('db','KhoNghiepVu'),('mail','Bộ gửi thông báo')],[
            ('actor','ui','Gửi đăng ký',False),('ui','svc','Đăng ký tài khoản CUSTOMER',False),
            ('svc','db','Kiểm trùng; lưu tài khoản token và outbox',False),('db','svc','COMMIT tài khoản chờ xác minh',True),
            ('svc','mail','Thử gửi thư sau commit',False),('mail','svc','Đã gửi đến nhà cung cấp',True),
            ('mail','svc','Lỗi gửi; giữ outbox để worker thử lại',True),('svc','ui','Tài khoản đã lưu; không rollback vì lỗi gửi',True),
            ('actor','ui','Mở liên kết xác minh hợp lệ',False),('ui','svc','Xác minh token một lần',False),
            ('svc','db','Khóa token; cập nhật email đã xác minh',False),('db','svc','Commit; token không dùng lại',True),
            ('svc','ui','Kết quả xác minh',True)],[(5,6,'alt',[(5,'[Gửi thành công]'),(6,'[Lỗi nhà cung cấp]')])],['UC-03']),
        ('sq17-login','SEQ17 - Đăng nhập đăng xuất và kiểm phiên',
         [('actor','Người có tài khoản'),('ui','Giao diện'),('svc','DichVuTaiKhoan'),('db','KhoNghiepVu')],[
            ('actor','ui','Nhập email và mật khẩu',False),('ui','svc','Yêu cầu đăng nhập',False),
            ('svc','db','Đọc tài khoản, trạng thái và role hiện hành',False),('db','svc','Dữ liệu xác thực',True),
            ('svc','ui','Thông báo chung; không cấp phiên',True),('svc','db','Lưu phiên với token hash',False),
            ('svc','ui','Cấp cookie phiên bảo mật',True),('actor','ui','Yêu cầu đăng xuất',False),
            ('ui','svc','Thu hồi phiên hiện tại',False),('svc','db','Đánh dấu phiên đã thu hồi',False),
            ('svc','ui','Xóa cookie; phiên cũ không dùng lại',True)],
         [(4,10,'alt',[(4,'[Thông tin hoặc tài khoản không đủ điều kiện]'),(5,'[Đăng nhập hợp lệ; sử dụng và đăng xuất]')])],['UC-04']),
        ('sq18-reset','SEQ18 - Đặt lại mật khẩu bằng token',
         [('actor','Người có tài khoản'),('ui','Giao diện'),('svc','DichVuTaiKhoan'),('db','KhoNghiepVu')],[
            ('actor','ui','Yêu cầu liên kết khôi phục',False),('ui','svc','Yêu cầu đặt lại mật khẩu',False),
            ('svc','db','Lưu token và outbox nếu tài khoản đủ điều kiện',False),('svc','ui','Phản hồi chung không lộ tài khoản',True),
            ('actor','ui','Mở liên kết và nhập mật khẩu mới',False),('ui','svc','Gửi token và mật khẩu mới',False),
            ('svc','db','Khóa token; kiểm tài khoản và thời hạn',False),('svc','ui','Token không hợp lệ; không đổi mật khẩu',True),
            ('svc','db','Đổi hash; dùng token; thu hồi phiên; COMMIT',False),('svc','ui','Thành công; yêu cầu đăng nhập lại',True)],
         [(7,9,'alt',[(7,'[Token sai hết hạn hoặc tài khoản không đủ điều kiện]'),(8,'[Đủ điều kiện đổi mật khẩu]')])],['UC-05']),
        ('sq19-intake','SEQ19 - Tiếp nhận tệp và lưu revision',
         [('actor','Khách hàng'),('ui','Giao diện'),('svc','DichVuTepBaoGia'),('file','Kho tệp'),('db','KhoNghiepVu')],[
            ('actor','ui','Gửi tệp, thông số và khai báo quyền',False),('ui','svc','Tiếp nhận yêu cầu theo danh tính phiên',False),
            ('svc','svc','Kiểm quyền định dạng và giới hạn tệp',False),('svc','ui','Từ chối tệp không đủ điều kiện',True),
            ('svc','file','Lưu tệp theo khóa bất biến và hash',False),('file','svc','Tham chiếu tệp đã lưu',True),
            ('svc','db','Lưu yêu cầu và revision tệp cùng thông số',False),('db','svc','Commit dữ liệu tiếp nhận',True),
            ('svc','ui','Mã yêu cầu đang chờ thẩm định',True)],
         [(3,8,'alt',[(3,'[Không hợp lệ]'),(4,'[Hợp lệ để tiếp nhận]')])],['UC-12.1']),
        ('sq20-review','SEQ20 - Thẩm định sửa tệp và phát hành báo giá',
         [('actor','Nhân viên duyệt tệp'),('ui','Giao diện'),('svc','DichVuTepBaoGia'),('db','KhoNghiepVu')],[
            ('actor','ui','Mở yêu cầu và kết quả kiểm kỹ thuật',False),('ui','svc','Thẩm định đúng revision',False),
            ('svc','db','Đọc tệp, thông số và khai báo quyền',False),('db','svc','Bản chốt cần thẩm định',True),
            ('actor','ui','Yêu cầu sửa tệp có lý do',False),('ui','svc','Lưu yêu cầu bổ sung; giữ lịch sử',False),
            ('svc','db','Cập nhật trạng thái chờ sửa',False),('actor','ui','Chốt thông số lượng giá và phát hành',False),
            ('ui','svc','Phát hành revision báo giá mới',False),('svc','db','Lưu báo giá, dòng và snapshot bất biến',False),
            ('db','svc','Commit; ghi thông báo cho khách',True),('svc','ui','Báo giá được phát hành',True)],
         [(4,11,'alt',[(4,'[Cần sửa hoặc thiếu dữ liệu]'),(7,'[Đủ điều kiện phát hành]')])],['UC-12.3','UC-12.4','UC-12.5','UC-12.6']),
        ('sq21-accept','SEQ21 - Chấp thuận báo giá và trả lại đơn cũ',
         [('actor','Khách hàng'),('ui','Giao diện'),('svc','DichVuTepBaoGia'),('db','KhoNghiepVu')],[
            ('actor','ui','Chấp thuận đúng bản báo giá',False),('ui','svc','Gửi bản chốt và khóa lặp',False),
            ('svc','db','Bắt đầu; kiểm chủ sở hữu và khóa nguồn',False),('db','svc','Danh tính và snapshot hợp lệ',True),
            ('svc','db','Tìm đơn đã chuyển từ acceptance này',False),('db','svc','Kết quả đã có hoặc chưa có',True),
            ('svc','db','Kết thúc giao dịch không ghi thêm',False),('svc','ui','Trả đơn cũ dù hiện đã qua hạn báo giá',True),
            ('ui','actor','Hiển thị lại đơn đã tạo',True),('svc','db','Kiểm hiệu lực cho chuyển đổi mới',False),
            ('db','svc','Revision đang phát hành và còn hạn',True),
            ('svc','db','Lưu acceptance, một đơn đủ lượng và outbox; COMMIT',False),
            ('db','svc','Một kết quả chuyển đổi có ràng buộc duy nhất',True),('svc','ui','Trả đơn chờ thanh toán VietQR',True),
            ('ui','actor','Hiển thị đơn và hướng dẫn thanh toán',True)],
         [(6,14,'alt',[(6,'[Đã có kết quả cho cùng lần chấp thuận]'),(9,'[Chưa có kết quả và đủ điều kiện chuyển đổi mới]')])],['UC-12.8']),
        ('sq22-accept-fail','SEQ22 - Chấp thuận bị từ chối conflict và rollback',
         [('actor','Khách hàng'),('ui','Giao diện'),('svc','DichVuTepBaoGia'),('db','KhoNghiepVu')],[
            ('actor','ui','Gửi chấp thuận báo giá',False),('ui','svc','Yêu cầu chuyển thành đơn',False),
            ('svc','db','Kiểm quyền, snapshot và kết quả đã có',False),('svc','ui','Từ chối sai chủ hoặc sai bản chốt',True),
            ('svc','ui','Từ chối tạo mới từ báo giá hết hạn hoặc thu hồi',True),
            ('svc','db','Thử ghi acceptance và đơn đủ lượng',False),('db','svc','Conflict đồng thời hoặc lỗi ghi',True),
            ('svc','db','ROLLBACK toàn bộ tác động chưa commit',False),
            ('svc','ui','Replay hợp lệ trả đơn cũ; khác dữ liệu trả conflict',True)],
         [(3,8,'alt',[(3,'[Sai quyền hoặc snapshot]'),(4,'[Không có đơn cũ; không đủ điều kiện tạo mới]'),
                     (5,'[Lỗi ghi hoặc tranh chấp cùng chuyển đổi]')])],['UC-12.8']),
        ('sq23-reconcile','SEQ23 - Đối soát và xử lý hai người xác nhận',
         [('actor','Nhân viên'),('ui','Giao diện'),('svc','DichVuThanhToan'),('db','KhoNghiepVu')],[
            ('actor','ui','Xác nhận sau khi tự kiểm ngân hàng',False),('ui','svc','Gửi quyết định và danh tính người xử lý',False),
            ('svc','db','Bắt đầu; khóa đơn rồi khoản thanh toán',False),('db','svc','Trạng thái hiện tại',True),
            ('svc','ui','Trả kết quả đã VERIFIED; không ghi thêm',True),('svc','ui','Từ chối nếu đơn hủy hoặc dữ liệu không hợp lệ',True),
            ('svc','db','Ghi VERIFIED và PAID, lịch sử, outbox; COMMIT',False),
            ('db','svc','Thành công một lần',True),('svc','ui','Kết quả đã nhận tiền',True)],
         [(4,8,'alt',[(4,'[Người khác đã xác nhận trước]'),(5,'[Không đủ điều kiện]'),(6,'[Đủ quyền và khoản còn chờ]')])],['UC-08']),
        ('sq24-plan','SEQ24 - Duyệt kế hoạch stale replay và commit',
         [('actor','Quản trị viên'),('ui','Giao diện'),('svc','DichVuKeHoach'),('db','KhoNghiepVu')],[
            ('actor','ui','Áp dụng plan revision đã rà soát',False),('ui','svc','Gửi plan revision và khóa lặp',False),
            ('svc','db','BEGIN; khóa và đọc nguồn hiện hành',False),('db','svc','Kết quả cũ hoặc nguồn snapshot mới nhất',True),
            ('svc','ui','Trả kết quả apply đã commit; không tạo thêm',True),
            ('svc','db','Không ghi job; đánh dấu nguồn lỗi thời',False),('svc','ui','Yêu cầu lập phương án mới',True),
            ('svc','svc','Kiểm policy, slicer, nhu cầu và tài nguyên',False),
            ('svc','db','Ghi job allocation giữ lịch và audit trong transaction',False),('db','svc','COMMIT thành công',True),
            ('svc','ui','Chỉ báo áp dụng thành công sau commit',True)],
         [(4,10,'alt',[(4,'[Apply hợp lệ đã hoàn tất trước]'),(5,'[Chưa apply; snapshot hoặc điều kiện đã thay đổi]'),
                      (7,'[Chưa apply; mọi điều kiện còn hợp lệ]')])],['UC-13.10']),
        ('sq25-qc','SEQ25 - Ghi QC và đề nghị in lại phần thiếu',
         [('actor','Thợ vận hành'),('ui','Giao diện'),('svc','DichVuVanHanh'),('db','KhoNghiepVu')],[
            ('actor','ui','Ghi lần in thông số và tiêu hao thực tế',False),('ui','svc','Lưu theo công việc được giao',False),
            ('svc','db','Kiểm quyền; ghi lần in và tiêu hao một lần',False),('actor','ui','Nhập lượng đạt lỗi theo phân bổ',False),
            ('ui','svc','Ghi kết quả QC',False),('svc','db','Giữ lịch sử; cập nhật lượng đạt và thiếu',False),
            ('svc','ui','Đủ lượng đạt; cho tiếp tục hoàn thiện',True),('svc','db','Lưu đề nghị in lại đúng lượng thiếu',False),
            ('svc','ui','Chờ người có quyền; không tự phát hành lượt in mới',True)],
         [(6,8,'alt',[(6,'[Đủ lượng đạt]'),(7,'[Còn thiếu hoặc có lỗi]')])],['UC-13.3','UC-13.4','UC-13.5','UC-13.6','UC-13.7']),
        ('sq26-catalogue','SEQ26 - Thêm sửa xóa và xuất bản catalogue',
         [('actor','Quản trị viên'),('ui','Giao diện'),('svc','DichVuCatalogue'),('db','KhoNghiepVu')],[
            ('actor','ui','Chọn thêm sửa xóa nháp hoặc xuất bản',False),('ui','svc','Gửi thao tác dữ liệu và revision',False),
            ('svc','db','Khóa bản hiện tại; kiểm quyền và tham chiếu lịch sử',False),
            ('svc','ui','Từ chối conflict hoặc xóa bản đã được dùng',True),
            ('svc','db','Lưu nháp và audit; thu hồi duyệt khi sửa; COMMIT',False),
            ('svc','db','Xóa nháp chưa tham chiếu và audit; COMMIT',False),
            ('svc','db','Lưu xuất bản đủ điều kiện cùng audit; COMMIT',False),
            ('svc','ui','Trả kết quả từ chối hoặc thao tác đã chọn',True)],
         [(3,6,'alt',[(3,'[Không đủ điều kiện]'),(4,'[Thêm hoặc sửa hợp lệ]'),(5,'[Xóa nháp hợp lệ]'),(6,'[Nội dung giá và quyền sử dụng đủ điều kiện xuất bản]')])],['UC-15','CRUD-PRODUCT','CRUD-VARIANT']),
        ('sq27-stock','SEQ27 - Ghi biến động và bảo vệ tồn khả dụng',
         [('actor','Người có quyền kho'),('ui','Giao diện'),('svc','DichVuVanHanh'),('db','KhoNghiepVu')],[
            ('actor','ui','Nhập nghiệp vụ số lượng và lý do',False),('ui','svc','Gửi thao tác kho với khóa lặp',False),
            ('svc','db','BEGIN; khóa nguồn tồn và reservation',False),('db','svc','Tồn khả dụng và hiệu lực đã có',True),
            ('svc','ui','Từ chối thiếu tồn hoặc sai dữ liệu',True),
            ('svc','db','Ghi biến động và audit; không sửa mất lịch sử',False),('db','svc','COMMIT hiệu lực một lần',True),
            ('svc','ui','Trả kết quả hoặc kết quả replay cũ',True)],
         [(4,7,'alt',[(4,'[Không hợp lệ]'),(5,'[Hợp lệ để ghi hoặc replay]')])],['DESIGN-STOCK','UC-13.6'])]
    for key,name,participants,events,frames,ids in defs:sequence(book,None,key,name,participants,events,frames,ids)
    sequence(book,None,'sq28-plan-rollback','SEQ28 - Kế hoạch lỗi giao dịch và tranh chấp tài nguyên',
        [('actor','Quản trị viên'),('ui','Giao diện'),('svc','DichVuKeHoach'),('db','KhoNghiepVu')],[
        ('actor','ui','Áp dụng kế hoạch đã chọn',False),('ui','svc','Gửi plan revision và khóa lặp',False),
        ('svc','db','BEGIN; khóa nhu cầu vật tư và lịch máy',False),
        ('db','svc','Nguồn bị giữ bởi kế hoạch khác',True),('svc','db','ROLLBACK; không tạo hiệu lực',False),
        ('svc','ui','Conflict tài nguyên; yêu cầu phương án mới',True),
        ('svc','db','Ghi job rồi allocation giữ lịch audit',False),('db','svc','Lỗi trước COMMIT',True),
        ('svc','db','ROLLBACK mọi tác động chưa commit',False),('svc','ui','Thông báo chưa áp dụng; retry có cùng khóa',True)],
        [(3,9,'alt',[(3,'[Không đủ tài nguyên ngay khi apply]'),(6,'[Nguồn đủ nhưng giao dịch ghi thất bại]')])],['UC-13.10'])


def build_states(book):
    state(book,'st01-order','ST01 - Trạng thái đơn catalogue VietQR',[
        ('pending','Chờ thanh toán'),('confirmed','Đã xác nhận'),('printing','Đang chế tác'),
        ('ready','Sẵn sàng giao'),('shipped','Đã bàn giao vận chuyển'),('completed','Hoàn tất'),('cancelled','Đã hủy')],[
        ('pending','confirmed','xác nhận tiền hợp lệ'),('confirmed','printing','bắt đầu [đủ điều kiện]'),
        ('printing','ready','hoàn thiện và QC đạt'),('ready','shipped','nhân viên bàn giao'),
        ('shipped','completed','xác nhận đã giao'),('pending','cancelled','hủy [chưa thu tiền]')],['UC-06','UC-08','UC-10'])
    state(book,'st02-payment','ST02 - Trạng thái đối soát thanh toán',[
        ('pending','Chờ đối soát'),('verified','Đã xác nhận nhận tiền'),('rejected','Bị từ chối')],[
        ('pending','verified','nhân viên xác nhận [đã kiểm ngân hàng]'),('pending','rejected','từ chối có lý do'),
        ('rejected','pending','khai báo lại [đơn vẫn chờ]'),('verified','verified','yêu cầu lặp / trả kết quả cũ')],['UC-07','UC-08'])
    state(book,'st03-request','ST03 - Trạng thái yêu cầu in theo tệp',[
        ('draft','Nháp'),('submitted','Đã tiếp nhận'),('review','Đang thẩm định'),
        ('fix','Chờ sửa tệp'),('ready','Đủ điều kiện báo giá'),('quoted','Đã phát hành báo giá')],[
        ('draft','submitted','gửi [tệp và dữ liệu hợp lệ]'),('submitted','review','người duyệt nhận xử lý'),
        ('review','fix','yêu cầu bổ sung có lý do'),('fix','submitted','gửi revision mới'),
        ('review','ready','thẩm định đạt'),('ready','quoted','phát hành báo giá')],['UC-12.1','UC-12.3','UC-12.4','UC-12.5'])
    state(book,'st04-quote','ST04 - Trạng thái một phiên bản báo giá',[
        ('draft','Nháp'),('issued','Đã phát hành'),('accepted','Đã chấp thuận'),
        ('declined','Khách từ chối'),('expired','Hết hạn'),('withdrawn','Đã thu hồi')],[
        ('draft','issued','phát hành [thông số và giá đã chốt]'),('issued','accepted','chấp thuận / một đơn đủ lượng'),
        ('issued','declined','khách từ chối [được phép quyết định]'),('issued','expired','qua hạn [chưa chuyển đổi]'),
        ('issued','withdrawn','thu hồi theo thẩm quyền'),('accepted','accepted','replay đúng chủ và bản / trả đơn cũ')],['UC-12.5','UC-12.6','UC-12.7','UC-12.8','UC-12.9'])
    state(book,'st05-plan','ST05 - Trạng thái kế hoạch sản xuất',[
        ('draft','Nháp'),('waiting','Chờ dữ liệu'),('proposal','Đã kiểm và chờ duyệt'),
        ('applied','Đã duyệt và áp dụng'),('rejected','Bị từ chối'),('stale','Nguồn đã lỗi thời')],[
        ('draft','waiting','thiếu dữ liệu hoặc bằng chứng'),('draft','proposal','ràng buộc và slicer đạt'),
        ('waiting','draft','bổ sung nguồn / revision mới'),('proposal','applied','người duyệt [nguồn còn đúng] / commit'),
        ('proposal','rejected','từ chối có lý do'),('proposal','stale','nguồn đổi khi apply'),
        ('stale','draft','lập revision mới'),('applied','applied','apply lặp / trả kết quả cũ')],['UC-13.9','UC-13.10','UC-13.11'])
    state(book,'st06-job','ST06 - Trạng thái công việc và kết quả in',[
        ('queued','Đã phát hành chờ làm'),('preparing','Đang chuẩn bị'),('printing','Đang in'),
        ('post','Đang hậu xử lý'),('qc','Đang kiểm định'),('passed','Đủ lượng đạt'),('short','Có lỗi hoặc thiếu lượng')],[
        ('queued','preparing','thợ nhận công việc'),('preparing','printing','thợ ghi bắt đầu [máy và vật tư hợp lệ]'),
        ('printing','post','ghi hoàn tất in'),('post','qc','bắt đầu QC'),('qc','passed','ghi kết quả [đủ lượng]'),
        ('qc','short','ghi kết quả [còn thiếu]'),('short','short','gửi đề nghị in lại / chờ quyết định')],['UC-13.1','UC-13.2','UC-13.3','UC-13.4','UC-13.5','UC-13.7'])
    state(book,'st07-product','ST07 - Trạng thái sản phẩm và xóa bản nháp',[
        ('draft','Nháp cần rà soát'),('reviewed','Đã rà soát đủ điều kiện'),('published','Đang công khai'),
        ('stopped','Đã ngừng bán'),('deleted','Đã xóa bản nháp')],[
        ('draft','reviewed','kiểm nội dung và quyền sử dụng'),('reviewed','published','xuất bản [đủ điều kiện]'),
        ('published','draft','sửa nội dung / thu hồi duyệt'),('published','stopped','ngừng bán / giữ lịch sử'),
        ('stopped','reviewed','rà soát để mở bán lại'),('draft','deleted','xóa [chưa được tham chiếu]')],['UC-15','CRUD-PRODUCT','CRUD-VARIANT'])
    state(book,'st08-account','ST08 - Trạng thái tài khoản người dùng',[
        ('pending','Chờ xác minh'),('active','Đang hoạt động'),('locked','Đã khóa'),('deleted','Đã xóa bản nháp chưa dùng')],[
        ('pending','active','xác minh [token hợp lệ]'),('active','locked','quản trị khóa tài khoản'),
        ('locked','active','mở khóa [đủ điều kiện]'),('pending','deleted','xóa [chưa có dữ liệu tham chiếu]')],['UC-03','DESIGN-STAFF-ACCOUNTS'])


def build_architecture(book):
    current=architecture(book,21,'','EL11 - Kiến trúc ứng dụng hiện hành',[
        ('ui','Giao diện Next.js và React',90,240,'component'),('routes','HTTP routes và server composition',1120,240,'component'),
        ('worker','STL Web Worker và mô hình Ridge',90,850,'component'),('services','Use case và domain policy',1120,850,'component'),
        ('db','PostgreSQL',2150,850,'database'),('mail','Adapter và outbox thông báo',1120,1440,'component')],[
        ('ui','routes','HTTP'),('ui','worker','phân tích phía browser'),('routes','services','gọi use case'),
        ('services','db','qua repository'),('services','mail','qua port'),('mail','db','lưu outbox')])
    current.record['implementation']='CURRENT_ARCHITECTURE_PROJECTION'
    architecture(book,24,'','EL14 - Thành phần mục tiêu cho toàn hệ thống',[
        ('ui','Giao diện khách và nhân sự',90,240,'component'),('sales','Tài khoản catalogue đơn và thanh toán',1110,240,'component'),
        ('file','Tiếp nhận tệp thẩm định và báo giá',90,850,'component'),('plan','Core lập kế hoạch và engine ràng buộc',1110,850,'component'),
        ('agent','AI planner nội bộ chỉ tạo đề xuất',2110,240,'component'),('db','PostgreSQL',2110,850,'database'),
        ('storage','Kho tệp qua adapter chưa chốt nhà cung cấp',90,1440,'component'),('notify','Outbox worker email và Telegram',1110,1440,'component')],[
        ('ui','sales','HTTP'),('ui','file','gửi và duyệt tệp'),('sales','db','repository'),('file','storage','lưu tệp revision'),
        ('file','db','lưu yêu cầu và báo giá'),('agent','plan','typed tools'),('plan','db','kiểm nguồn và áp dụng'),('notify','db','đọc outbox')],['UC-12','UC-13'])
    p=book.page(None,'dep01-vps','DEP01 - Triển khai mục tiêu trên VPS','Deployment',width=2900,height=1940)
    p.node('client','«device»\nMáy khách',80,250,650,420,'shape=cube;size=22;align=left;verticalAlign=top;spacingTop=30;')
    p.node('browser','«executionEnvironment»\nTrình duyệt và WebGL',140,400,520,180,'rounded=0;')
    p.node('vps','«device»\nVPS Linux',1000,180,1780,1390,'shape=cube;size=24;align=left;verticalAlign=top;spacingTop=30;')
    p.node('proxy','«executionEnvironment»\nReverse proxy và TLS',1080,360,680,220,'rounded=0;')
    p.node('node','«executionEnvironment»\nNode.js',1080,760,680,570,'rounded=0;align=left;verticalAlign=top;spacingTop=20;')
    p.node('app','«artifact»\nỨng dụng Next.js',1135,895,570,140,'rounded=0;')
    p.node('worker','«artifact»\nWorker thông báo',1135,1100,570,140,'rounded=0;')
    p.node('database','«executionEnvironment»\nPostgreSQL',1970,760,680,570,'rounded=0;align=left;verticalAlign=top;spacingTop=20;')
    p.node('data','«artifact»\nSchema và dữ liệu nghiệp vụ',2025,950,570,180,'rounded=0;')
    p.edge('browser','proxy','HTTPS','assoc');p.edge('proxy','node','HTTP nội bộ','assoc');p.edge('node','database','SQL qua mạng riêng hoặc local','assoc')
    p.record['scope']='Logical VPS target only. Provider, topology, storage and backup deployment are not selected or deployed.'


def build_public_and_delivery(book):
    uc(book,None,'uc24-public','UC24 - Tra cứu trải nghiệm 3D và tư vấn',['guest','customer'],[
        ('browse','Tra cứu sản phẩm',['guest','customer']),('detail','Xem chi tiết sản phẩm',['guest','customer']),
        ('tour','Khám phá phòng lab 3D',['guest','customer']),('advice','Bàn giao thông tin tư vấn',['guest','customer'])],
        ucs=['UC-01','UC-11.2','DESIGN-3D-TOUR'])
    activity(book,None,'ac28-browse','ACT28 - Tìm lọc và xem chi tiết sản phẩm',[
        ('open','Mở catalogue hoặc liên kết sản phẩm trực tiếp',False),
        ('load','Đọc catalogue công khai đủ điều kiện',False),('available','Đọc dữ liệu thành công?',True),
        ('filter','Nhập từ khóa; chọn bộ lọc hoặc mở trực tiếp',False),('found','Có sản phẩm phù hợp được phép công khai?',True),
        ('view','Xem ảnh, thông tin và chọn biến thể',False),('next','Chọn thêm giỏ, mua ngay hoặc tiếp tục xem',False)],
        [('available','Hiện lỗi; cho tải lại','[không]'),('found','Hiện rỗng hoặc không tìm thấy; cho đổi lọc','[không]')],['UC-01'])
    activity(book,None,'ac29-cart','ACT29 - Khôi phục và thay đổi giỏ hàng',[
        ('restore','Đọc tham chiếu giỏ lưu ở trình duyệt nếu có',False),
        ('catalog','Đối chiếu catalogue; chuẩn hóa dữ liệu giỏ',False),
        ('choose','Chọn một thao tác: thêm, đổi lượng hoặc xóa',False),
        ('valid','Thao tác và dữ liệu tương ứng hợp lệ?',True),
        ('apply','Áp dụng thao tác; tính tổng tạm tính',False),
        ('persist','Thử lưu tham chiếu giỏ; lỗi vẫn giữ giỏ trong phiên',False),
        ('checkout','Khi đặt hàng, server kiểm lại giá và trạng thái bán',False)],
        [('valid','Giữ giỏ cũ; nêu lỗi hoặc yêu cầu tải lại catalogue','[không]')],['UC-02'])
    activity(book,None,'ac30-tracking','ACT30 - Tra cứu đơn và lịch sử riêng tư',[
        ('choose','Mở liên kết một đơn hoặc lịch sử tài khoản',False),
        ('auth','Lịch sử dùng phiên; tra một đơn dùng chủ đơn hoặc token',False),
        ('allowed','Đúng quyền với loại truy vấn và đơn?',True),
        ('read','Đọc snapshot đơn, dòng hàng và tiến độ được phép',False),
        ('display','Hiện dữ liệu hoặc lịch sử rỗng; không sửa đơn',False)],
        [('allowed','Từ chối phù hợp; không lộ đơn qua email hoặc mã đoán','[không]')],['UC-09'])
    activity(book,None,'ac31-tour','ACT31 - Tham quan phòng lab 3D và fallback',[
        ('open','Khách mở trải nghiệm phòng lab',False),('webgl','Thiết bị hỗ trợ WebGL?',True),
        ('load','Tải scene và tài nguyên 3D phía client',False),('ready','Tải và khởi tạo scene thành công?',True),
        ('explore','Khám phá xưởng qua các chặng và camera đã cấu hình',False),
        ('exit','Tiếp tục đến sản phẩm hoặc tư vấn; giải phóng scene khi rời',False)],
        [('webgl','Hiện ảnh hoặc nội dung giới thiệu thay thế','[không]'),
         ('ready','Hiện nội dung thay thế và lựa chọn thử lại','[không]')],['DESIGN-3D-TOUR'])
    activity(book,None,'ac32-notify','ACT32 - Gửi thông báo sau commit và xử lý lỗi',[
        ('write','Ghi nghiệp vụ và outbox có khóa chống trùng trong giao dịch',False),
        ('commit','Giao dịch nghiệp vụ commit thành công?',True),
        ('claim','Worker lấy bản ghi đến hạn; claim theo chính sách kênh',False),
        ('send','Gửi đến nhà cung cấp email hoặc Telegram',False),('sent','Nhà cung cấp chấp nhận gửi?',True),
        ('save','Lưu trạng thái SENT và mã phản hồi; không xác nhận tiền',False)],
        [('commit','Rollback nghiệp vụ và outbox; không gửi','[không]'),
         ('sent','Ghi lỗi và lần thử; thử lại hoặc dừng theo chính sách kênh','[không]')],['UC-03','UC-05','UC-08','DESIGN-NOTIFY'])
    sequence(book,None,'sq29-browse','SEQ29 - Tìm lọc catalogue và mở chi tiết',[
        ('actor','Khách'),('ui','Giao diện'),('svc','DichVuCatalogue'),('repo','KhoCatalogue')],[
        ('actor','ui','Mở catalogue hoặc sản phẩm trực tiếp',False),('ui','svc','Yêu cầu catalogue công khai',False),
        ('svc','repo','Đọc sản phẩm và biến thể theo policy công khai',False),('repo','svc','Dữ liệu hoặc lỗi truy xuất',True),
        ('svc','ui','Lỗi; cho phép tải lại',True),('svc','ui','Catalogue hợp lệ',True),
        ('actor','ui','Tìm lọc; chọn sản phẩm hoặc mở theo liên kết',False),
        ('ui','actor','Danh sách rỗng hoặc chi tiết sản phẩm hợp lệ',True)],
        [(4,7,'alt',[(4,'[Đọc catalogue thất bại]'),(5,'[Đọc thành công]')])],['UC-01'])
    sequence(book,None,'sq30-cart','SEQ30 - Thêm sửa xóa giỏ và lưu trình duyệt',[
        ('actor','Khách'),('ui','Giao diện giỏ'),('cart','GioHang'),('store','LuuTruTrinhDuyet')],[
        ('cart','store','Đọc tham chiếu giỏ đã lưu nếu có',False),('store','cart','Dữ liệu hoặc rỗng khi không đọc được',True),
        ('cart','cart','Chuẩn hóa theo catalogue đã đọc',False),('actor','ui','Chọn thêm, đổi lượng hoặc xóa một dòng',False),
        ('ui','cart','Gửi thao tác theo biến thể và số lượng',False),('cart','ui','Dữ liệu sai; giữ giỏ và nêu lỗi',True),
        ('cart','cart','Áp dụng đúng thao tác hợp lệ',False),('cart','store','Thử lưu tham chiếu; không lưu giá làm nguồn chuẩn',False),
        ('store','cart','Đã lưu hoặc bị khóa; giỏ phiên vẫn dùng được',True),('cart','ui','Giỏ mới và tổng tạm tính',True)],
        [(5,9,'alt',[(5,'[Thao tác không hợp lệ]'),(6,'[Thao tác hợp lệ]')])],['UC-02'])
    sequence(book,None,'sq31-tracking','SEQ31 - Kiểm quyền tra cứu đơn và lịch sử',[
        ('actor','Khách'),('ui','Giao diện'),('svc','DichVuDonHang'),('repo','KhoNghiepVu')],[
        ('actor','ui','Mở liên kết đơn hoặc lịch sử tài khoản',False),('ui','svc','Gửi loại truy vấn và token hoặc phiên',False),
        ('svc','repo','Kiểm quyền theo truy vấn; lịch sử chỉ theo phiên',False),('repo','svc','Quyền, chủ đơn và phạm vi dữ liệu',True),
        ('svc','ui','Từ chối hoặc không tìm thấy; không lộ đơn',True),('svc','repo','Đọc chỉ đơn đúng chủ hoặc token hợp lệ',False),
        ('repo','svc','Snapshot và tiến độ hoặc lịch sử rỗng',True),('svc','ui','Trả dữ liệu được phép hiển thị',True)],
        [(4,7,'alt',[(4,'[Không đủ quyền]'),(5,'[Có quyền với loại truy vấn]')])],['UC-09'])
    sequence(book,None,'sq32-tour','SEQ32 - Tải tour 3D và dự phòng WebGL',[
        ('actor','Khách'),('ui','Giao diện'),('scene','BoDieuKhienScene'),('assets','KhoTaiNguyen3D')],[
        ('actor','ui','Mở phòng lab 3D',False),('ui','scene','Khởi tạo phía client và kiểm WebGL',False),
        ('scene','ui','Khả năng hiển thị của thiết bị',True),('ui','actor','Hiện nội dung thay thế khi không hỗ trợ',True),
        ('scene','assets','Tải tài nguyên cho thiết bị hỗ trợ',False),('assets','scene','Lỗi tải hoặc lỗi khởi tạo',True),
        ('scene','ui','Error boundary hiển thị fallback và thử lại',True),
        ('scene','assets','Tải tài nguyên cho thiết bị hỗ trợ',False),('assets','scene','Tài nguyên hợp lệ',True),
        ('actor','scene','Khám phá theo chặng; cập nhật camera',False),('ui','scene','Rời trải nghiệm; giải phóng tài nguyên',False)],
        [(3,10,'alt',[(3,'[Không hỗ trợ WebGL]'),(4,'[Có WebGL nhưng tải hoặc khởi tạo lỗi]'),(7,'[Có WebGL và tải thành công]')])],['DESIGN-3D-TOUR'])
    sequence(book,None,'sq33-notify','SEQ33 - Outbox commit gửi lỗi và retry',[
        ('svc','Dịch vụ nghiệp vụ'),('repo','KhoOutbox'),('worker','Worker thông báo'),('provider','Nhà cung cấp')],[
        ('svc','repo','Ghi nghiệp vụ và outbox trong giao dịch',False),('repo','svc','COMMIT hoặc ROLLBACK',True),
        ('worker','repo','Đọc bản ghi đã commit đến hạn; claim theo kênh',False),('repo','worker','Thông báo và khóa nhận việc',True),
        ('worker','provider','Gửi thông báo qua adapter',False),('provider','worker','Chấp nhận; trả mã phản hồi',True),
        ('worker','repo','Ghi SENT nếu vẫn giữ quyền xử lý',False),('provider','worker','Lỗi hoặc kết quả gửi chưa xác định',True),
        ('worker','repo','Ghi lần thử và retry theo kênh; không đảo nghiệp vụ',False)],
        [(2,8,'opt',[(2,'[Nghiệp vụ đã commit và có bản ghi đến hạn]')]),
         (5,8,'alt',[(5,'[Nhà cung cấp chấp nhận]'),(7,'[Lỗi gửi hoặc timeout]')])],['DESIGN-NOTIFY','UC-03','UC-05','UC-08'])
    class_page(book,None,'cl24-tour','EL24 - Lớp trải nghiệm phòng lab 3D',[
        ('config','CauHinhTour',['- taiNguyen: TaiNguyen3D','- cacChang: ChangThamQuan[]'],['+ layChang(ma: String): ChangThamQuan']),
        ('stop','ChangThamQuan',['- ma: String','- noiDung: String','- camera: ToaDoCamera'],['+ noiSuyCamera(tienDo: Decimal): ToaDoCamera']),
        ('scene','BoDieuKhienScene',['- trangThai: TrangThaiScene'],['+ khoiTao(): void','+ capNhat(tienDo: Decimal): void','+ giaiPhong(): void']),
        ('asset','TaiNguyen3D',['- duongDan: String','- trangThaiTai: TrangThaiTai'],['+ tai(): KetQuaTai','+ huyTai(): void'])],
        [('config','stop','1','1..*','composition'),('scene','config','','','dependency'),('scene','asset','','','dependency')],['DESIGN-3D-TOUR'])
    class_page(book,None,'cl25-cart','EL25 - Lớp giỏ hàng tại trình duyệt',[
        ('cart','GioHang',['- cacDong: DongGio[]'],['+ them(bienThe: UUID, luong: Integer): void','+ doiLuong(bienThe: UUID, luong: Integer): void','+ xoa(bienThe: UUID): void','+ tongTamTinh(): Money']),
        ('line','DongGio',['- maBienThe: UUID','- soLuong: Integer','- thongTinHienThi: SanPham'],['+ hopLe(): Boolean']),
        ('store','LuuTruTrinhDuyet',['- khoaLuu: String'],['+ docThamChieu(): ThamChieuGio[]','+ thuLuu(duLieu: ThamChieuGio[]): Boolean']),
        ('catalog','BoChuanHoaGio',[],['+ khoiPhuc(thamChieu: ThamChieuGio[]): GioHang'])],
        [('cart','line','1','0..*','composition'),('cart','store','','','dependency'),('catalog','cart','','','dependency')],['UC-02'])
    class_page(book,None,'cl26-notify','EL26 - Lớp outbox và gửi thông báo',[
        ('message','ThongBaoOutbox',['- khoaChongTrung: String','- kenh: KenhThongBao','- trangThai: TrangThaiGui','- soLanThu: Integer'],['+ denHan(luc: Instant): Boolean']),
        ('store','KhoOutbox',[],['+ ghiCungNghiepVu(tin: ThongBaoOutbox): void','+ nhanViec(): ThongBaoOutbox[]','+ ghiKetQua(tin: ThongBaoOutbox): void']),
        ('worker','WorkerThongBao',[],['+ xuLyDenHan(): void','+ lapLichThuLai(tin: ThongBaoOutbox): void']),
        ('adapter','CongGuiThongBao',[],['+ gui(tin: ThongBaoOutbox): KetQuaGui'])],
        [('worker','store','','','dependency'),('store','message','','','dependency'),('worker','adapter','','','dependency')],['DESIGN-NOTIFY'])
    class_page(book,None,'erd12-outbox','ERD12 - Outbox email và Telegram',[
        ('order','ORDERS',['PK id: UUID','UQ order_number: String'],[]),
        ('email','EMAIL_OUTBOX',['PK id: UUID','UQ dedup_key: String','FK order_number: String?','status: String','attempts: Integer','retry_after: Instant'],[]),
        ('telegram','TELEGRAM_OUTBOX',['PK id: UUID','UQ dedup_key: String','FK order_number: String','status: String','lease_token: UUID?','lease_until: Instant?'],[])],
        [('order','email','0..1','0..*','assoc'),('order','telegram','1','0..*','assoc')],['DESIGN-NOTIFY'],erd=True)
    book.pages[-1].record['implementation']='CURRENT_SCHEMA_PROJECTION'
    state(book,'st09-telegram','ST09 - Trạng thái gửi Telegram qua outbox',[
        ('pending','PENDING'),('processing','PROCESSING'),('sent','SENT'),('failed','FAILED')],[
        ('pending','processing','worker claim [đến hạn]'),('processing','sent','gửi thành công [lease còn đúng]'),
        ('processing','pending','lỗi [còn lượt thử] / lùi lịch'),('processing','failed','lỗi [hết lượt thử]'),
        ('processing','processing','lease hết / worker nhận lại hợp lệ')],['DESIGN-NOTIFY'])


def enlarge_typography(book):
    """Grow type faster than geometry, and reflow native labels with Arial metrics."""
    scale=1.5
    font_path='/System/Library/Fonts/Supplemental/Arial.ttf'
    sizes={21:42,22:44,23:48,24:52,25:56,32:64}
    fonts={}
    def reflow(value,size,width,preserve=False):
        font=fonts.setdefault(size,ImageFont.truetype(font_path,size))
        paragraphs=value.split('\n') if preserve else [' '.join(value.split())]
        lines=[]
        for paragraph in paragraphs:
            line=''
            for word in paragraph.split():
                candidate=(line+' '+word).strip()
                if line and font.getlength(candidate)>width:
                    lines.append(line);line=word
                else:line=candidate
            lines.append(line)
        return '\n'.join(lines)
    for p in book.pages:
        p.width*=scale;p.height*=scale
        p.model.set('pageWidth',str(p.width));p.model.set('pageHeight',str(p.height))
        cells=list(p.root.findall('mxCell'))
        for c in cells:
            parts=c.get('style','').split(';')
            st=dict(part.split('=',1) for part in parts if '=' in part)
            size=sizes.get(int(st.get('fontSize',24)),52)
            if p.typ in ['Class','ERD']:
                size=52 if c.get('id','').endswith(('-attrs','-ops')) else (64 if 'swimlane' in parts else size)
            if p.typ=='UseCase' and 'ellipse' in parts:size=72
            # Keep all existing notation tokens, replacing only explicit dimensions.
            for key in ['fontSize','labelWidth','startSize','endSize','spacing','spacingLeft','spacingTop']:
                if key not in st:continue
                value=size if key=='fontSize' else float(st[key])*scale
                parts=[part for part in parts if not part.startswith(key+'=')]
                parts.append(f'{key}={value:g}')
            c.set('style',';'.join(parts).strip(';')+';')
            g=c.find('mxGeometry')
            if g is None:continue
            relative=g.get('relative')=='1'
            for key in ['x','y','width','height']:
                if key in g.attrib and not (relative and key=='x'):
                    g.set(key,str(float(g.get(key))*scale))
            for pt in g.findall('.//mxPoint'):
                for key in ['x','y']:
                    if key in pt.attrib:pt.set(key,str(float(pt.get(key))*scale))
            value=c.get('value','')
            if not value:continue
            if c.get('vertex')=='1' and c.get('parent')=='1':
                x,y,w,h=(float(g.get(k,0)) for k in ['x','y','width','height'])
                raw=c.get('style','')
                if 'shape=umlActor' in raw:
                    c.set('value','')
                    label=ET.SubElement(p.root,'mxCell',id=c.get('id')+'-large-label',value=reflow(value,52,470),
                        vertex='1',parent='1',style='text;html=0;whiteSpace=wrap;fontFamily=Arial;fontSize=52;align=center;verticalAlign=top;spacing=0;strokeColor=none;fillColor=none;')
                    ET.SubElement(label,'mxGeometry',x=str(max(0,x+w/2-240)),y=str(y+h+12),width='480',height='140',**{'as':'geometry'})
                    continue
                if c.get('id')=='system':
                    continue
                if c.get('id','').startswith('frame'):
                    preserve=True
                else:preserve=c.get('id','').endswith(('-attrs','-ops')) or '«' in value
                usable=w-45
                if 'ellipse;' in raw:usable=w*.78
                if 'rhombus;' in raw:usable=w*.59
                value=reflow(value,size,usable,preserve)
                c.set('value',value)
                required=len(value.split('\n'))*size*1.18+24
                if 'swimlane;' in raw:
                    required=min(required,float(st.get('startSize',80))*scale)
                if 'rhombus;' in raw:required=required/0.65
                if 'ellipse;' in raw:required=required/0.83
                if required>h and 'swimlane;' not in raw:
                    g.set('height',str(required))
            elif c.get('edge')=='1' and p.typ=='Sequence':
                c.set('value',reflow(value,size,850))
        # Labels now use the reflowed native text; exact goal evidence is captured later.


def write_book(book,output,replace=False):
    if output.resolve()==book.source.resolve():raise ValueError('Refusing to overwrite the user source')
    if output.exists() and not replace:raise FileExistsError(output)
    output.parent.mkdir(parents=True,exist_ok=True)
    original_ids=[p.get('id') for p in book.original.findall('diagram')]
    by_id={p.key:p for p in book.pages}
    assert len(by_id)==len(book.pages),'Duplicate page IDs'
    assert set(original_ids)<=set(by_id),'Every original page must remain present'
    ordered=[by_id[k] for k in original_ids]+[p for p in book.pages if p.key not in original_ids]
    for p in ordered:book.doc.append(p.element)
    ET.indent(book.doc,space='  ')
    ET.ElementTree(book.doc).write(output,encoding='utf-8',xml_declaration=True)
    report=ROOT/'docs/ooad/RA_SOAT_VA_KHUNG_BAO_CAO_THEO_MAU_V10_2026-11-07.md'
    text=report.read_text()
    catalog=text.split('### 6.2 ')[1].split('### 6.3 ')[0]
    ids=re.findall(r'^\| (UC-\d\d(?:\.\d+)?) \|',catalog,re.M)
    coverage={key:[] for key in ids}
    for p in ordered:
        for goal in ids:
            if any(goal==ref or goal.startswith(ref+'.') for ref in p.record['use_cases']):coverage[goal].append(p.key)
    assert all(coverage.values()),[k for k,v in coverage.items() if not v]
    # Exact actor-view cells provide stronger coverage evidence than matching
    # an umbrella UC code on an overview page.
    direct={
        'UC-01.1':('d-uc01','browse'),'UC-01.2':('d-uc01','detail'),
        'UC-02':('uc20-cart','view'),'UC-03.1':('d-uc01','register'),
        'UC-03.2':('uc09-account','verify'),'UC-04.1':('uc09-account','login'),
        'UC-04.2':('uc09-account','logout'),'UC-05':('uc09-account','reset'),
        'UC-06':('d-uc01','checkout'),'UC-07':('d-el02','declare'),
        'UC-08.1':('d-uc03','verify'),'UC-08.2':('d-uc03','reject'),
        'UC-09.1':('d-uc01','track'),'UC-09.2':('d-uc02','history'),
        'UC-10.1':('d-uc03','orders'),'UC-10.2':('d-uc03','coordinate'),
        'UC-10.3':('d-uc03','cancel'),'UC-10.4':('d-uc03','ship'),
        'UC-10.5':('d-uc03','complete'),'UC-11.1':('d-uc01','estimate'),
        'UC-11.2':('d-uc01','advice'),'UC-12.1':('d-uc02','request'),
        'UC-12.2':('d-uc05','queue'),'UC-12.3':('d-uc05','inspect'),
        'UC-12.4':('d-uc05','fix'),'UC-12.5':('d-uc05','issue'),
        'UC-12.6':('d-uc05','revision'),'UC-12.7':('d-uc02','view'),
        'UC-12.8':('d-uc02','accept'),'UC-12.9':('d-uc02','decline'),
        'UC-12.10':('d-uc05','history'),'UC-13.1':('d-uc04','jobs'),
        'UC-13.2':('d-uc04','prepare'),'UC-13.3':('d-uc04','start'),
        'UC-13.4':('d-uc04','finish'),'UC-13.5':('d-uc04','qc'),
        'UC-13.6':('d-uc04','material'),'UC-13.7':('d-uc04','reprint'),
        'UC-13.8':('d-uc06','resources'),'UC-13.9':('d-uc06','review'),
        'UC-13.10':('d-uc06','apply'),'UC-13.11':('d-uc06','reject'),
        'UC-13.12':('d-uc06','quality'),'UC-14':('d-uc03','refund'),
        'UC-15.1':('uc10-product','edit'),'UC-15.2':('uc10-product','publish')}
    assert set(direct)==set(ids)
    direct_evidence={}
    for goal,(pid,cid) in direct.items():
        element=by_id[pid].root.find(f'mxCell[@id="{cid}"]')
        assert element is not None and 'ellipse' in element.get('style','')
        direct_evidence[goal]={'page_id':pid,'cell_id':cid,'label':element.get('value')}
    manifest={'artifact':output.name,'source':str(book.source),'source_sha256':hashlib.sha256(book.source.read_bytes()).hexdigest(),
        'artifact_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'source_page_count':len(original_ids),'page_count':len(ordered),
        'source_page_ids_preserved':original_ids,'style':{'font':'Arial','title_px':64,'usecase_px':72,'actor_px':52,'class_body_px':52,'class_header_px':64,'edge_label_px':'42–44','background':'white','native_shapes':True,'geometry_scale':1.5,'type_grows_faster_than_geometry':True,'class_columns':2},
        'actors':ACTORS,'pages':[p.record for p in ordered],'goal_coverage':coverage,'direct_goal_evidence':direct_evidence,
        'business_rules':['Guest catalogue checkout allowed','Manual VietQR only, no bank webhook',
            'STL estimate is nonbinding','One acceptance one full-quantity order; replay before new-conversion expiry check',
            'Catalogue-only batching, stock first, then BOM shortage, E/G/A disjoint','Human plan approval, revalidate at apply',
            'Operator requests reprint; does not self approve','CRUD operations independent; delete unused drafts only'],
        'design_proposals':['CRUD categories, staff accounts, materials, printers, BOM and profile are requested design extensions, not implemented CRUD.',
            'Logical production tables/FKs, batch-to-job uniqueness, QC allocation and stock movement target are proposals pending DD-02 physical mapping.',
            'Unused draft deletion uses conservative referential preconditions; actual personal-data retention and any real deletion remain governed by DD-03.',
            'Class required child cardinality is a successful aggregate invariant, not a guarantee from a parent FK alone.'],
        'not_implemented_claim':True,'visual_qa':{'status':'PENDING','pages_reviewed':[]}}
    output.with_suffix('.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    return ordered


def write_qa_viewers(pages,directory):
    directory.mkdir(parents=True,exist_ok=True)
    entries=[]
    for i,p in enumerate(pages,1):
        doc=ET.Element('mxfile');doc.append(copy.deepcopy(p.element))
        options={'nav':False,'resize':True,'fit':True,'toolbar':'','xml':ET.tostring(doc,encoding='unicode')}
        content=('<!doctype html><meta charset="utf-8"><title>'+html.escape(p.name)+'</title>'
            '<style>body{margin:0;background:white;font-family:Arial}.mxgraph{width:100%;min-height:700px}</style>'
            '<div class="mxgraph" data-mxgraph="'+html.escape(json.dumps(options,ensure_ascii=False),quote=True)+'"></div>'
            '<script src="https://viewer.diagrams.net/js/viewer-static.min.js"></script>')
        directory.joinpath(f'page-{i:02}.html').write_text(content)
        entries.append(f'<p><a href="page-{i:02}.html">{i:02}. {html.escape(p.name)}</a></p>')
    directory.joinpath('index.html').write_text('<!doctype html><meta charset="utf-8"><title>MinhLab OOAD QA</title>'+''.join(entries))


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,default=DEFAULT_SOURCE)
    parser.add_argument('--output',type=Path,default=DEFAULT_OUTPUT);parser.add_argument('--replace-derived',action='store_true')
    parser.add_argument('--qa-dir',type=Path)
    parser.add_argument('--decompose',action='store_true',help='Append focused straight-line use-case behavior views')
    args=parser.parse_args();book=Book(args.source)
    build_usecases(book);build_static(book);build_erd_details(book);build_activities(book)
    build_sequences(book);build_states(book);build_architecture(book)
    build_public_and_delivery(book)
    if args.decompose:
        from usecase_decomposition import build_decomposition
        build_decomposition(book,ACTORS)
    enlarge_typography(book)
    ordered=write_book(book,args.output,args.replace_derived)
    if args.qa_dir:write_qa_viewers(ordered,args.qa_dir)
    print(json.dumps({'output':str(args.output),'pages':len(ordered),'types':{t:sum(p.typ==t for p in ordered) for t in sorted({p.typ for p in ordered})}},ensure_ascii=False,indent=2))


if __name__=='__main__':main()
