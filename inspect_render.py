"""Read back the exported GLB, validate its structure, and render its actual triangles.

This is an independent CPU z-buffer preview, not an AI-generated illustration.
It deliberately uses only numpy + Pillow so that QA is reproducible offline.
"""
import copy
import json
import math
import struct
from pathlib import Path

import numpy as np
# pyrefly: ignore [missing-import]
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent


def read_glb(path):
    raw=path.read_bytes()
    magic,version,size=struct.unpack_from('<III',raw)
    assert magic==0x46546C67 and version==2 and size==len(raw)
    length,kind=struct.unpack_from('<II',raw,12)
    assert kind==0x4E4F534A and length%4==0
    doc=json.loads(raw[20:20+length])
    offset=20+length
    blen,bkind=struct.unpack_from('<II',raw,offset)
    assert bkind==0x004E4942 and blen%4==0
    binary=raw[offset+8:offset+8+blen]
    assert len(binary)>=doc['buffers'][0]['byteLength']
    return doc,binary


def access(doc,binary,index):
    a=doc['accessors'][index]
    view=doc['bufferViews'][a['bufferView']]
    dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
    width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    start=view.get('byteOffset',0)+a.get('byteOffset',0)
    arr=np.frombuffer(binary,dtype=dtype,count=a['count']*width,offset=start)
    return arr if width==1 else arr.reshape(-1,width)


def matrix(node):
    if 'matrix' in node:
        return np.array(node['matrix']).reshape(4,4).T
    x,y,z,w=node.get('rotation',[0,0,0,1])
    r=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],
                [2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],
                [2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])
    m=np.eye(4)
    m[:3,:3]=r@np.diag(node.get('scale',[1,1,1]))
    m[:3,3]=node.get('translation',[0,0,0])
    return m


def animate(doc,binary,seconds):
    result=copy.deepcopy(doc)
    for clip in result.get('animations',[]):
        for channel in clip['channels']:
            s=clip['samplers'][channel['sampler']]
            times=access(doc,binary,s['input'])
            values=access(doc,binary,s['output'])
            t=seconds%float(times[-1])
            i=min(max(int(np.searchsorted(times,t,side='right'))-1,0),len(times)-2)
            p=float((t-times[i])/(times[i+1]-times[i]))
            a,b=values[i].copy(),values[i+1].copy()
            target=channel['target']
            if target['path']=='rotation':
                dot=float(np.dot(a,b))
                if dot<0:
                    b=-b
                    dot=-dot
                if dot>.9995:
                    value=a+(b-a)*p
                    value/=np.linalg.norm(value)
                else:
                    theta=math.acos(min(1,dot))
                    value=(math.sin((1-p)*theta)*a+math.sin(p*theta)*b)/math.sin(theta)
            else:
                value=a+(b-a)*p
            result['nodes'][target['node']][target['path']]=value.tolist()
    return result


def world_triangles(doc,binary):
    triangles=[]
    normals=[]
    materials=[]
    positions={}
    def visit(index,parent):
        node=doc['nodes'][index]
        m=parent@matrix(node)
        positions[node['name']]=m[:3,3].tolist()
        if 'mesh' in node:
            normal_matrix=np.linalg.inv(m[:3,:3]).T
            for p in doc['meshes'][node['mesh']]['primitives']:
                pos=access(doc,binary,p['attributes']['POSITION'])
                nor=access(doc,binary,p['attributes']['NORMAL'])
                idx=access(doc,binary,p['indices']).reshape(-1,3)
                transformed=pos@m[:3,:3].T+m[:3,3]
                transformed_normals=nor@normal_matrix.T
                transformed_normals/=np.linalg.norm(transformed_normals,axis=1)[:,None]
                triangles.extend(transformed[idx])
                normals.extend(transformed_normals[idx[:,0]])
                materials.extend([p['material']]*len(idx))
        for child in node.get('children',[]):
            visit(child,m)
    for root in doc['scenes'][doc.get('scene',0)]['nodes']:
        visit(root,np.eye(4))
    return np.asarray(triangles),np.asarray(normals),np.asarray(materials),positions


