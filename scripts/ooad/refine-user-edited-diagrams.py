#!/usr/bin/env python3
"""Refine the user's saved native diagrams, preserving IDs, text and semantics."""
from pathlib import Path
import argparse,base64,collections,copy,hashlib,html,itertools,json,math,random,re,urllib.parse,zlib
import xml.etree.ElementTree as ET
from PIL import ImageFont

ROOT=Path(__file__).resolve().parents[2]
FONT='/System/Library/Fonts/Supplemental/Arial.ttf'

def read(path):
    root=ET.parse(path).getroot()
    for page in root.findall('diagram'):
        if page.find('mxGraphModel') is None:
            page.append(ET.fromstring(urllib.parse.unquote(zlib.decompress(base64.b64decode(page.text),-15).decode())))
            page.text=None
    return root

def style(cell):
    return dict(p.split('=',1) for p in cell.get('style','').split(';') if '=' in p)

def put(cell,**values):
    parts=[p for p in cell.get('style','').split(';') if p and not any(p.startswith(k+'=') for k in values)]
    cell.set('style',';'.join(parts+[f'{k}={v}' for k,v in values.items()])+';')

def box(cell):
    g=cell.find('mxGeometry')
    return tuple(float(g.get(k,0)) for k in ['x','y','width','height'])

def geometry(cell,x=None,y=None,w=None,h=None):
    g=cell.find('mxGeometry')
    for k,v in zip(['x','y','width','height'],[x,y,w,h]):
        if v is not None:g.set(k,f'{v:g}')

def translated(value):
    value=value.replace('DichVuCatalogue','DichVuSanPham').replace('KhoCatalogue','KhoSanPham').replace('datCatalogue','datSanPhamCoSan')
    substitutions=[(r'catalogue\s+và\s+phòng\s+lab','sản phẩm và phòng lab'),
                   (r'quản\s+lý\s+catalogue','quản lý sản phẩm'),
                   (r'đặt\s+hàng\s+catalogue','đặt mua sản phẩm có sẵn'),
                   (r'đặt\s+catalogue','đặt mua sản phẩm có sẵn'),
                   (r'đơn\s+catalogue','đơn sản phẩm có sẵn'),
                   (r'catalogue','danh mục sản phẩm')]
    for pattern,replacement in substitutions:
        def repl(match):
            old=match.group()
            return replacement.upper() if old.isupper() else replacement[0].upper()+replacement[1:] if old[0].isupper() else replacement
        value=re.sub(pattern,repl,value,flags=re.I)
    return value

def reflow(value,size,width,preserve=False):
    font=ImageFont.truetype(FONT,int(size));result=[]
    for paragraph in value.split('\n') if preserve else [' '.join(value.split())]:
        line=''
        for word in paragraph.split():
            candidate=(line+' '+word).strip()
            if line and font.getlength(candidate)>width:result.append(line);line=word
            else:line=candidate
        result.append(line)
    return '\n'.join(result)

def intersects(a,b,rect,pad=0):
    x,y,w,h=rect;lo=0.;hi=1.
    for av,dv,mn,mx in [(a[0],b[0]-a[0],x-pad,x+w+pad),(a[1],b[1]-a[1],y-pad,y+h+pad)]:
        if abs(dv)<1e-9:
            if not mn<av<mx:return False
        else:
            l=(mn-av)/dv;u=(mx-av)/dv
            if l>u:l,u=u,l
            lo=max(lo,l);hi=min(hi,u)
            if lo>=hi:return False
    return lo<hi

def crossing(a,b,c,d):
    def side(p,q,r):return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])
    return side(a,b,c)*side(a,b,d)<-1e-5 and side(c,d,a)*side(c,d,b)<-1e-5

