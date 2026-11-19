#!/usr/bin/env python3
"""Build editable draw.io OOAD diagrams using the supplied Lab 5 reference.

Run with the bundled Python runtime. No rendering service or new project dependency
is needed to create the file. All visible elements are native mxGraph cells.
"""
from __future__ import annotations
import argparse, csv, hashlib, heapq, html, json, math, re
import xml.etree.ElementTree as ET
from collections import OrderedDict, defaultdict, deque
from dataclasses import dataclass, field
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OOAD=ROOT/'docs/ooad'
OUTPUT=OOAD/'exports/MinhLab-OOAD.drawio'
QA=Path('/private/tmp/minhlab-drawio-qa')
INK='#202124'; WHITE='#FFFFFF'
STATUS={'CURRENT':'HIỆN TRẠNG','PARTIAL':'TRIỂN KHAI MỘT PHẦN','DESIGNED':'THIẾT KẾ MỞ RỘNG','MIXED':'HIỆN TRẠNG VÀ THIẾT KẾ','ILLUSTRATIVE':'VÍ DỤ MINH HỌA','CONCEPTUAL':'MÔ HÌNH KHÁI NIỆM','DOCUMENTATION':'QUY ƯỚC TÀI LIỆU'}
try:
    from PIL import ImageFont
    def font(size=24,bold=False):
        return ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial'+(' Bold' if bold else '')+'.ttf',size)
    def measure(s,size=24,bold=False): return font(size,bold).getlength(s)
except ImportError:
    def measure(s,size=24,bold=False): return len(s)*size*.55

def clean(s): return s.replace('\\n','\n').strip()
def rich(s): return html.escape(clean(s)).replace('\n','<br>')
def round20(n): return max(20,math.ceil(n/20)*20)
def wrap(s,width,size=24):
    out=[]
    for paragraph in clean(s).split('\n'):
        words=paragraph.split();line=''
        for word in words:
            if line and measure(line+' '+word,size)>width:
                out.append(line);line=word
            else: line=(line+' '+word).strip()
        out.append(line)
    return '\n'.join(out)
def height(s,width,size=24,pad=24): return round20(len(wrap(s,width,size).split('\n'))*size*1.28+pad)

@dataclass
class Node:
    id:str
    label:str
    kind:str='node'
    members:list[str]=field(default_factory=list)
    stereotype:str=''
    group:str=''
    lane:str=''

@dataclass
class Link:
    source:str
    target:str
    label:str=''
    arrow:str='-->'
    left:str=''
    right:str=''

@dataclass
class Model:
    nodes:OrderedDict=field(default_factory=OrderedDict)
    links:list=field(default_factory=list)
    notes:list=field(default_factory=list)
    groups:OrderedDict=field(default_factory=OrderedDict)
    events:list=field(default_factory=list)
    title:str=''
    def node(self,key,label=None,kind='node',**kw):
        if key not in self.nodes:self.nodes[key]=Node(key,clean(label if label is not None else key),kind,**kw)
        return self.nodes[key]

DECL=re.compile(r'^(actor|participant|boundary|control|entity|database|collections|queue|usecase|class|interface|object|component|node|artifact|cloud|package|rectangle|state)\s+(.*)$')
ARROW=re.compile(r'^\s*(\[\*\]|[\w]+)(?:\s+"([^"]*)")?\s+(<\|--|--\|>|<\|\.\.|\.\.\|>|\*--|o--|--\*|--o|<--|--> |-->|->|\.\.>|--|\.\.|<\|-)\s*(?:"([^"]*)"\s+)?(\[\*\]|[\w]+)(?:\s*:\s*(.*))?$')

def parse_decl(rest):
    rest=rest.strip().rstrip('{').strip()
    st=re.search(r'<<([^>]+)>>',rest); stereo=st.group(1) if st else ''
    rest=re.sub(r'<<[^>]+>>','',rest).strip()
    m=re.match(r'"([^"]+)"\s+as\s+(\w+)',rest)
    if m:return m.group(2),m.group(1),stereo
    m=re.match(r'(\w+)\s+as\s+"([^"]+)"',rest)
    if m:return m.group(1),m.group(2),stereo
    if rest.startswith('"'):
        label=rest.split('"')[1];return re.sub(r'\W','_',label),label,stereo
    words=rest.split();key=words[0] if words else 'Group'
    if len(words)>=3 and words[1]=='as':return words[2],key,stereo
    return key,key,stereo

def parse_generic(text):
    m=Model(); stack=[]; active=None; note=None
    for raw in text.splitlines():
        line=raw.strip()
        if note is not None:
            if line=='end note': m.notes.append('\n'.join(note));note=None
            else:note.append(line)
            continue
        if line.startswith('note '):
            if ':' in line:m.notes.append(line.split(':',1)[1].strip())
            else:note=[]
            continue
        if active:
            tail=line.split('}',1)[0].strip()
            if tail:m.nodes[active].members.extend(x.strip() for x in tail.split(';') if x.strip())
            if '}' in line:active=None
            continue
        if not line or line.startswith(('@','skinparam','hide ','left to right','title ','!','\'')):continue
        if line=='}':
            if stack:stack.pop()
            continue
        declaration=DECL.match(line)
        if declaration and not re.match(r'^(?:--|->|\.\.|<|\*)',declaration.group(2).strip()):
            kind,rest=declaration.groups();header,sep,body=rest.partition('{')
            key,label,stereo=parse_decl(header)
            is_group=bool(sep) and kind in {'package','rectangle','node','state'}
            if is_group:
                m.groups[key]={'label':clean(label),'kind':kind,'parent':stack[-1] if stack else ''}
                if kind not in {'rectangle','state'}:m.node(key,label,kind,group=stack[-1] if stack else '')
                stack.append(key)
            else:
                n=m.node(key,label,kind,stereotype=stereo,group=stack[-1] if stack else '')
                if sep:
                    content=body.split('}',1)[0].strip()
                    if content:n.members.append(content)
                    if '}' not in body:active=key
            continue
        if line.startswith('[') and line.endswith(']'):
            label=line[1:-1];key=re.sub(r'\W','_',label)
            m.node(key,label,'component',group=stack[-1] if stack else '');continue
        match=ARROW.match(line)
        if match:
            source,left,arrow,right,target,label=match.groups()
            scope=stack[-1] if stack else ''
            if source=='[*]':source=scope+'__initial';m.node(source,'','start',group=scope)
            if target=='[*]':target=scope+'__final';m.node(target,'','final',group=scope)
            if arrow=='<--':source,target=target,source;left,right=right,left;arrow='-->'
            if scope in m.groups and m.groups[scope]['kind']=='state':
                if not source.endswith('__initial'):
                    original=source;source=scope+'__'+source;m.node(source,original,'state',group=scope)
                if not target.endswith('__final'):
                    original=target;target=scope+'__'+target;m.node(target,original,'state',group=scope)
            m.node(source,kind='node')
            m.node(target,kind='node')
            for k in (source,target):
                if scope and not m.nodes[k].group:m.nodes[k].group=scope
            m.links.append(Link(source,target,clean(label or ''),arrow,left or '',right or ''))
    return m

def parse_erd(text):
    m=Model();active=None
    for raw in text.splitlines():
        line=raw.strip()
        if line.startswith('%%'):
            comment=line[2:].strip()
            if comment:m.notes.append(comment)
            continue
        if active:
            if line=='}':active=None
            elif line:m.nodes[active].members.append(line)
            continue
        ent=re.match(r'(\w+)\s*\{',line)
        if ent:active=ent.group(1);m.node(active,active,'entity');continue
        rel=re.match(r'(\w+)\s+([|o{}\-]+)\s+(\w+)\s*:\s*(.*)',line)
        if rel:
            a,card,b,label=rel.groups();left,right=card.split('--') if '--' in card else (card[:2],card[-2:])
            m.node(a,a,'entity');m.node(b,b,'entity');m.links.append(Link(a,b,label,'--',left,right))
    return m