def validate(doc,binary):
    for view in doc['bufferViews']:
        assert view.get('byteOffset',0)%4==0
        assert view.get('byteOffset',0)+view['byteLength']<=len(binary)
    for i,a in enumerate(doc['accessors']):
        data=access(doc,binary,i)
        assert len(data)==a['count'] and np.isfinite(data).all()
        assert np.allclose(np.atleast_1d(data.min(axis=0)),a['min'])
        assert np.allclose(np.atleast_1d(data.max(axis=0)),a['max'])
    for mesh in doc['meshes']:
        for p in mesh['primitives']:
            pos=access(doc,binary,p['attributes']['POSITION'])
            n=access(doc,binary,p['attributes']['NORMAL'])
            idx=access(doc,binary,p['indices'])
            assert idx.max()<len(pos) and len(idx)%3==0
            assert np.allclose(np.linalg.norm(n,axis=1),1,atol=.0001)
            tris=pos[idx.reshape(-1,3)]
            geom=np.cross(tris[:,1]-tris[:,0],tris[:,2]-tris[:,0])
            assert (np.linalg.norm(geom,axis=1)>1e-9).all()
            assert (np.einsum('ij,ij->i',geom,n[idx[::3]])>0).all(), 'Incorrect normal/winding'
    incoming=[0]*len(doc['nodes'])
    for node in doc['nodes']:
        if 'rotation' in node:
            assert abs(np.linalg.norm(node['rotation'])-1)<1e-5
        for child in node.get('children',[]):
            incoming[child]+=1
    assert max(incoming)<=1
    assert len({n['name'] for n in doc['nodes']})==len(doc['nodes']), 'Names must be unique for animation tracks'
    for animation in doc['animations']:
        assert animation['channels']
        for channel in animation['channels']:
            sampler=animation['samplers'][channel['sampler']]
            t=access(doc,binary,sampler['input'])
            values=access(doc,binary,sampler['output'])
            assert np.all(np.diff(t)>0) and len(t)==len(values)
            if channel['target']['path']=='rotation':
                assert np.allclose(np.linalg.norm(values,axis=1),1,atol=1e-5)
    tris,_,_,positions=world_triangles(doc,binary)
    moved=animate(doc,binary,1.0)
    moving_tris,_,_,moving_positions=world_triangles(moved,binary)
    assert np.max(np.abs(tris-moving_tris))>.1, 'Animation must change the actual mesh'
    report={
        'result':'PASS', 'checks':['GLB header/chunk alignment','buffer bounds','accessor values',
        'triangle indices','non-degenerate triangles','normal length and winding','unique animation node names',
        'node ownership','animation times and quaternion normalization','animation changes real geometry'],
        'triangles':len(tris),'bounds':[tris.min(axis=(0,1)).tolist(),tris.max(axis=(0,1)).tolist()],
        'animation_max_world_displacement_at_1s':float(np.max(np.abs(tris-moving_tris))),
        'note':'Internal structural checks; not the official Khronos glTF Validator. Next.js/browser integration not executed in this environment.'}
    (ROOT/'validation-report.json').write_text(json.dumps(report,indent=2))
    return report


def frame(eye,target):
    eye,target=np.array(eye),np.array(target)
    forward=target-eye
    forward/=np.linalg.norm(forward)
    right=np.cross(forward,[0,1,0])
    right/=np.linalg.norm(right)
    up=np.cross(right,forward)
    return np.array([right,up,forward])