def straight(a,b):
    x,y,w,h=a;xx,yy,ww,hh=b;ac=(x+w/2,y+h/2);bc=(xx+ww/2,yy+hh/2)
    # Projection overlap permits a truly horizontal/vertical line with ports
    # away from the centers, matching the user's edited ERD examples.
    overlapx=(max(x+45,xx+45),min(x+w-45,xx+ww-45))
    overlapy=(max(y+45,yy+45),min(y+h-45,yy+hh-45))
    if overlapx[0]<overlapx[1] and (y+h<=yy or yy+hh<=y):
        sx=(overlapx[0]+overlapx[1])/2
        return (sx,y+h if yy>y else y),(sx,yy if yy>y else yy+hh)
    if overlapy[0]<overlapy[1] and (x+w<=xx or xx+ww<=x):
        sy=(overlapy[0]+overlapy[1])/2
        return (x+w if xx>x else x,sy),(xx if xx>x else xx+ww,sy)
    def border(origin,target,rect):
        rx,ry,rw,rh=rect;dx=target[0]-origin[0];dy=target[1]-origin[1]
        t=min((rw/2)/abs(dx) if dx else math.inf,(rh/2)/abs(dy) if dy else math.inf)
        return origin[0]+t*dx,origin[1]+t*dy
    return border(ac,bc,a),border(bc,ac,b)