class Canvas:
    def __init__(self,key,title,status,part=''):
        self.key=key;self.title=title;self.status=status;self.part=part
        self.back=[];self.edges=[];self.front=[];self.labels=[];self.boxes={};self.serial=0;self.ledger=[]
        self.width=1900;self.height=1200
        heading=f'{key}  {title}'+(f' — {part}' if part else '')
        self.text('heading',heading,60,30,2600,70,36,bold=True)
    def uid(self,prefix='cell'):
        self.serial+=1;return f'{prefix}_{self.serial}'
    def shape(self,key,label,x,y,w,h,shape='rect',size=24,bold=False,fill=WHITE,stroke=INK,parent='1',back=False,extra=''):
        style=f'html=1;whiteSpace=wrap;align=center;verticalAlign=middle;fontFamily=Arial;fontSize={size};fontColor={INK};fillColor={fill};strokeColor={stroke};strokeWidth=1.6;spacing=12;'
        if bold:style+='fontStyle=1;'
        style+={'rect':'rounded=0;','ellipse':'ellipse;','diamond':'rhombus;','actor':'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;spacingTop=12;','start':'ellipse;fillColor=#202124;','final':'ellipse;fillColor=#FFFFFF;strokeWidth=2;','action':'rounded=0;','state':'rounded=1;arcSize=16;','note':'shape=note;size=22;align=left;','component':'shape=component;','database':'shape=cylinder3;boundedLbl=1;size=16;','cloud':'ellipse;','package':'shape=folder;tabWidth=100;tabHeight=28;','frame':'rounded=0;fillColor=none;','text':'text;strokeColor=none;fillColor=none;'}.get(shape,'')+extra
        cell=ET.Element('mxCell',{'id':key,'value':rich(wrap(label,w*.56 if shape=='diamond' else w-24,size)),'style':style,'vertex':'1','parent':parent})
        ET.SubElement(cell,'mxGeometry',{'x':str(round(x)),'y':str(round(y)),'width':str(round(w)),'height':str(round(h)),'as':'geometry'})
        (self.back if back else self.front).append(cell)
        if parent=='1':self.boxes[key]=(x,y,w,h,shape)
        if shape=='final':self.shape(key+'_inner','',w*.24,h*.24,w*.52,h*.52,'start',parent=key)
        return key
    def text(self,key,label,x,y,w,h=None,size=22,bold=False,align='left',parent='1'):
        h=h or height(label,w,size)
        return self.shape(key,label,x,y,w,h,'text',size,bold,parent=parent,extra=f'align={align};spacing=0;')
    def edge(self,key,source=None,target=None,label='',arrow='block',dashed=False,points=None,ports=None,start_arrow='none',multiplicity=None,orthogonal=True,back=False):
        hollow=arrow=='blockTriangle';start_hollow=start_arrow=='blockTriangle'
        arrow='block' if hollow else arrow;start_arrow='block' if start_hollow else start_arrow
        label_width=max(90,min(360,round(measure(max(label.split('\n'),key=len,default=''),21)+28)))
        er_end=arrow.startswith('ER');er_start=start_arrow.startswith('ER')
        style=f'edgeStyle={"orthogonalEdgeStyle" if orthogonal else "none"};rounded=0;html=1;curved=0;strokeColor={INK};strokeWidth=1.6;endArrow={arrow};endFill={0 if arrow=="open" or hollow or er_end else 1};startArrow={start_arrow};startFill={0 if start_hollow or er_start else 1};endSize=12;startSize=14;fontFamily=Arial;fontSize=21;fontColor={INK};labelBackgroundColor=#FFFFFF;whiteSpace=wrap;'
        if label:style+=f'labelWidth={label_width};'
        if dashed:style+='dashed=1;dashPattern=7 5;'
        if ports:style+='exitX=%s;exitY=%s;exitPerimeter=1;entryX=%s;entryY=%s;entryPerimeter=1;'%tuple(ports)
        attrs={'id':key,'value':rich(label),'style':style,'edge':'1','parent':'1'}
        if source:attrs['source']=source
        if target:attrs['target']=target
        cell=ET.Element('mxCell',attrs);g=ET.SubElement(cell,'mxGeometry',{'relative':'1','as':'geometry'})
        if points:
            if source is None:ET.SubElement(g,'mxPoint',{'x':str(points[0][0]),'y':str(points[0][1]),'as':'sourcePoint'})
            if target is None:ET.SubElement(g,'mxPoint',{'x':str(points[-1][0]),'y':str(points[-1][1]),'as':'targetPoint'})
            interior=points[1:-1] if source is None and target is None else points
            if interior:
                arr=ET.SubElement(g,'Array',{'as':'points'})
                for x,y in interior:ET.SubElement(arr,'mxPoint',{'x':str(x),'y':str(y)})
        self.edges.append(cell)
        if multiplicity:
            for end,value in enumerate(multiplicity):
                if not value:continue
                child=ET.Element('mxCell',{'id':key+('_m1' if end==0 else '_m2'),'value':rich(value),'style':f'edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0;points=[];fontFamily=Arial;fontSize=22;labelBackgroundColor=#FFFFFF;','vertex':'1','connectable':'0','parent':key})
                gg=ET.SubElement(child,'mxGeometry',{'x':'-0.76' if end==0 else '0.76','y':'-20','relative':'1','as':'geometry'});ET.SubElement(gg,'mxPoint',{'x':'0','y':'0','as':'offset'});self.labels.append(child)
        return key
    def classbox(self,n,x,y,w=440):
        head=('«'+n.stereotype+'»\n' if n.stereotype else ('«interface»\n' if n.kind=='interface' else ''))+n.label
        if n.kind=='object':head=n.label
        header_h=height(head,w-56,24,32)
        fields=[v for v in n.members if n.kind=='object' or '(' not in v or '=' in v];methods=[v for v in n.members if n.kind!='object' and '(' in v and '=' not in v]
        fieldtext='\n'.join(fields); methodtext='\n'.join(methods)
        fh=height(fieldtext,w-56,22,36) if fields else (50 if methods else 0)
        mh=height(methodtext,w-56,22,36) if methods else 0
        total=header_h+fh+mh
        self.shape(n.id,'',x,y,w,total,'rect')
        self.text(n.id+'_title',head,14,4,w-28,header_h-8,24,True,'center',n.id)
        if n.kind=='object':
            self.front[-1].set('style',self.front[-1].get('style')+'fontStyle=4;')
        for suffix,txt,yy,hh in [('attrs',fieldtext,header_h,fh),('methods',methodtext,header_h+fh,mh)]:
            if hh:
                self.shape(n.id+'_'+suffix+'_comp','',0,yy,w,hh,'rect',parent=n.id,extra='fillColor=none;')
                self.text(n.id+'_'+suffix,txt,16,yy+10,w-32,hh-20,22,False,'left',n.id)
        return total
    def notes(self,notes,y,width=None):
        # Explanatory notes, legends, and status annotations belong in the
        # accompanying OOAD documentation, not inside the submitted diagrams.
        return
    def finish(self):
        bounds=[b for k,b in self.boxes.items() if k!='heading']
        if bounds:
            self.width=max(self.width,max(x+w for x,y,w,h,s in bounds)+60)
            self.height=max(self.height,max(y+h for x,y,w,h,s in bounds)+80)
        self.width=round20(self.width);self.height=round20(self.height)
        page=ET.Element('diagram',{'id':hashlib.sha256((self.key+self.part).encode()).hexdigest()[:16],'name':self.key+' '+self.title+(' · '+self.part if self.part else '')})
        model=ET.SubElement(page,'mxGraphModel',{'dx':str(self.width),'dy':str(self.height),'grid':'1','gridSize':'10','guides':'1','tooltips':'1','connect':'1','arrows':'1','fold':'1','page':'1','pageScale':'1','pageWidth':str(self.width),'pageHeight':str(self.height),'math':'0','shadow':'0','background':WHITE})
        rt=ET.SubElement(model,'root');ET.SubElement(rt,'mxCell',{'id':'0'});ET.SubElement(rt,'mxCell',{'id':'1','parent':'0'})
        for cell in self.back+self.edges+self.front+self.labels:
            if cell.get('id')=='heading':cell.find('mxGeometry').set('width',str(self.width-120))
            rt.append(cell)
        return page

class Router:
    """Orthogonal grid routing around native node rectangles, with shared-edge cost."""
    def __init__(self,c,excluded=()):
        self.c=c;self.used=defaultdict(int);self.blocks=[]
        for key,(x,y,w,h,kind) in c.boxes.items():
            if key in excluded or kind in {'text','frame','note'}:continue
            self.blocks.append((x-20,y-20,x+w+20,y+h+20))
    def blocked(self,p):
        x,y=p;return any(a<x<b and d<y<e for a,d,b,e in self.blocks)
    def route(self,a,b):
        ax,ay,aw,ah,_=self.c.boxes[a];bx,by,bw,bh,_=self.c.boxes[b]
        ac=(ax+aw/2,ay+ah/2);bc=(bx+bw/2,by+bh/2)
        dx,dy=bc[0]-ac[0],bc[1]-ac[1]
        if a==b:
            return [(ax+aw,ay+ah*.3),(ax+aw+80,ay+ah*.3),(ax+aw+80,ay+ah*.7),(ax+aw,ay+ah*.7)],(1,.3,1,.7)
        if abs(dx)>abs(dy)*.7:
            if dx>0:s=(ax+aw,round(ac[1]/20)*20);t=(bx,round(bc[1]/20)*20);start=(s[0]+40,s[1]);end=(t[0]-40,t[1]);ports=(1,(s[1]-ay)/ah,0,(t[1]-by)/bh)
            else:s=(ax,round(ac[1]/20)*20);t=(bx+bw,round(bc[1]/20)*20);start=(s[0]-40,s[1]);end=(t[0]+40,t[1]);ports=(0,(s[1]-ay)/ah,1,(t[1]-by)/bh)
        else:
            if dy>0:s=(round(ac[0]/20)*20,ay+ah);t=(round(bc[0]/20)*20,by);start=(s[0],s[1]+40);end=(t[0],t[1]-40);ports=((s[0]-ax)/aw,1,(t[0]-bx)/bw,0)
            else:s=(round(ac[0]/20)*20,ay);t=(round(bc[0]/20)*20,by+bh);start=(s[0],s[1]-40);end=(t[0],t[1]+40);ports=((s[0]-ax)/aw,0,(t[0]-bx)/bw,1)
        start=tuple(round(v/20)*20 for v in start);end=tuple(round(v/20)*20 for v in end)
        limitx=max(2400,max(x+w for x,y,w,h,k in self.c.boxes.values())+240);limity=max(1600,max(y+h for x,y,w,h,k in self.c.boxes.values())+240)
        q=[(0,0,start,None)];cost={(start,None):0};prev={};finish=None;seen=0
        while q and seen<60000:
            _,g,pos,direction=heapq.heappop(q);state=(pos,direction);seen+=1
            if pos==end:finish=state;break
            for dd,(xx,yy) in enumerate(((20,0),(-20,0),(0,20),(0,-20))):
                nxt=(pos[0]+xx,pos[1]+yy)
                if nxt!=end and (nxt[0]<30 or nxt[1]<170 or nxt[0]>limitx or nxt[1]>limity or self.blocked(nxt)):continue
                ng=g+20+(14 if direction is not None and direction!=dd else 0)+self.used[nxt]*16
                ns=(nxt,dd)
                if ng<cost.get(ns,1e12):
                    cost[ns]=ng;prev[ns]=state;hh=abs(nxt[0]-end[0])+abs(nxt[1]-end[1]);heapq.heappush(q,(ng+hh,ng,nxt,dd))
        if finish:
            path=[]
            while finish in prev:path.append(finish[0]);finish=prev[finish]
            path.append(start);path.reverse()
        else:path=[start,(start[0],end[1]),end]
        for p in path:self.used[p]+=1
        full=[s]+path+[t];out=[full[0]]
        for i in range(1,len(full)-1):
            p,cur,nxt=out[-1],full[i],full[i+1]
            if (p[0]==cur[0]==nxt[0]) or (p[1]==cur[1]==nxt[1]):continue
            out.append(cur)
        out.append(full[-1]);return out,ports