def raster_depth(projected,width,height,colors=None):
    depth=np.full((height,width),np.inf,dtype=np.float32)
    out=np.zeros((height,width,3),dtype=np.float32) if colors is not None else None
    owner=np.full((height,width),-1,dtype=np.int32)
    # Orthographic triangle rasterization, with exact z-buffer occlusion.
    for ti,tri in enumerate(projected):
        x0=max(0,int(math.floor(tri[:,0].min())))
        x1=min(width-1,int(math.ceil(tri[:,0].max())))
        y0=max(0,int(math.floor(tri[:,1].min())))
        y1=min(height-1,int(math.ceil(tri[:,1].max())))
        if x0>x1 or y0>y1:
            continue
        ax,ay,az=tri[0]; bx,by,bz=tri[1]; cx,cy,cz=tri[2]
        denom=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
        if abs(denom)<1e-7:
            continue
        xx=np.arange(x0,x1+1,dtype=np.float32)[None,:]+.5
        yy=np.arange(y0,y1+1,dtype=np.float32)[:,None]+.5
        u=((by-cy)*(xx-cx)+(cx-bx)*(yy-cy))/denom
        v=((cy-ay)*(xx-cx)+(ax-cx)*(yy-cy))/denom
        w=1-u-v
        z=u*az+v*bz+w*cz
        part=depth[y0:y1+1,x0:x1+1]
        mask=(u>=-1e-6)&(v>=-1e-6)&(w>=-1e-6)&(z<part)
        if not mask.any():
            continue
        part[mask]=z[mask]
        owner[y0:y1+1,x0:x1+1][mask]=ti
        if out is not None:
            out[y0:y1+1,x0:x1+1][mask]=colors[ti]
    return depth,out,owner