def arrange(ids,edges,width,height):
    n=len(ids);pitchx=width+580;pitchy=height+460
    cols=3;rows=3 if n<=9 else 4
    slots=[(i%cols*pitchx,i//cols*pitchy,width,height) for i in range(cols*rows)]
    pairs={};bad={};length={}
    for a,b in itertools.combinations(range(len(slots)),2):
        start,end=straight(slots[a],slots[b]);key=(a,b);pairs[key]=(start,end)
        bad[key]=sum(1<<k for k,r in enumerate(slots) if k not in key and intersects(start,end,r,20))
        length[key]=(0 if abs(start[0]-end[0])<1 or abs(start[1]-end[1])<1 else 80)+math.dist(start,end)/max(pitchx,pitchy)
    ecross=set()
    for p,q in itertools.combinations(pairs,2):
        if not set(p)&set(q) and crossing(*pairs[p],*pairs[q]):ecross.add(tuple(sorted((p,q))))
    links=[(ids.index(a),ids.index(b)) for a,b in edges]
    best=None;best_score=math.inf
    def score(perm):
        mask=sum(1<<k for k in perm);ee=[tuple(sorted((perm[a],perm[b]))) for a,b in links]
        penalty=sum((bad[e]&mask).bit_count() for e in ee)*1e6
        if penalty>best_score:return penalty
        penalty+=sum(tuple(sorted((a,b))) in ecross for a,b in itertools.combinations(ee,2))*1e4
        penalty+=sum(length[e] for e in ee)
        xs=[k%cols for k in perm];ys=[k//cols for k in perm]
        penalty+=(max(xs)-min(xs)+1)*(max(ys)-min(ys)+1)*12
        return penalty
    if n<=6:
        # Exact search for the small subject views (at most 9P6 = 60,480).
        candidates=itertools.permutations(range(len(slots)),n)
    else:
        rng=random.Random(1108)
        candidates=(rng.sample(range(len(slots)),n) for _ in range(35000))
    for perm in candidates:
        value=score(perm)
        if value<best_score:best_score=value;best=perm
    # Improve large views with node swaps, retaining the best deterministic seed.
    for _ in range(10):
        changed=False
        for a,b in itertools.combinations(range(n),2):
            trial=list(best);trial[a],trial[b]=trial[b],trial[a];value=score(trial)
            if value<best_score:best=trial;best_score=value;changed=True
        if not changed:break
    xmin=min(slots[k][0] for k in best);ymin=min(slots[k][1] for k in best)
    return {key:(slots[k][0]-xmin+170,slots[k][1]-ymin+300) for key,k in zip(ids,best)},best_score

def table_page(page):
    name=page.get('name','')
    return name.startswith(('ERD','EL12')) or ' - Lớp ' in name

def refine(args):
    if args.source.resolve()==args.output.resolve():raise ValueError('Source is immutable')
    if args.output.exists() and not args.replace_derived:raise FileExistsError(args.output)
    original=read(args.source);result=copy.deepcopy(original);old=read(args.previous)
    previous={p.get('id'):{c.get('id'):c for c in p.findall('.//mxCell')} for p in old.findall('diagram')}
    audit=[];translations=[];repairs=[]
    for number,page in enumerate(result.findall('diagram'),1):
        oldname=page.get('name');page.set('name',translated(oldname));model=page.find('mxGraphModel');root=model.find('root')
        cells={c.get('id'):c for c in root.findall('mxCell')}
        changed=[]
        for key,c in cells.items():
            before=c.get('value','');after=translated(before)
            if after==before:continue
            c.set('value',after);changed.append(key);translations.append({'page_id':page.get('id'),'cell':key,'before':before,'after':after})
            g=c.find('mxGeometry');st=style(c);size=float(st.get('fontSize',24))
            if c.get('vertex')=='1' and g is not None:
                x,y,w,h=box(c);usable=w*.77 if 'ellipse' in c.get('style','') else w-35
                value=reflow(after,size,usable,preserve=key.endswith(('-attrs','-ops')))
                c.set('value',value);needed=len(value.split('\n'))*size*1.18+24
                if 'ellipse' in c.get('style',''):needed/=0.83
                if 'swimlane' not in c.get('style','') and needed>h:geometry(c,h=needed)
            elif c.get('edge')=='1':c.set('value',reflow(after,size,850))
        if not table_page(page):
            if changed or oldname!=page.get('name'):audit.append({'page':number,'id':page.get('id'),'name':page.get('name'),'type':'text-only','changed_cells':changed})
            continue
        entities={key:c for key,c in cells.items() if c.get('vertex')=='1' and 'swimlane;' in c.get('style','')}
        edges=[]
        for c in cells.values():
            if c.get('edge')!='1' or not (c.get('source') or c.get('target')):continue
            for side in ['source','target']:
                if not c.get(side):
                    prior=previous.get(page.get('id'),{}).get(c.get('id'))
                    if prior is not None and prior.get(side) in entities:
                        c.set(side,prior.get(side));repairs.append({'page':number,'edge':c.get('id'),'side':side,'endpoint':prior.get(side),'evidence':'same page ID and edge ID in previous saved artifact'})
                    else:raise ValueError('Unresolved detached relationship '+c.get('id'))
            if c.get('source') in entities and c.get('target') in entities:edges.append(c)
        # Respect the native child grouping the user introduced. Refit the
        # compartments before moving their owner; do not replace their content.
        parts={}
        for key,entity in entities.items():
            x,y,w,h=box(entity);body=[]
            for suffix in ['-attrs','-ops']:
                child=cells.get(key+suffix)
                if child is None:continue
                cx,cy,cw,ch=box(child);relative=child.get('parent')==key
                dx,dy=(cx,cy) if relative else (cx-x,cy-y)
                w=max(w,dx+cw+25);h=max(h,dy+ch+20);body.append((child,dx,dy,relative))
            geometry(entity,w=w,h=h);parts[key]=body
        # Preserve the two hand-edited examples, fixing only clipping/overlap.
        if number in [13,14]:
            positions={key:box(c)[:2] for key,c in entities.items()}
            if number==14:
                positions['item']=(1400,positions['item'][1]);positions['tracking']=(3000,positions['tracking'][1])
            dx=170-min(x for x,y in positions.values());dy=300-min(y for x,y in positions.values())
            positions={key:(x+dx,y+dy) for key,(x,y) in positions.items()};layout_score=None
        else:
            maxw=max(box(c)[2] for c in entities.values());maxh=max(box(c)[3] for c in entities.values())
            positions,layout_score=arrange(list(entities),[(c.get('source'),c.get('target')) for c in edges],maxw,maxh)
        before_geometry={key:box(c) for key,c in entities.items()}
        for key,c in entities.items():
            ox,oy,w,h=box(c);nx,ny=positions[key];geometry(c,x=nx,y=ny)
            for child,dx,dy,relative in parts[key]:
                if not relative:geometry(child,x=nx+dx,y=ny+dy)
            separator=cells.get(key+'-sep')
            if separator is not None:
                for pt in separator.findall('./mxGeometry/mxPoint'):
                    pt.set('x',str(float(pt.get('x'))+nx-ox));pt.set('y',str(float(pt.get('y'))+ny-oy))
        node_boxes={key:box(c) for key,c in entities.items()};obstacles=[]
        for edge in edges:
            a,b=edge.get('source'),edge.get('target');start,end=straight(node_boxes[a],node_boxes[b])
            x,y,w,h=node_boxes[a];xx,yy,ww,hh=node_boxes[b]
            put(edge,edgeStyle='none',curved=0,rounded=0,exitX=(start[0]-x)/w,exitY=(start[1]-y)/h,
                entryX=(end[0]-xx)/ww,entryY=(end[1]-yy)/hh,exitPerimeter=0,entryPerimeter=0)
            g=edge.find('mxGeometry')
            for child in list(g):
                if child.tag=='Array' or child.get('as') in ['sourcePoint','targetPoint']:g.remove(child)
            for key,rect in node_boxes.items():
                if key not in [a,b] and intersects(start,end,rect,-3):obstacles.append({'edge':edge.get('id'),'crosses':key})
        if obstacles:raise ValueError(f'{page.get("name")}: straight connector obstacles {obstacles}')
        maxx=max(x+w for x,y,w,h in node_boxes.values());maxy=max(y+h for x,y,w,h in node_boxes.values())
        width=max(3200,maxx+170);height=maxy+170;model.set('pageWidth',str(width));model.set('pageHeight',str(height))
        title=next(c for c in cells.values() if c.get('vertex')=='1' and c.get('id') not in entities and c.get('parent')=='1' and not c.get('id','').endswith(('-attrs','-ops')))
        geometry(title,x=96,y=52.5,w=width-192,h=114)
        put(title,align='left');title.set('value',reflow(title.get('value',''),float(style(title).get('fontSize',64)),width-220))
        audit.append({'page':number,'id':page.get('id'),'name':page.get('name'),'type':'ERD' if oldname.startswith(('ERD','EL12')) else 'Class',
                      'entities':len(entities),'straight_relationships':len(edges),'preserved_user_example':number in [13,14],
                      'before_geometry':before_geometry,'after_geometry':node_boxes,'layout_score':layout_score,'node_obstacles':obstacles})
        print(f'{number:03} {page.get("name")}: {len(edges)} straight edges',flush=True)
    args.output.parent.mkdir(parents=True,exist_ok=True);ET.indent(result,space='  ');ET.ElementTree(result).write(args.output,encoding='utf-8',xml_declaration=True)
    manifest={'source':str(args.source),'source_sha256':hashlib.sha256(args.source.read_bytes()).hexdigest(),
              'artifact':str(args.output),'artifact_sha256':hashlib.sha256(args.output.read_bytes()).hexdigest(),
              'page_count':len(result.findall('diagram')),'page_ids':[p.get('id') for p in result.findall('diagram')],
              'changes':audit,'translations':translations,'detached_endpoints_repaired':repairs,'visual_qa':'PENDING'}
    args.output.with_suffix('.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    if args.qa_dir:
        args.qa_dir.mkdir(parents=True,exist_ok=True)
        for number,page in enumerate(result.findall('diagram'),1):
            doc=ET.Element('mxfile');doc.append(copy.deepcopy(page));options={'nav':False,'resize':True,'fit':True,'toolbar':'','xml':ET.tostring(doc,encoding='unicode')}
            content='<!doctype html><meta charset="utf-8"><title>'+html.escape(page.get('name'))+'</title><style>body{margin:0;background:white}.mxgraph{width:100%;min-height:700px}</style><div class="mxgraph" data-mxgraph="'+html.escape(json.dumps(options,ensure_ascii=False),quote=True)+'"></div><script src="https://viewer.diagrams.net/js/viewer-static.min.js"></script>'
            (args.qa_dir/f'page-{number:03}.html').write_text(content)
    print(json.dumps({'pages':manifest['page_count'],'translations':len(translations),'table_views':sum(x['type'] in ['Class','ERD'] for x in audit),'repaired_endpoints':len(repairs)},ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True);parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--previous',type=Path,default=ROOT/'docs/ooad/exports/minhlab-ooad-phan-ra-chi-tiet-2026-11-07.drawio')
    parser.add_argument('--replace-derived',action='store_true');parser.add_argument('--qa-dir',type=Path)
    refine(parser.parse_args())