def relation(c,router,link,index,prefix='R',showlabel=True):
    points,ports=router.route(link.source,link.target)
    arrow='none';start='none';dashed='.' in link.arrow
    if link.arrow in {'-->','->','..>'}:arrow='open'
    if link.arrow in {'<|--','<|..','<|-'}:start='blockTriangle'
    if link.arrow in {'--|>','..|>'}:arrow='blockTriangle'
    if link.arrow=='*--':start='diamond'
    if link.arrow=='o--':start='diamondThin'
    if link.arrow=='--*':arrow='diamond'
    if link.arrow=='--o':arrow='diamondThin'
    label=link.label if showlabel else ''
    c.edge(f'link_{index}',link.source,link.target,label,arrow,dashed,points[1:-1],ports,start,(link.left,link.right))

def ledger(c,rows,y,title='Chi tiết quan hệ và điều kiện'):
    if not rows:return y
    c.text(c.uid('ledger_title'),title,60,y,c.width-120,50,26,True);y+=70
    for row in rows:
        h=height(row,c.width-160,22,20);c.text(c.uid('ledger'),row,80,y,c.width-160,h,22);y+=h+16
    return y+30

def usecase_pages(m,row):
    c=Canvas(row['ID'],row['Name'],row['Status'])
    actors=[n for n in m.nodes.values() if n.kind=='actor'];cases=[n for n in m.nodes.values() if n.kind=='usecase'];external=[n for n in cases if n.stereotype=='external_manual'];cases=[n for n in cases if n not in external]
    human_left=[];human_right=[]
    for n in actors:
        if n.id.lower() in {'guest','customer','visitor','user'} or 'customer' in n.label.lower() or n.label.lower().startswith(('khách','người dùng','chủ tài khoản')):human_left.append(n)
        else:human_right.append(n)
    if not human_left and human_right:human_left.append(human_right.pop(0))
    leftids={n.id for n in human_left};rightids={n.id for n in human_right}
    cols=[[],[]]
    for n in cases:
        linked={l.source for l in m.links if l.target==n.id}|{l.target for l in m.links if l.source==n.id}
        if linked&rightids and not linked&leftids:cols[1].append(n)
        elif linked&leftids:cols[0].append(n)
        else:cols[min(range(2),key=lambda j:len(cols[j]))].append(n)
    if not cols[1] and len(cols[0])>5:cols=[cols[0][::2],cols[0][1::2]]
    rows=max(len(cols[0]),len(cols[1]),4);bh=rows*200+160
    c.width=2180;c.height=bh+360
    c.shape('system_boundary','',340,180,1480,bh,'frame',back=True)
    boundary=next((g['label'] for g in m.groups.values() if g['kind']=='rectangle'),'Hệ thống MinhLab 3D')
    c.text('boundary_title',boundary,380,200,1400,60,26,True)
    for col,items in enumerate(cols):
        for i,n in enumerate(items):
            h=max(120,height(n.label,460,26,36))
            c.shape(n.id,n.label,400+col*780,300+i*200,500,h,'ellipse',26)
    actor_labels={'Guest':'Khách vãng lai','Visitor':'Khách truy cập','Account owner':'Chủ tài khoản','Email provider':'Dịch vụ email','CUSTOMER':'Khách hàng\n«CUSTOMER»','STAFF':'Nhân viên\n«STAFF»','ADMIN':'Quản trị viên\n«ADMIN»','PRINT_OPERATOR':'Thợ vận hành\n«PRINT_OPERATOR»','FILE_REVIEWER':'Nhân viên duyệt tệp\n«FILE_REVIEWER»','Customer':'Khách hàng','CUSTOMER chủ đơn':'Khách hàng là chủ đơn\n«CUSTOMER»','Khách hàng là chủ đơn «CUSTOMER»':'Khách hàng là chủ đơn\n«CUSTOMER»','User':'Người dùng','Viewer':'Người xem'}
    for side,items in enumerate([human_left,human_right]):
        for i,n in enumerate(items):
            x=100 if side==0 else 1940;y=300+(bh-260)*(i+.45)/max(1,len(items))
            y=round20(y)
            c.shape(n.id,'',x,y,80,100,'actor')
            c.text(n.id+'_label',actor_labels.get(n.label,n.label),x-80,y+110,240,100,24,align='center')
    for i,n in enumerate(external):
        c.text('outside_label','Thao tác ngoài ranh giới website',400,180+bh+40,1300,50,26,True)
        c.shape(n.id,'«external_manual»\n'+n.label,780,180+bh+110+i*220,700,160,'ellipse',26)
    router=Router(c,excluded=('system_boundary',))
    for i,l in enumerate(m.links,1):
        if l.source not in c.boxes or l.target not in c.boxes:continue
        p,ports=router.route(l.source,l.target)
        assoc=l.source in leftids|rightids or l.target in leftids|rightids
        label=l.label.replace('<<','«').replace('>>','»')
        arrow='none' if assoc else 'blockTriangle' if l.arrow=='--|>' else 'open'
        same_side=assoc and ((l.source in leftids and c.boxes[l.target][0]<1000) or (l.source in rightids and c.boxes[l.target][0]>1000 and l.target not in {n.id for n in external}))
        c.edge(f'uc_edge_{i}',l.source,l.target,label,arrow,not assoc and '.' in l.arrow,None if same_side else p[1:-1],ports)
    c.notes(m.notes,180+bh+40+(330 if external else 0),c.width-120)
    return [c]

def parse_activity(text):
    m=Model();lane='Hệ thống';front=[];stack=[];note=None;buffer=''
    def add(label,kind='action'):
        key=f'a{len(m.nodes)+1:03d}';n=m.node(key,label,kind,lane=lane)
        return key
    def connect(key):
        nonlocal front
        for source,label in front:m.links.append(Link(source,key,label))
        front=[(key,'')]
    lines=[]
    for raw in text.splitlines():
        line=raw.strip()
        if buffer:
            buffer+=' '+line
            if line.endswith(';'):lines.append(buffer);buffer=''
        elif line.startswith(':') and not line.endswith(';'):buffer=line
        else:lines.append(line)
    for line in lines:
        if note is not None:
            if line=='end note':m.notes.append('\n'.join(note));note=None
            else:note.append(line)
            continue
        if line.startswith('note '):note=[];continue
        if line.startswith('|') and line.endswith('|'):lane=line.strip('|');continue
        if line=='start':connect(add('','start'));continue
        if line=='stop':connect(add('','final'));front=[];continue
        mt=re.match(r'if\s*\((.*)\)\s*then\s*\((.*)\)',line)
        if mt:
            condition,yes=mt.groups();key=add(condition,'decision');connect(key)
            stack.append({'key':key,'yes':yes,'then':None,'lane':lane});front=[(key,yes)];continue
        if line.startswith('else'):
            ctx=stack[-1];ctx['then']=front
            mt=re.search(r'else\s*\((.*?)\)',line);front=[(ctx['key'],mt.group(1) if mt else 'không')];continue
        if line=='endif':
            ctx=stack.pop()
            candidates=(ctx['then']+front) if ctx['then'] is not None else front+[(ctx['key'],'không')]
            if len(candidates)>1:
                save=lane;lane=ctx['lane'];key=add('','merge');lane=save
                for a,lab in candidates:m.links.append(Link(a,key,lab))
                front=[(key,'')]
            else:front=candidates
            continue
        if line.startswith(':') and line.endswith(';'):connect(add(line[1:-1]))
    if stack:raise ValueError('Unclosed activity if')
    return m

def activity_pages(m,row):
    keys=list(m.nodes);chunks=[keys];parts={k:0 for k in keys};out=[]
    all_lanes=list(dict.fromkeys(n.lane for n in m.nodes.values()))
    for part,chunk in enumerate(chunks):
        partname=f'{part+1}/{len(chunks)}' if len(chunks)>1 else ''
        c=Canvas(row['ID'],row['Name'],row['Status'],partname)
        lanes=[lane for lane in all_lanes if any(m.nodes[k].lane==lane for k in chunk)]
        c.width=max(1600,len(lanes)*600+120)
        local={k for k in chunk};incoming=[l for l in m.links if l.target in local and l.source not in local];outgoing=[l for l in m.links if l.source in local and l.target not in local]
        incount=defaultdict(int)
        for l in incoming:incount[m.nodes[l.target].lane]+=1
        top=300+max(incount.values(),default=0)*120
        bodyh=len(chunk)*220+max(1,len(outgoing))*120+220
        for j,lane in enumerate(lanes):
            x=60+j*600
            c.shape(f'lane_{j}','',x,190,580,top+bodyh-190,'frame',back=True)
            c.shape(f'lane_head_{j}',lane,x,190,580,90,'rect',26,True,fill=WHITE,back=True)
        for i,key in enumerate(chunk):
            n=m.nodes[key];j=lanes.index(n.lane);x=60+j*600+290;y=top+i*220
            kind={'decision':'diamond','merge':'diamond','start':'start','final':'final'}.get(n.kind,'action')
            w,h=(60,60) if n.kind in {'start','final','merge'} else (420,200) if n.kind=='decision' else (440,max(100,height(n.label,400,24,28)))
            c.shape(key,n.label,x-w/2,y,w,h,kind,24)
        markerkeys=[];inpositions=defaultdict(int)
        for i,l in enumerate(incoming):
            key=f'in_{i}';markerkeys.append(key);j=lanes.index(m.nodes[l.target].lane);x=60+j*600+80
            label=f'Từ {row["ID"]} · {parts[l.source]+1}/{len(chunks)}\n{l.source} → {l.target}'+(f' [{l.label}]' if l.label else '')
            yy=290+inpositions[m.nodes[l.target].lane]*120;inpositions[m.nodes[l.target].lane]+=1
            c.shape(key,label,x,yy,420,90,'rect',22,extra='dashed=1;')
        bottom=top+len(chunk)*240+20
        for i,l in enumerate(outgoing):
            key=f'out_{i}';markerkeys.append(key);j=lanes.index(m.nodes[l.source].lane);x=60+j*600+80
            label=f'Tiếp {row["ID"]} · {parts[l.target]+1}/{len(chunks)}\n{l.source} → {l.target}'+(f' [{l.label}]' if l.label else '')
            c.shape(key,label,x,bottom+i*110,420,90,'rect',22,extra='dashed=1;')
        router=Router(c,excluded=[k for k in c.boxes if k.startswith('lane_')])
        for i,l in enumerate(m.links):
            if l.source in local and l.target in local:
                p,ports=router.route(l.source,l.target);c.edge(f'flow_{i}',l.source,l.target,'['+l.label+']' if l.label else '','block',points=p[1:-1],ports=ports)
        for i,l in enumerate(outgoing):
            p,ports=router.route(l.source,f'out_{i}');c.edge(f'exit_{i}',l.source,f'out_{i}','['+l.label+']' if l.label else '','block',points=p[1:-1],ports=ports)
        for i,l in enumerate(incoming):
            p,ports=router.route(f'in_{i}',l.target);c.edge(c.uid('continuation'),f'in_{i}',l.target,'','block',points=p[1:-1],ports=ports)
        end=top+bodyh+60
        if part==len(chunks)-1:c.notes(m.notes,end,c.width-120)
        c.height=end+160;out.append(c)
    return out

