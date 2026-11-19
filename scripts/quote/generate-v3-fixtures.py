from pathlib import Path
import sys,json,base64,hashlib,tempfile
import numpy as np
import argparse
parser=argparse.ArgumentParser(description='Generate portable synthetic STL fixtures using reviewed Python v3 inference.')
parser.add_argument('--model-dir',type=Path,required=True)
parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[2]/'src/lib/quote/test/fixtures/v3-python.json')
args=parser.parse_args()
model_dir=args.model_dir
sys.path.insert(0,str(model_dir))
from test_model import box_triangles,write_stl
from geometry import extract_geometry
from predict import predict_components,mesh_issues
from pricing import calculate_quote
model=json.loads((model_dir/'model_v3.json').read_text())
# Triangulate an extruded T profile to exercise elevated downward faces/support and varying sections.
profile=[(-5,0),(5,0),(5,30),(25,30),(25,40),(-25,40),(-25,30),(-5,30)]
def cross(a,b,c): return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
ids=list(range(len(profile)));tri=[]
while len(ids)>3:
 for k,b in enumerate(ids):
  a,c=ids[k-1],ids[(k+1)%len(ids)]
  if cross(profile[a],profile[b],profile[c])<=0: continue
  def inside(p): return min(cross(profile[a],profile[b],p),cross(profile[b],profile[c],p),cross(profile[c],profile[a],p))>=0
  if any(inside(profile[d]) for d in ids if d not in (a,b,c)): continue
  tri.append((a,b,c));ids.pop(k);break
 else: raise ValueError('ear clipping failed')
tri.append(tuple(ids))
verts=np.array([(x,y,z) for y in (0,20) for x,z in profile],dtype=float);n=len(profile)
faces=[]
# CCW in XZ points toward -Y.
for a,b,c in tri: faces.extend([(a,b,c),(n+c,n+b,n+a)])
for a in range(n):
 b=(a+1)%n
 faces.extend([(a,n+a,n+b),(a,n+b,b)])
t_shape=verts[faces]
assert not any(mesh_issues(t_shape).values()),mesh_issues(t_shape)
shapes=[('box',box_triangles()),('oriented-box',box_triangles()[:,:,[2,1,0]][:,::-1]),('support-T',t_shape),('translated-ascii',box_triangles()+[123,-45,12])]
result={'sourceModelSha256':hashlib.sha256((model_dir/'model_v3.json').read_bytes()).hexdigest(),'generator':'generate-v3-fixtures.py; Python v3 geometry/predict/pricing, synthetic shapes only','shapes':[]}
with tempfile.TemporaryDirectory() as tmp:
 for name,t in shapes:
  p=Path(tmp)/'shape.stl';write_stl(p,t)
  if name.endswith('ascii'):
   p.write_text('solid box\n'+''.join('facet normal 0 0 0\nouter loop\n'+''.join('vertex '+' '.join(map(str,v))+'\n' for v in face)+'endloop\nendfacet\n' for face in t)+'endsolid box\n')
  g=extract_geometry(p);g.pop('sha256');g.pop('feature_extraction_version')
  expected=[]
  for mat,webmat in [('PLA','PLA'),('PETG_HF','PETG'),('TPU_95A_HF','TPU')]:
   for infill in [15,40,80]:
    for scale in [.5,1,1.5]:
     grams,minutes=predict_components(model,g,mat,infill,scale)
     expected.append({'material':webmat,'infill':infill/100,'scale':scale,'grams':grams,'minutes':minutes,**calculate_quote(grams,minutes,model['fixed_pricing']).as_dict()})
  result['shapes'].append({'name':name,'stlBase64':base64.b64encode(p.read_bytes()).decode(),'geometry':g,'expected':expected})
p=args.output;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(result,indent=2)+'\n')
print('Generated',len(shapes)*27,'Python reference scenarios')
