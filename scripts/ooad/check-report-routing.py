#!/usr/bin/env python3
"""Check explicit native connector paths against unrelated rectangular node interiors."""
from pathlib import Path
import xml.etree.ElementTree as E,json
import argparse
parser=argparse.ArgumentParser(description='Conservative native connector versus node-interior scan; visual QA is still required.')
parser.add_argument('artifact',type=Path,nargs='?',default=Path(__file__).resolve().parents[2]/'docs/ooad/exports/minhlab-ooad-day-du-theo-mau-2026-11-07.drawio')
parser.add_argument('--json-output',type=Path)
args=parser.parse_args();p=args.artifact
r=E.parse(p).getroot();errors=[];cross=[]
def style(c):return dict(v.split('=',1) for v in c.get('style','').split(';') if '=' in v)
def intersects(a,b,rect):
 x,y,w,h=rect;lo=0.;hi=1.
 for av,dv,mn,mx in [(a[0],b[0]-a[0],x+3,x+w-3),(a[1],b[1]-a[1],y+3,y+h-3)]:
  if abs(dv)<1e-9:
   if not mn<av<mx:return False
  else:
   l=(mn-av)/dv;u=(mx-av)/dv
   if l>u:l,u=u,l
   lo=max(lo,l);hi=min(hi,u)
   if lo>=hi:return False
 return lo<hi
for num,page in enumerate(r.findall('diagram'),1):
 cells=page.findall('.//mxCell');by={c.get('id'):c for c in cells};boxes={}
 for c in cells:
  if c.get('vertex')!='1' or c.get('parent')!='1':continue
  g=c.find('mxGeometry')
  if g is None:continue
  sty=c.get('style','');key=c.get('id')
  if 'text;' in sty or key=='system' or key.startswith('frame') or 'shape=cube' in sty:continue
  boxes[key]=tuple(float(g.get(v,0)) for v in ['x','y','width','height'])
 for e in cells:
  if e.get('edge')!='1' or not e.get('source') or not e.get('target'):continue
  a=e.get('source');b=e.get('target');sty=style(e)
  if a not in boxes or b not in boxes:continue
  x,y,w,h=boxes[a];xx,yy,ww,hh=boxes[b]
  start=(x+w*float(sty.get('exitX',.5)),y+h*float(sty.get('exitY',.5)))
  end=(xx+ww*float(sty.get('entryX',.5)),yy+hh*float(sty.get('entryY',.5)))
  points=[start]+[(float(pt.get('x')),float(pt.get('y'))) for pt in e.findall('./mxGeometry/Array/mxPoint')]+[end]
  for key,box in boxes.items():
   if key in [a,b]:continue
   qx,qy,qw,qh=box
   # Decorative child shapes inside an endpoint are intentional.
   if any(qx>=bx and qy>=byy and qx+qw<=bx+bw and qy+qh<=byy+bh for bx,byy,bw,bh in [boxes[a],boxes[b]]):continue
   if any(intersects(v,z,box) for v,z in zip(points,points[1:])):
    cross.append({'page':num,'name':page.get('name'),'edge':e.get('id'),'source':a,'target':b,'crosses':key})
print('POTENTIAL NODE CROSSINGS',len(cross))
for x in cross[:60]:print(x)
if args.json_output:args.json_output.write_text(json.dumps(cross,ensure_ascii=False,indent=2)+'\n')
raise SystemExit(1 if cross else 0)