def parse_sequence(text):
    m=parse_generic(text);m.links=[];m.events=[];note=None
    for raw in text.splitlines():
        line=raw.strip()
        if note is not None:
            if line=='end note':note=None
            continue
        if line.startswith('note '):note=[];continue
        mm=re.match(r'(\w+)\s*(-->>|->>|-->|->)\s*(\w+)\s*:\s*(.*)',line)
        if mm:
            a,arrow,b,label=mm.groups();m.events.append({'type':'message','source':a,'target':b,'arrow':arrow,'label':clean(label)});continue
        mm=re.match(r'(alt|opt|loop|group|else)\b\s*(.*)',line)
        if mm:m.events.append({'type':mm.group(1),'label':clean(mm.group(2))});continue
        if line=='end':m.events.append({'type':'end'});continue
        mm=re.match(r'ref\s+over\s+[^:]+:\s*(.*)',line)
        if mm:m.events.append({'type':'ref','label':mm.group(1)})
    return m

def sequence_pages(m,row,max_messages=12):
    chunks=[];chunk=[];count=0
    for event in m.events:
        if event['type']=='message' and count>=max_messages:
            chunks.append(chunk);chunk=[];count=0
        chunk.append(event)
        if event['type']=='message':count+=1
    if chunk:chunks.append(chunk)
    people=[n for n in m.nodes.values() if n.kind in {'actor','participant','boundary','control','entity','database','collections','queue','node'}]
    used={e[a] for e in m.events if e['type']=='message' for a in ('source','target')}
    people=[n for n in people if n.id in used];active=[];out=[];message_number=0
    for part,events in enumerate(chunks):
        c=Canvas(row['ID'],row['Name'],row['Status'],f'{part+1}/{len(chunks)}' if len(chunks)>1 else '')
        gap=320;left=100;c.width=max(1900,len(people)*gap+200);centers={n.id:left+150+i*gap for i,n in enumerate(people)}
        for i,n in enumerate(people):
            stereotype='«'+n.kind+'»\n' if n.kind not in {'participant','actor','node'} else ''
            c.shape(n.id,stereotype+n.label,left+i*gap,190,300,140,'rect',24,True)
        y=400;frames=[]
        def openframe(event,continued=False):
            nonlocal y
            depth=len(frames);x=70+depth*20;y0=y-30
            guard=(event['label']+' · tiếp trang trước') if continued else event['label']
            c.text(c.uid('frame_guard'),event['type']+'  ['+guard+']',x+20,y0+8,c.width-x*2-40,height(guard,c.width-x*2-100,22,18),22,True)
            frames.append({'event':dict(event),'y':y0,'x':x,'id':c.uid('fragment')});y+=max(90,height(guard,c.width-300,22,30))
        for event in active:openframe(event,True)
        for event in events:
            typ=event['type']
            if typ in {'alt','opt','loop','group'}:openframe(event);active.append(dict(event));continue
            if typ=='else':
                c.edge(c.uid('branch'),points=[(frames[-1]['x'],y),(c.width-frames[-1]['x'],y)],arrow='none',dashed=True)
                c.text(c.uid('else_guard'),'['+event['label']+']',frames[-1]['x']+20,y+12,c.width-200,height(event['label'],c.width-240,22),22,True)
                y+=max(90,height(event['label'],c.width-260,22,40))
                active[-1]['label']=event['label'];continue
            if typ=='end':
                if frames:
                    frame=frames.pop();c.shape(frame['id'],'',frame['x'],frame['y'],c.width-frame['x']*2,y-frame['y']+15,'frame',back=True)
                if active:active.pop()
                y+=50;continue
            if typ=='ref':
                hh=height('ref  '+event['label'],c.width-220,24,36);c.shape(c.uid('ref'),'ref  '+event['label'],100,y,c.width-200,hh,'rect',24);y+=hh+50;continue
            if typ=='message':
                message_number+=1;x1=centers[event['source']];x2=centers[event['target']]
                msg=f'{message_number:02d}  '+event['label']
                maxw=min(900,max(280,abs(x2-x1)-30));lab=wrap(msg,maxw-24,22);hh=height(lab,maxw-24,22,30)
                y+=hh+26
                if x1==x2:
                    yy=y;c.edge(c.uid('message'),points=[(x1,yy),(x1+150,yy),(x1+150,yy+36),(x1,yy+36)],arrow='open' if event['arrow'].startswith('--') else 'block',dashed=event['arrow'].startswith('--'))
                    c.text(c.uid('message_text'),lab,x1+28,yy-hh-16,maxw,hh,22);y+=72
                else:
                    c.edge(c.uid('message'),points=[(x1,y),(x2,y)],arrow='open' if event['arrow'].startswith('--') else 'block',dashed=event['arrow'].startswith('--'))
                    c.text(c.uid('message_text'),lab,min(x1,x2)+14,y-hh-14,maxw,hh,22);y+=62
        for frame in reversed(frames):c.shape(frame['id'],'',frame['x'],frame['y'],c.width-frame['x']*2,y-frame['y']+10,'frame',back=True)
        for n in people:c.edge('lifeline_'+n.id,points=[(centers[n.id],330),(centers[n.id],y+20)],arrow='none',dashed=True)
        if part<len(chunks)-1:y+=80
        else:c.notes(m.notes,y+70,c.width-120)
        c.height=max(1200,y+160);out.append(c)
    return out

def class_pages(m,row):
    c=Canvas(row['ID'],row['Name'],row['Status'])
    nodes=[n for n in m.nodes.values() if n.kind in {'class','interface','object','node'}]
    colw=820;cols=3 if len(nodes)>6 else 2;y=240
    for offset in range(0,len(nodes),cols):
        hh=[]
        for j,n in enumerate(nodes[offset:offset+cols]):
            w=720 if any(len(v)>65 for v in n.members) else 560
            hh.append(c.classbox(n,80+j*colw,y,w))
        y+=max(hh,default=100)+260
    c.width=max(1900,cols*colw+80)
    router=Router(c)
    for i,l in enumerate(m.links,1):
        if l.source in c.boxes and l.target in c.boxes:relation(c,router,l,i)
    y=ledger(c,c.ledger,y);c.notes(m.notes,y,c.width-120)
    c.height=max(c.height,y+80);return [c]