def render(doc,binary,eye,target,path,width=1440,height=1050,zoom=1,seconds=0):
    if seconds:
        doc=animate(doc,binary,seconds)
    tri,norm,mat,_=world_triangles(doc,binary)
    basis=frame(eye,target)
    world_to_view=(tri-np.array(target))@basis.T
    # Fit the complete model or crop in intentionally for the detail camera.
    span=np.ptp(world_to_view[:,:,:2],axis=(0,1))
    scale=min(width*.91/span[0],height*.91/span[1])*zoom
    center=(world_to_view[:,:,:2].min(axis=(0,1))+world_to_view[:,:,:2].max(axis=(0,1)))/2 if zoom==1 else np.zeros(2)
    projected=world_to_view.copy()
    projected[:,:,0]=(world_to_view[:,:,0]-center[0])*scale+width/2
    projected[:,:,1]=-(world_to_view[:,:,1]-center[1])*scale+height/2
    keep=norm@(-basis[2])>1e-6
    tri,norm,mat,projected=tri[keep],norm[keep],mat[keep],projected[keep]
    all_tri,_,_,_=world_triangles(doc,binary)
    light_eye=[-3.0,10,8.0]
    light_target=[0,1.0,-.3]
    light_basis=frame(light_eye,light_target)
    shadow_size=1100
    ls=66.0
    lp=(all_tri-np.array(light_target))@light_basis.T
    lp[:,:,0]=lp[:,:,0]*ls+shadow_size/2
    lp[:,:,1]=-lp[:,:,1]*ls+shadow_size/2
    shadow,_,_=raster_depth(lp,shadow_size,shadow_size)
    base=np.array([m['pbrMetallicRoughness']['baseColorFactor'][:3] for m in doc['materials']])
    emissive=np.array([m.get('emissiveFactor',[0,0,0]) for m in doc['materials']])
    key=np.maximum(0,norm@(-light_basis[2]))
    fill_direction=np.array([.65,.5,-.2]); fill_direction/=np.linalg.norm(fill_direction)
    fill=np.maximum(0,norm@fill_direction)
    hemi=.43+.15*np.maximum(norm[:,1],0)
    colors=base[mat]*(hemi[:,None]*np.array([.84,.88,1.07])+key[:,None]*np.array([1.55,1.33,1.07])+fill[:,None]*np.array([.3,.26,.65]))
    colors+=emissive[mat]*2.2
    depth,rgb,owner=raster_depth(projected,width,height,colors)
    occupied=owner>=0
    ys,xs=np.nonzero(occupied)
    # Reconstruct the exact world point at every visible pixel for shadows and local lights.
    vx=(xs+.5-width/2)/scale+center[0]
    vy=-(ys+.5-height/2)/scale+center[1]
    world=np.stack([vx,vy,depth[ys,xs]],axis=1)@basis+np.array(target)
    lworld=(world-np.array(light_target))@light_basis.T
    sx=np.round(lworld[:,0]*ls+shadow_size/2).astype(int)
    sy=np.round(-lworld[:,1]*ls+shadow_size/2).astype(int)
    occlusion=np.zeros(len(xs))
    for dx,dy in [(0,0),(-1,0),(1,0),(0,-1),(0,1),(-2,-1),(2,1)]:
        qx=np.clip(sx+dx,0,shadow_size-1)
        qy=np.clip(sy+dy,0,shadow_size-1)
        occlusion+=(lworld[:,2]>shadow[qy,qx]+.065)
    occlusion/=7
    index=owner[ys,xs]
    rgb[ys,xs]-=base[mat[index]]*key[index,None]*np.array([1.55,1.33,1.07])*occlusion[:,None]*.84
    for pos,color,strength in [([-2.8,2.75,-2.4],[1,.58,.17],.95),([2.9,3.2,-2.6],[1,.52,.17],1.2),
                               ([.0,.4,-2.2],[.28,.12,1],.55),([2.8,2.7,1.2],[.42,.35,1],.3)]:
        delta=np.array(pos)-world
        dist=np.linalg.norm(delta,axis=1)
        direction=delta/np.maximum(dist[:,None],.01)
        facing=np.maximum(0,np.einsum('ij,ij->i',norm[index],direction))
        irradiance=strength/(.55+dist*dist)*facing
        rgb[ys,xs]+=base[mat[index]]*irradiance[:,None]*np.array(color)
    # A small screen-space contact effect clarifies corners without changing geometry.
    safe_depth=np.where(occupied,depth,1e4)
    contact=np.zeros_like(depth)
    for dy,dx in [(3,0),(-3,0),(0,3),(0,-3),(6,6),(-6,-6),(6,-6),(-6,6)]:
        other=np.roll(safe_depth,(dy,dx),axis=(0,1))
        diff=safe_depth-other
        contact+=((diff>.045)&(diff<.6)).astype(float)
    rgb[occupied]*=(1-np.minimum(contact[occupied],5)*.028)[:,None]
    # ACES filmic tone mapping and sRGB output.
    rgb=np.maximum(rgb,0)
    rgb=(rgb*(2.51*rgb+.03))/(rgb*(2.43*rgb+.59)+.14)
    rgb=np.clip(rgb,0,1)
    rgb=np.where(rgb<=.0031308,rgb*12.92,1.055*rgb**(1/2.4)-.055)
    # Uniform studio backdrop, not a composited reference image.
    yy,xx=np.mgrid[:height,:width]
    radial=np.clip(1-np.sqrt(((xx-width*.48)/width)**2+((yy-height*.45)/height)**2),0,1)
    background=np.array([9,13,29])[None,None,:]+radial[:,:,None]*np.array([16,18,28])
    output=rgb*255
    output[~occupied]=background[~occupied]
    # Minimal bloom only from emissive surfaces.
    emission_mask=np.zeros((height,width,3),dtype=np.uint8)
    em=emissive[mat[index]]
    emission_mask[ys,xs]=np.clip(em*145,0,255).astype(np.uint8)
    glow=np.array(Image.fromarray(emission_mask).filter(ImageFilter.GaussianBlur(7)),dtype=float)
    output+=glow*.28
    Image.fromarray(np.clip(output,0,255).astype(np.uint8)).save(path)
    return {'path':str(path),'size':[width,height],'rendered_triangles':len(tri)}


if __name__=='__main__':
    doc,binary=read_glb(ROOT/'minhlab-lab-v1.glb')
    # Meaningful node names are generated deterministically even for repeated props.
    print(json.dumps(validate(doc,binary),indent=2))
    print(render(doc,binary,[11,8.5,13],[0,1.55,-.25],ROOT/'minhlab-lab-preview.png'))
    print(render(doc,binary,[5.2,3.8,6.8],[1.15,1.8,.8],ROOT/'minhlab-mascot-detail.png',width=1100,height=1000,zoom=1.9))