def state_pages(m,row):
    groups=[g for g in m.groups if m.groups[g]['kind']=='state'] or ['']
    pages=[]
    for j,group in enumerate(groups):
        nodes=[n for n in m.nodes.values() if n.group==group and n.kind not in {'package','rectangle'}]
        if not nodes:continue
        c=Canvas(row['ID'],row['Name'],row['Status'],m.groups[group]['label'] if group else '')
        c.width=2180;cols=3;y=250
        for i,n in enumerate(nodes):
            x=100+(i%cols)*680;yy=y+(i//cols)*260
            if n.kind in {'start','final'}:c.shape(n.id,'',x+190,yy+30,60,60,n.kind)
            else:c.shape(n.id,n.label,x,yy,440,140,'diamond' if n.stereotype=='choice' else 'state',26)
        router=Router(c)
        links=[l for l in m.links if l.source in c.boxes and l.target in c.boxes]
        for i,l in enumerate(links,1):
            p,ports=router.route(l.source,l.target)
            c.edge('transition_'+str(i),l.source,l.target,l.label,'block',points=p[1:-1],ports=ports)
        end=y+math.ceil(len(nodes)/cols)*260+80
        c.notes(m.notes,end,c.width-120);c.height=end+80;pages.append(c)
    return pages

def graph_pages(m,row):
    c=Canvas(row['ID'],row['Name'],row['Status'])
    # Package contents stay within their package rather than becoming orphan nodes.
    packages={n.id for n in m.nodes.values() if n.kind=='package'}
    children=defaultdict(list)
    for n in m.nodes.values():
        if n.group in packages:children[n.group].append(n)
    nodes=[n for n in m.nodes.values() if n.group not in packages]
    cols=3 if len(nodes)>8 else 2;cw=720;y=240
    for offset in range(0,len(nodes),cols):
        hh=[]
        for j,n in enumerate(nodes[offset:offset+cols]):
            x=80+j*cw;label=n.label
            if n.kind=='actor':
                c.shape(n.id,'',x+220,y,80,110,'actor')
                c.text(n.id+'_actor_label',n.label,x,y+125,540,80,24,align='center');hh.append(220);continue
            if n.kind=='package':
                label+='\n\n'+'\n'.join(ch.label for ch in children[n.id]);kind='package'
            else:
                kind={'database':'database','component':'component','cloud':'cloud','actor':'actor','artifact':'rect'}.get(n.kind,'rect')
                if n.kind=='object':label='«object»\n'+label
            h=max(120,height(label,500,24,50));c.shape(n.id,label,x,y,540,h,kind,24,True);hh.append(h)
        y+=max(hh,default=100)+260
    c.width=max(1900,cols*cw+100);router=Router(c)
    for i,l in enumerate(m.links,1):
        if l.source in c.boxes and l.target in c.boxes:relation(c,router,l,i)
    y=ledger(c,c.ledger,y);c.notes(m.notes,y,c.width-120);c.height=y+100;return [c]

def deployment_pages(m,row):
    c=Canvas(row['ID'],row['Name'],row['Status'])
    groups=[(k,g) for k,g in m.groups.items() if g['kind']=='node' and not g['parent']]
    placed=set();x=60;outer_ids=[];bottom=0
    for key,g in groups:
        children=[n for n in m.nodes.values() if n.group==key]
        w=900;h=200+len(children)*260
        c.shape(key,'',x,210,w,h,'frame',back=True,extra='strokeWidth=2;');outer_ids.append(key)
        c.text(key+'_caption','«node»  '+g['label'],x+30,230,w-60,90,26,True);placed.add(key)
        y=360
        for n in children:
            shape={'artifact':'rect','database':'database','node':'rect'}.get(n.kind,'rect')
            label=('«executionEnvironment»\n' if n.kind=='node' else '«artifact»\n' if n.kind=='artifact' else '')+n.label
            c.shape(n.id,label,x+120,y,660,160,shape,24);y+=260;placed.add(n.id)
        bottom=max(bottom,210+h);x+=1040
    other=[n for n in m.nodes.values() if n.id not in placed]
    if other:
        for i,n in enumerate(other):
            kind={'database':'database','cloud':'cloud','artifact':'note'}.get(n.kind,'rect')
            c.shape(n.id,n.label,x+80,260+i*280,620,160,kind,24);placed.add(n.id)
        x+=860;bottom=max(bottom,260+len(other)*280)
    c.width=max(1900,x);router=Router(c,outer_ids)
    for i,l in enumerate(m.links,1):
        if l.source in c.boxes and l.target in c.boxes:relation(c,router,l,i)
    end=ledger(c,c.ledger,bottom+100);c.notes(m.notes,end,c.width-120);c.height=end+100
    return [c]

def communication_pages(m,row):
    c=Canvas(row['ID'],row['Name'],row['Status']);c.width=2380
    nodes=list(m.nodes.values())
    positions={'Staff':(80,600),'UI':(480,300),'API':(1080,300),'Auth':(1680,300),'Service':(1080,860),'DB':(1680,860),'Outbox':(480,860)}
    for i,n in enumerate(nodes):
        x,y=positions.get(n.id,(80+(i%3)*700,300+(i//3)*500))
        if n.kind=='actor':
            c.shape(n.id,'',x+160,y,80,110,'actor');c.text(n.id+'_actor_label',n.label,x,y+125,420,80,24,align='center')
        else:c.shape(n.id,n.label,x,y,420,120,'rect',26,extra='fontStyle=4;')
    grouped=OrderedDict()
    for l in m.links:
        key=(l.source,l.target);grouped.setdefault(key,[]).append(l.label)
    router=Router(c)
    for i,((a,b),numbers) in enumerate(grouped.items()):
        p,ports=router.route(a,b);c.edge(f'comm_{i}',a,b,'\n'.join(numbers),'open',points=p[1:-1],ports=ports)
    c.height=1500;return [c]

def interaction_pages(m,row):
    c=Canvas(row['ID'],row['Name'],row['Status']);c.width=2100
    specs=[('start','',1000,220,60,60,'start'),('checkout','D23\nĐặt đơn VietQR',780,360,500,130,'rect'),('choice','Phân loại\nđơn hàng?',860,620,340,180,'diamond'),('declare','D24\nKhai báo chuyển khoản',180,980,540,140,'rect'),('reconcile','D25\nĐối soát thanh toán',180,1320,540,140,'rect'),('cod','Xử lý đơn COD lịch sử\nvà bắt đầu sản xuất',1300,980,600,160,'action'),('merge','',1000,1680,60,60,'diamond'),('advance','D27\nChuyển trạng thái đơn',730,1880,620,160,'rect'),('handoff','Nhân viên bàn giao kiện hàng\nvà xác nhận giao thực tế',730,2220,620,160,'action'),('track','Trả trạng thái đơn cho khách',730,2560,620,140,'action'),('end','',1000,2840,60,60,'final')]
    for key,label,x,y,w,h,kind in specs:c.shape(key,label,x,y,w,h,kind,26)
    links=[('start','checkout',''),('checkout','choice',''),('choice','declare','[Đơn VietQR]'),('declare','reconcile',''),('reconcile','merge',''),('choice','cod','[Đơn COD cũ]'),('cod','merge',''),('merge','advance',''),('advance','handoff',''),('handoff','track',''),('track','end','')]
    router=Router(c)
    for i,(a,b,label) in enumerate(links):
        p,ports=router.route(a,b);c.edge(f'overview_{i}',a,b,label,'block',points=p[1:-1],ports=ports)
    c.height=3300;return [c]

def timing_pages(text,row):
    c=Canvas(row['ID'],row['Name'],row['Status']);c.width=2320;c.height=1500
    xs=[520,1040,1560,2080];labels=['0','30 phút','12 giờ','90 ngày']
    for x,label in zip(xs,labels):
        c.text(c.uid('time_label'),label,x-100,280,200,60,24,True,align='center')
        c.edge(c.uid('time_grid'),points=[(x,360),(x,1240)],arrow='none',dashed=True)
    tracks=[('Phiên đăng nhập','ACTIVE','EXPIRED',2),('Token tài khoản','VALID','EXPIRED',1),('Token tra cứu đơn','VALID','EXPIRED',3)]
    for i,(name,first,second,end) in enumerate(tracks):
        y=440+i*300;c.text(c.uid('track_name'),name,60,y-20,380,120,26,True)
        points=[(xs[0],y),(xs[end],y),(xs[end],y+110),(xs[-1]+100,y+110)]
        c.edge(c.uid('wave'),points=points,arrow='none')
        c.text(c.uid('active_state'),first,xs[0]+60,y-70,max(260,xs[end]-xs[0]-100),60,24,True)
        c.text(c.uid('expired_state'),second,min(xs[end]+30,2040),y+130,280,60,24,True)
        for k in range(end):c.text(c.uid('axis_break'),'//',xs[k]+230,y+15,80,50,24,align='center')
    return [c]

def composite_pages(m,row):
    c=Canvas(row['ID'],row['Name'],row['Status']);c.width=2520;c.height=1880
    c.shape('module','',120,240,1660,1120,'frame',back=True,extra='strokeWidth=2;')
    c.text('module_title','Phân hệ đơn hàng  «structured classifier»',160,260,1500,70,28,True)
    specs=[('Boundary','api : API đơn hàng',260,500,400,140),('Control','service : OrderService',920,500,560,160),('Tracking','tracking : CapabilityCheck',920,1040,560,140)]
    for k,label,x,y,w,h in specs:c.shape(k,label,x,y,w,h,'rect',26)
    ports={'AuthPort':(160,350,'session : AuthSession'),'DbPort':(1680,500,'db : PostgreSQL'),'EmailPort':(1680,1000,'mail : EmailService')}
    for k,(x,y,label) in ports.items():
        c.shape(k,'',x,y,40,40,'rect');c.text(k+'_label',label,x-100,y-80,420,70,22,True)
    for k,label,x,y in [('PostgreSQL','PostgreSQL',1980,500),('Outbox','Email outbox',1980,1020),('Worker','Mail worker',1980,1440)]:c.shape(k,label,x,y,460,140,'database' if k=='PostgreSQL' else 'component',26)
    router=Router(c,('module',))
    for i,l in enumerate(m.links,1):
        if l.source in c.boxes and l.target in c.boxes:relation(c,router,l,i)
    c.height=1800;return [c]

RELATIONS={'role_assignment':'GÁN VAI TRÒ','assigned_role':'VAI TRÒ ĐƯỢC GÁN','assigns_role':'NGƯỜI GÁN QUYỀN','grants':'GÁN QUYỀN','assigned':'ĐƯỢC GÁN','assigned_by':'NGƯỜI GÁN','assigned_operator':'THỢ ĐƯỢC GIAO','stores':'LƯU','opens':'MỞ PHIÊN','requests':'YÊU CẦU','uploads':'TẢI LÊN','attached':'ĐÍNH KÈM','parent':'PHÂN CẤP','groups':'PHÂN NHÓM','creates':'TẠO','compliance_reviewed_by':'DUYỆT TUÂN THỦ','compliance_evidence':'CUNG CẤP BẰNG CHỨNG','contains':'BAO GỒM','default_material':'VẬT LIỆU MẶC ĐỊNH','performs':'THỰC HIỆN','submits':'GỬI','inspected':'ĐƯỢC KIỂM TRA','inspected_file':'TỆP ĐƯỢC KIỂM TRA','inspections':'CÓ LẦN KIỂM TRA','reviewer':'NGƯỜI KIỂM TRA','specifies':'ĐẶC TẢ','source_file':'TỆP NGUỒN','source_attachment':'TỆP ĐÍNH KÈM NGUỒN','material':'DÙNG VẬT LIỆU','authors':'LẬP ĐẶC TẢ','author':'NGƯỜI LẬP','quoted':'ĐƯỢC BÁO GIÁ','prepares':'LẬP BÁO GIÁ','priced_spec':'TÍNH GIÁ ĐẶC TẢ','approves':'PHÊ DUYỆT','approves_designed':'PHÊ DUYỆT','recorded_by':'NGƯỜI GHI NHẬN','approval_for':'PHÊ DUYỆT CHO','approved_quote':'BÁO GIÁ ĐƯỢC DUYỆT','accepted_quote':'BÁO GIÁ ĐƯỢC CHẤP NHẬN','owns_design':'SỞ HỮU GIỎ','contains_design':'BAO GỒM','selected_design':'CHỌN BIẾN THỂ','owns':'SỞ HỮU','owns_guest_optional':'SỞ HỮU (TÙY CHỌN)','variant_snapshot_source':'NGUỒN SNAPSHOT BIẾN THỂ','snapshot_source':'NGUỒN SNAPSHOT','custom_spec_source':'NGUỒN ĐẶC TẢ IN','custom_source':'NGUỒN ĐẶC TẢ IN','custom_order_item':'MỤC ĐƠN IN THEO YÊU CẦU','customer':'KHÁCH HÀNG','receives':'NHẬN','verifies':'XÁC NHẬN','may_refund_design':'CÓ KHOẢN HOÀN','may_refund':'CÓ KHOẢN HOÀN','refund':'CÓ KHOẢN HOÀN','processes_design':'XỬ LÝ HOÀN','processes':'XỬ LÝ','may_ship_design':'CÓ KIỆN GIAO','may_ship':'CÓ KIỆN GIAO','shipment':'CÓ KIỆN GIAO','produces_design':'TẠO CÔNG VIỆC IN','assigned_design':'ĐƯỢC PHÂN CÔNG','assigned_operator_design':'THỢ ĐƯỢC GIAO','assigned_printer':'MÁY IN ĐƯỢC GIAO','assigned_material':'VẬT LIỆU ĐƯỢC GIAO','attempts_design':'CÓ LẦN IN','attempts':'CÓ LẦN IN','runs_design':'CHẠY LẦN IN','consumes_design':'TIÊU THỤ','operates_design':'VẬN HÀNH','input_file_design':'TỆP ĐẦU VÀO','inspected_design':'ĐƯỢC KIỂM ĐỊNH','inspected_file':'TỆP ĐƯỢC KIỂM TRA','inspects_design':'NGƯỜI KIỂM ĐỊNH','inspector':'NGƯỜI KIỂM ĐỊNH','quality_checks':'CÓ KIỂM TRA CHẤT LƯỢNG','demand_source':'NGUỒN NHU CẦU','demand_source_designed':'NGUỒN NHU CẦU','demand_candidate_designed':'NHU CẦU ỨNG VIÊN','demand_candidate':'NHU CẦU ỨNG VIÊN','fulfilled_quantity_designed':'SỐ LƯỢNG ĐÃ HOÀN THÀNH','fulfilled_quantity':'SỐ LƯỢNG ĐÃ HOÀN THÀNH','multi_order_job_designed':'CÔNG VIỆC GOM NHIỀU ĐƠN','multi_order_job':'CÔNG VIỆC GOM NHIỀU ĐƠN','bom_design':'CẤU PHẦN BOM','bom_source_designed':'NGUỒN BOM','bom_source':'NGUỒN BOM','job_source':'NGUỒN CÔNG VIỆC','proposals_designed':'ĐỀ XUẤT','proposals':'ĐỀ XUẤT','member_quantities_designed':'SỐ LƯỢNG CẤU PHẦN','member_quantities':'SỐ LƯỢNG CẤU PHẦN','public_gallery':'HIỂN THỊ Ở THƯ VIỆN','notification_current':'THÔNG BÁO ĐƠN','notification':'THÔNG BÁO ĐƠN','notifies':'THÔNG BÁO','store_alert_current':'CẢNH BÁO ĐƠN','store_alert':'CẢNH BÁO ĐƠN','guest_access':'QUYỀN TRA CỨU KHÁCH','actor':'TÁC NHÂN','operator':'THỢ VẬN HÀNH','printer':'MÁY IN','has':'CÓ','request':'YÊU CẦU','revisions':'CÁC PHIÊN BẢN','grants_current':'CẤP TOKEN'}
CARD={'||':'1','o|':'0..1','|o':'0..1','o{':'0..*','}o':'0..*','|{':'1..*','}|':'1..*'}

ER_MARKER={'||':'ERmandOne','o|':'ERzeroToOne','|o':'ERzeroToOne','o{':'ERzeroToMany','}o':'ERzeroToMany','|{':'ERmany','}|':'ERmany'}

def erd_table(c,n,x,y,w,prefix):
    rows=[]
    for member in n.members:
        parts=member.split();typ=parts[0] if parts else '';name=parts[1] if len(parts)>1 else typ;flags=' '.join(parts[2:])
        rows.append(f'{name} : {typ}'+(f'  [{flags}]' if flags else ''))
    body='\n'.join(rows) if rows else '(không có thuộc tính trong view này)'
    body_h=max(80,len(rows)*38)
    total=112+body_h
    c.shape(prefix,n.label+'\n'+body,x,y,w,total,'rect',21,fill='#FFFFFF',stroke=INK)
    return prefix,total

def erd_overview(m,row):
    c=Canvas(row['ID'],row['Name'],row['Status'],'Danh sách thực thể')
    c.width=2520;colw=780;rowh=56;top=230
    c.text('entity_heading','Thực thể',60,top,c.width-120,42,26,True);top+=65
    for i,n in enumerate(m.nodes.values()):
        col=i%3;rr=i//3
        c.text(f'entity_index_{i}',n.label,70+col*810,top+rr*rowh,760,40,22)
    c.height=top+math.ceil(len(m.nodes)/3)*rowh+120
    return c


def erd_pages(m,row):
    pages=[erd_overview(m,row)];chunks=[m.links[i:i+3] for i in range(0,len(m.links),3)]
    used={l.source for l in m.links}|{l.target for l in m.links}
    isolated=[n for n in m.nodes.values() if n.id not in used]
    total=len(chunks)+(1 if isolated else 0)
    for part,links in enumerate(chunks):
        c=Canvas(row['ID'],row['Name'],row['Status'],f'Phần {part+1}/{total}')
        c.width=2660;y=250
        for j,l in enumerate(links):
            index=part*3+j+1
            left,left_h=erd_table(c,m.nodes[l.source],80,y,900,f'r{index}_a')
            right,right_h=erd_table(c,m.nodes[l.target],1680,y,900,f'r{index}_b')
            relation_name=re.sub(r'[_\s-]+(?:CURRENT|PARTIAL|DESIGNED)$','',l.label,flags=re.I)
            relation_key=re.sub(r'[^a-z0-9]+','_',relation_name.lower()).strip('_')
            label=RELATIONS.get(relation_key,relation_name.replace('_',' ').upper())
            start=ER_MARKER.get(l.left,'ERmandOne');end=ER_MARKER.get(l.right,'ERmandOne')
            # ERD relations use one direct segment. Keep tables aligned in each
            # row so Crow's Foot edges remain clean, without curves or elbows.
            c.edge(f'erd_relation_{index}',left,right,label,end,start_arrow=start,multiplicity=(CARD.get(l.left,l.left),CARD.get(l.right,l.right)),orthogonal=False)
            y+=max(left_h,right_h)+150
        c.height=y+100;pages.append(c)
    if isolated:
        c=Canvas(row['ID'],row['Name'],row['Status'],f'Thực thể riêng · {total}/{total}');c.width=2660;y=260
        for i,n in enumerate(isolated):
            col=i%2
            if col==0:row_y=y
            _,table_h=erd_table(c,n,80+col*1280,row_y,1120,f'isolated_{i}')
            if col==1:y+=table_h+120
        if len(isolated)%2:y+=table_h+120
        c.height=y+100;pages.append(c)
    return pages


def dfd_node(c,key,label,x,y,w=420,h=160,kind='process'):
    if kind=='store':
        c.text(key,label,x,y,w,h,24,True,align='center')
        c.boxes[key]=(x,y,w,h,'rect')
        c.edge(key+'_top',points=[(x,y),(x+w,y)],arrow='none')
        c.edge(key+'_bottom',points=[(x,y+h),(x+w,y+h)],arrow='none')
    else:c.shape(key,label,x,y,w,h,'rect',26,True)

DFD_SHORT={
'W01':['Thông tin tài khoản, giỏ hàng, đơn và STL','Kết quả xử lý và trạng thái','Lệnh vận hành và đối soát','Đơn và kết quả cập nhật','Yêu cầu gửi thư','Kết quả gửi thư','Nội dung tư vấn','Cảnh báo đơn/thanh toán Telegram','Kết quả Bot API'],
'W02':['Thông tin tài khoản','Kết quả xác thực và phiên','Tài khoản, vai trò, token hash','Tài khoản và hạn token','Bộ lọc và giỏ hàng','Catalogue, chi tiết và giỏ','Catalogue và giá đọc từ DB','Giỏ trình duyệt','Yêu cầu checkout / tra cứu','Mã đơn, token / trạng thái','Giá và điều kiện bán','Đơn, item và token','Đơn và trạng thái','Khai báo chuyển khoản','Quyết định đối soát','Đơn và payment chờ','Thanh toán, audit, lịch sử','STL và cấu hình','Phân tích và giá tham khảo','Thư xác minh / khôi phục','Email khai báo/xác nhận','Thông báo đủ điều kiện gửi','Trạng thái mail và lịch thử lại','Yêu cầu gửi email','Kết quả gửi thư','Nội dung tư vấn','Danh sách và trạng thái đơn','Kết quả đối soát','Kết quả khai báo','Danh tính và quyền','Lệnh quản trị catalogue','Kết quả lưu/revision','Catalogue hiện có','Catalogue đã cập nhật','Cảnh báo đơn mới','Cảnh báo thanh toán','Cảnh báo Telegram đã commit','Trạng thái lease/lần thử lại','sendMessage','Kết quả Bot API'],
'W03':['Thông tin checkout + idempotency key','Input đã kiểm tra','Phiên và người dùng','Lệnh checkout có chủ đơn','Giá và trạng thái biến thể','Dòng hàng và tổng tiền','Đơn, sản phẩm, hash, token và thanh toán','Cảnh báo Telegram trong transaction','Kết quả COMMIT','Mã đơn và tracking token','Hash yêu cầu hiện có','Hash, khóa, tra cứu/ghi mới','Cảnh báo Telegram đã commit','Yêu cầu Bot API','Kết quả Bot API','Trạng thái lease và retry']}

def dfd_flow(c,key,a,b,label,router):
    p,ports=router.route(a,b)
    c.edge(key,a,b,'','block',points=p[1:-1],ports=ports)
    labels=DFD_SHORT.get(c.key,[]);index=int(key[1:])-1
    short=labels[index] if index<len(labels) else label
    text=key+'  '+wrap(short,320,22);ww=340;hh=height(text,320,22,16)
    candidates=[]
    for (x1,y1),(x2,y2) in zip(p,p[1:]):
        length=abs(x2-x1)+abs(y2-y1)
        if length<100:continue
        for ratio in (.5,.3,.7):
            xx=x1+(x2-x1)*ratio;yy=y1+(y2-y1)*ratio
            if x1==x2:
                candidates.extend([(xx+22,yy-hh/2),(xx-ww-22,yy-hh/2)])
            else:candidates.extend([(xx-ww/2,yy-hh-16),(xx-ww/2,yy+16)])
    candidates+=[(x+dx,y+dy) for x,y in list(candidates) for dx,dy in ((-180,0),(180,0),(0,-120),(0,120),(-180,-120),(180,120))]
    obstacles=[(x-20,y-20,w+40,h+40) for k,(x,y,w,h,shape) in c.boxes.items() if k not in {'heading','subheading'} and shape not in {'frame','note'}]
    def score(pos):
        x,y=pos;overlap=sum(max(0,min(x+ww,bx+bw)-max(x,bx))*max(0,min(y+hh,by+bh)-max(y,by)) for bx,by,bw,bh in obstacles)
        near=min((abs(x+ww/2-px)+abs(y+hh/2-py) for px,py in p),default=0)
        return overlap*10000+near+(1e12 if x<40 or x+ww>c.width-40 or y<190 else 0)
    x,y=min(candidates or [(60,200)],key=score)
    c.text(key+'_label',text,x,y,ww,hh,22,align='center')
    c.front[-1].set('style',c.front[-1].get('style')+'fillColor=#FFFFFF;')
    router.blocks.append((x-12,y-12,x+ww+12,y+hh+12))
    return key+'  '+label


def dfd_pages():
    pages=[]
    c=Canvas('W01','DFD mức 0 — Ngữ cảnh','CURRENT');c.width=2460;c.height=1900
    for args in [('customer','KHÁCH HÀNG',60,780,400,160,'actor'),('staff','NHÂN VIÊN / ADMIN',1030,230,460,160,'actor'),('system','0\nHỆ THỐNG MINHLAB 3D',920,700,680,420,'process'),('email','DỊCH VỤ EMAIL',1960,780,400,160,'actor'),('handoff','ZALO / ỨNG DỤNG EMAIL',1030,1430,460,160,'actor'),('telegram','TELEGRAM BOT API',1960,1430,400,160,'actor')]:dfd_node(c,*args)
    flows=[('F01','customer','system','Thông tin tài khoản; giỏ hàng; địa chỉ và yêu cầu đặt đơn VietQR; khai báo chuyển khoản; STL và thông số in'),('F02','system','customer','Kết quả đăng nhập/xác minh; catalogue và mô hình 3D; mã đơn, token tra cứu; trạng thái đơn; phân tích STL/giá tham khảo'),('F03','staff','system','Yêu cầu đối soát thủ công, lý do từ chối, lệnh chuyển trạng thái đơn'),('F04','system','staff','Danh sách đơn/thanh toán; kết quả kiểm tra quyền và cập nhật'),('F05','system','email','Yêu cầu gửi email đã ghi outbox; worker gửi sau commit'),('F06','email','system','Kết quả gửi thư: thành công hoặc thất bại'),('F07','system','handoff','Nội dung tư vấn do trình duyệt bàn giao qua Zalo/mailto'),('F08','system','telegram','Cảnh báo đơn/thanh toán từ Telegram outbox sau commit'),('F09','telegram','system','Kết quả gửi và mã thông báo của Bot API')]
    router=Router(c);rows=[dfd_flow(c,*flow,router) for flow in flows]
    pages.append(c)
    c=Canvas('W02','DFD mức logic — Các nhóm xử lý','CURRENT');c.width=2840;c.height=2900
    specs=[('customer','KHÁCH HÀNG',60,800,360,160,'actor'),('staff','NHÂN VIÊN / STAFF',2220,800,500,160,'actor'),('admin','ADMIN',2220,280,500,160,'actor'),('p1','1.0\nQuản lý tài khoản và phiên',600,280,480,180,'process'),('p2','2.0\nTra cứu catalogue và quản lý giỏ',600,800,480,180,'process'),('p3','3.0\nTạo đơn và tra cứu đơn',1300,800,520,180,'process'),('p4','4.0\nKhai báo và đối soát thanh toán',1300,1360,520,200,'process'),('p5','5.0\nPhân tích STL và tạo tư vấn',600,1880,480,200,'process'),('p6','6.0\nGửi email / Telegram outbox',2200,1880,520,180,'process'),('p7','7.0\nQuản lý catalogue',1300,2440,520,180,'process'),('mail_provider','DỊCH VỤ EMAIL',2200,2440,520,160,'actor'),('telegram_provider','TELEGRAM BOT API',2200,2720,520,160,'actor'),('handoff','ZALO / ỨNG DỤNG EMAIL',600,2440,520,160,'actor'),('d1','D1  Tài khoản / phiên / token',1300,280,520,100,'store'),('d2','D2  PostgreSQL: products / variants / images',1740,760,820,120,'store'),('d3','D3  CartContext / localStorage trong browser',60,1440,520,120,'store'),('d4','D4  Orders / items / payments / tracking',2200,1360,520,120,'store'),('d5','D5  Email outbox',1300,1880,520,100,'store'),('d6','D6  Telegram outbox',1740,2080,520,100,'store')]
    for args in specs:dfd_node(c,*args)
    flows=[('F01','customer','p1','Thông tin đăng ký, đăng nhập, yêu cầu token'),('F02','p1','customer','Kết quả xác thực và phiên'),('F03','p1','d1','Tài khoản, vai trò mặc định, phiên và token hash'),('F04','d1','p1','Bản ghi tài khoản, quyền và hạn token'),('F05','customer','p2','Bộ lọc, biến thể, số lượng giỏ'),('F06','p2','customer','Catalogue, chi tiết, giỏ đã chuẩn hóa'),('F07','d2','p2','Dữ liệu sản phẩm và giá đọc từ PostgreSQL'),('F08','p2','d3','Giỏ browser được chuẩn hóa trong localStorage'),('F09','customer','p3','Thông tin checkout hoặc mã đơn + khả năng truy cập'),('F10','p3','customer','Mã đơn, tracking token hoặc trạng thái được phép xem'),('F11','d2','p3','Biến thể và giá có thẩm quyền'),('F12','p3','d4','Order, item snapshot, payment và token tra cứu'),('F13','d4','p3','Bản ghi đơn và trạng thái'),('F14','customer','p4','Khai báo chuyển khoản + session/token'),('F15','staff','p4','Xác nhận hoặc từ chối sau kiểm tra ngân hàng'),('F16','d4','p4','Đơn và payment đang chờ'),('F17','p4','d4','Kết quả đối soát, audit và lịch sử'),('F18','customer','p5','STL, scale và cấu hình'),('F19','p5','customer','Thông số hình học, giá tham khảo và nội dung tư vấn'),('F20','p1','d5','Thư xác minh hoặc khôi phục'),('F21','p4','d5','Email thanh toán khi use case yêu cầu'),('F22','d5','p6','Thông báo mail đủ điều kiện gửi'),('F23','p6','d5','Trạng thái gửi, số lần thử và lịch thử lại'),('F24','p6','mail_provider','Yêu cầu gửi email'),('F25','mail_provider','p6','Kết quả yêu cầu gửi thư'),('F26','p5','handoff','Nội dung tư vấn bàn giao từ trình duyệt'),('F27','p3','staff','Danh sách đơn và trạng thái được phép xem'),('F28','p4','staff','Kết quả đối soát hoặc từ chối'),('F29','p4','customer','Kết quả khai báo và trạng thái thanh toán'),('F30','p1','p3','Danh tính và quyền từ phiên hiện tại'),('F31','admin','p7','Sản phẩm, nội dung, biến thể/giá và lệnh xuất bản'),('F32','p7','admin','Kết quả lưu, revision, trạng thái duyệt/xuất bản'),('F33','d2','p7','Sản phẩm, biến thể, ảnh và revision hiện có'),('F34','p7','d2','Nội dung đã validate, biến thể, revision và quyết định duyệt'),('F35','p3','d6','Cảnh báo đơn mới không chứa thông tin cá nhân'),('F36','p4','d6','Cảnh báo khai báo/xác nhận thanh toán'),('F37','d6','p6','Telegram alert đã commit, sẵn sàng gửi'),('F38','p6','d6','Trạng thái gửi, lease, số lần thử và retry'),('F39','p6','telegram_provider','sendMessage sau commit'),('F40','telegram_provider','p6','Kết quả Bot API')]
    router=Router(c);rows=[dfd_flow(c,*flow,router) for flow in flows]
    pages.append(c)
    c=Canvas('W03','DFD mức vật lý — Đặt đơn VietQR và Telegram outbox','CURRENT');c.width=2800;c.height=3300
    specs=[('customer','KHÁCH HÀNG\nQua CheckoutModal',60,260,480,160,'actor'),('p31','3.1\nAPI kiểm Origin, body và input',780,260,540,180,'process'),('session','D1  Auth sessions / users / roles',1740,260,820,120,'store'),('p32','3.2\nĐọc session và kiểm chủ đơn',780,760,540,180,'process'),('catalog','D2  Products / product variants',1740,760,820,120,'store'),('p33','3.3\nĐọc giá DB và kiểm điều kiện bán',780,1260,540,180,'process'),('p34','3.4\nOrderService: idempotency + transaction',780,1760,540,200,'process'),('orders','D3  Orders / items / payments / tracking / checkout hashes',1740,1760,820,150,'store'),('outbox','D4  Telegram outbox',1740,2260,820,120,'store'),('p35','3.5\nAPI trả mã đơn và token cho trình duyệt',60,2260,540,200,'process'),('p36','6.2\nTelegram worker claim, gửi và retry sau commit',780,2760,540,200,'process'),('provider','TELEGRAM BOT API',1740,2760,820,160,'actor')]
    for args in specs:dfd_node(c,*args)
    flows=[('F01','customer','p31','Contact, địa chỉ, item IDs, số lượng, VietQR và Idempotency-Key'),('F02','p31','p32','Input đã qua kiểm tra'),('F03','session','p32','Phiên còn hiệu lực và người dùng hiện tại'),('F04','p32','p33','Lệnh checkout với customerId suy ra từ phiên hoặc null'),('F05','catalog','p33','Giá và trạng thái biến thể từ DB'),('F06','p33','p34','Dòng hàng hợp lệ và tổng tiền server tính'),('F07','p34','orders','Insert order/item/payment snapshots, tracking-token hash và checkout hashes'),('F08','p34','outbox','Telegram alert được ghi trong cùng transaction, không có PII'),('F09','p34','p35','Kết quả COMMIT: mã đơn và raw tracking token'),('F10','p35','customer','Kết quả checkout; dữ liệu tra cứu riêng của khách'),('F11','orders','p34','Đơn và request hash hiện có để quyết định replay/conflict'),('F12','p34','orders','Hash key/payload, lock và lookup; insert nếu là yêu cầu mới'),('F13','outbox','p36','Cảnh báo đã commit, sẵn sàng gửi'),('F14','p36','provider','sendMessage khi Telegram đã cấu hình'),('F15','provider','p36','Kết quả Bot API'),('F16','p36','outbox','SENT/FAILED, lease, attempts và retry time')]
    router=Router(c);rows=[dfd_flow(c,*flow,router) for flow in flows]
    pages.append(c)
    return pages

def profile_pages(m,row):
    c=Canvas(row['ID'],row['Name'],row['Status']);c.width=2520
    stereotypes=[n for n in m.nodes.values() if n.kind=='class' and n.stereotype=='stereotype']
    c.shape('profile_frame','',60,210,1580,1280,'frame',back=True,extra='strokeWidth=2;')
    c.text('profile_label','«profile» Tài liệu OOAD MinhLab',100,230,1480,70,28,True)
    for i,n in enumerate(stereotypes):c.classbox(n,100+(i%2)*780,380+(i//2)*270,640)
    meta=Node('UML_Class','UML::Class','class',stereotype='metaclass');c.classbox(meta,1880,760,500)
    router=Router(c,('profile_frame',))
    for i,n in enumerate(stereotypes):
        p,ports=router.route(n.id,'UML_Class')
        c.edge(f'extension_{i}',n.id,'UML_Class','','blockTriangle',points=p[1:-1],ports=ports)
        c.edges[-1].set('style',c.edges[-1].get('style').replace('endFill=0','endFill=1'))
    c.notes(['Áp dụng ở phạm vi lớp tài liệu: mũi tên tam giác tô đen hướng đến metaclass biểu diễn extension của stereotype. Các nhãn trạng thái CURRENT/PARTIAL/DESIGNED vẫn là quy ước mô tả bằng chứng trong hồ sơ; chúng không tạo cơ chế runtime trong TypeScript.']+m.notes,1640,2400)
    return [c]


def index_page(rows,page_counts):
    c=Canvas('00','Danh mục sơ đồ OOAD MinhLab 3D','DOCUMENTATION');c.width=2500
    items=[('W01','DFD ngữ cảnh',1),('W02','DFD logic',1),('W03','DFD vật lý checkout',1)]+[(r['ID'],r['Name'],page_counts[r['ID']]) for r in rows]
    for i,(key,title,count) in enumerate(items):
        col=i//32;rr=i%32;y=160+rr*64
        c.text(c.uid('index'),f'{key}   {title}'+(f'  ({count} trang)' if count>1 else ''),60+col*810,y,760,58,22)
    c.height=160+math.ceil(len(items)/32)*32*64+100
    return c


def main():
    parser=argparse.ArgumentParser(description='Build editable OOAD Draw.io pages from manifest sources.')
    parser.add_argument('--only',help='comma-separated diagram IDs to regenerate; preserve all other page subtrees')
    args=parser.parse_args()
    with (OOAD/'diagram-manifest.csv').open(encoding='utf-8-sig',newline='') as f:rows=list(csv.DictReader(f))
    manifest_rows=rows
    rows=[r for r in manifest_rows if r['ID'][0] in 'DEB']
    assert len(rows)==61
    selected=set(args.only.split(',')) if args.only else {r['ID'] for r in rows}
    unknown=selected-{r['ID'] for r in rows}
    if unknown:raise ValueError(f'Unknown or unsupported diagram IDs: {sorted(unknown)}')
    old_pages=defaultdict(list)
    old_root=None
    if OUTPUT.exists():
        old_root=ET.parse(OUTPUT).getroot()
        for page in old_root.findall('diagram'):
            match=re.match(r'([A-Z]\d+)',page.get('name',''))
            if match:old_pages[match.group(1)].append(page)
    counts={r['ID']:len(old_pages.get(r['ID'],[])) for r in rows};stats=[];generated={}
    for row in rows:
        if row['ID'] not in selected:continue
        source=OOAD/row['Source'];text=source.read_text();typ=row['Diagram type'];key=row['ID']
        if typ=='ERD':m=parse_erd(text);pages=erd_pages(m,row)
        elif typ=='Activity':m=parse_activity(text);pages=activity_pages(m,row)
        elif typ=='Sequence':m=parse_sequence(text);pages=sequence_pages(m,row)
        elif typ=='Use case':m=parse_generic(text);pages=usecase_pages(m,row)
        elif typ=='State machine':m=parse_generic(text);pages=state_pages(m,row)
        elif typ in {'Class','Object'}:m=parse_generic(text);pages=class_pages(m,row)
        elif typ=='Deployment':m=parse_generic(text);pages=deployment_pages(m,row)
        elif typ=='Communication':m=parse_generic(text);pages=communication_pages(m,row)
        elif typ=='Interaction overview':m=parse_generic(text);pages=interaction_pages(m,row)
        elif typ=='Timing':m=parse_generic(text);pages=timing_pages(text,row)
        elif typ=='Composite structure':m=parse_generic(text);pages=composite_pages(m,row)
        elif typ=='Profile':m=parse_generic(text);pages=profile_pages(m,row)
        else:m=parse_generic(text);pages=graph_pages(m,row)
        if not pages and m.notes:
            c=Canvas(key,row['Name'],row['Status'])
            c.notes(m.notes,220,1900)
            pages=[c]
        assert pages,(key,'empty')
        counts[key]=len(pages);generated[key]=pages
        stats.append({'id':key,'type':typ,'pages':len(pages),'source_nodes':len(m.nodes),'source_links':len(m.links),'source_attributes':sum(len(n.members) for n in m.nodes.values()),'notes':len(m.notes)})
        print(key,typ,len(pages),'pages',len(m.nodes),'nodes',flush=True)
    if args.only:
        preserved_w=old_pages
        if any(not old_pages.get(r['ID']) for r in rows if r['ID'] not in selected):
            raise ValueError('Partial export cannot preserve a manifest diagram with no existing page; include it with --only.')
        w_pages=[page for key in ('W01','W02','W03') for page in preserved_w.get(key,[])]
        if len(w_pages)!=3:raise ValueError('Expected the existing W01–W03 DFD pages in the export.')
        allpages=[]
        for row in rows:
            key=row['ID']
            allpages.extend(generated[key] if key in selected else old_pages[key])
        canvases=[index_page(rows,counts)]+w_pages+allpages
    else:
        allpages=[page for row in rows for page in generated[row['ID']]]
        canvases=[index_page(rows,counts)]+dfd_pages()+allpages
    mxfile=ET.Element('mxfile',{'host':'app.diagrams.net','agent':'Codex','version':'24.7.17','type':'device'})
    for canvas in canvases:
        page=canvas if isinstance(canvas,ET.Element) else canvas.finish()
        if args.only and page is not canvas:ET.indent(page,space='  ')
        mxfile.append(page)
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    if not args.only:ET.indent(mxfile,space='  ')
    ET.ElementTree(mxfile).write(OUTPUT,encoding='utf-8',xml_declaration=True)
    page_locations=defaultdict(list)
    for page_number,page in enumerate(mxfile.findall('diagram'),start=1):
        match=re.match(r'([A-Z]\d+)',page.get('name',''))
        if match:page_locations[match.group(1)].append(page_number)
    for row in manifest_rows:
        locations=page_locations.get(row['ID'],[])
        if locations:
            first,last=locations[0],locations[-1]
            page_range=str(first) if first==last else f'{first}–{last}'
            count=len(locations)
            row['Rendered export']=f'exports/MinhLab-OOAD.drawio · trang {page_range} ({count} trang)'
        if row['ID'] in selected:
            row['Review']='Generated from editable source; XML checks only. Visual inspection and business acceptance remain pending.'
    with (OOAD/'diagram-manifest.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(manifest_rows[0].keys()));writer.writeheader();writer.writerows(manifest_rows)
    QA.mkdir(exist_ok=True);(QA/'generation-stats.json').write_text(json.dumps({'pages':len(canvases),'source_diagrams':len(rows),'regenerated_diagrams':sorted(selected),'diagrams':stats},ensure_ascii=False,indent=2))
    for i,page in enumerate(mxfile.findall('diagram')):
        single=ET.Element('mxfile',{'host':'app.diagrams.net'});single.append(page)
        (QA/f'{i:03d}.drawio').write_bytes(ET.tostring(single,encoding='utf-8'))
    print('Wrote',OUTPUT,len(canvases),'pages',OUTPUT.stat().st_size,'bytes',flush=True)

if __name__=='__main__':main()
