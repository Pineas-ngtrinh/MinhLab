
from __future__ import annotations

import json
import math
import struct
from collections import defaultdict
from pathlib import Path

import numpy as np

OUT = Path(__file__).resolve().parents[2]
RNG = np.random.default_rng(31)


def linear(hex_color):
    rgb = np.array([int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)])
    return np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4).tolist()


class Builder:
    def __init__(self):
        self.doc = {
            'asset': {'version': '2.0', 'generator': 'MinhLab procedural diorama v1',
                      'extras': {'description': 'Original voxel interpretation of the supplied MinhLab art. Not a photogrammetry reconstruction.'}},
            'scene': 0, 'scenes': [{'name': 'MinhLab — Pixel Print Studio', 'nodes': [0]}],
            'nodes': [{'name': 'MinhLab_Root', 'children': []}],
            'meshes': [], 'materials': [], 'accessors': [], 'bufferViews': [],
            'animations': [],
        }
        self.materials = {}
        self.geo = defaultdict(lambda: defaultdict(lambda: [[], [], []]))
        self.binary = bytearray()
        self.primitives = 0
        self.names = {'MinhLab_Root'}

    def material(self, name, color, metal=0, rough=.75, emission=None):
        m = {'name': name, 'pbrMetallicRoughness': {
            'baseColorFactor': linear(color) + [1], 'metallicFactor': metal, 'roughnessFactor': rough}}
        if emission:
            m['emissiveFactor'] = linear(emission)
        self.materials[name] = len(self.doc['materials'])
        self.doc['materials'].append(m)

    def group(self, name, parent=0, position=(0, 0, 0), rotation=None, scale=None, extras=None):
        base_name, suffix = name, 2
        while name in self.names:
            name = f'{base_name}_{suffix}'
            suffix += 1
        self.names.add(name)
        node = {'name': name, 'translation': list(position), 'children': []}
        if rotation is not None:
            node['rotation'] = list(rotation)
        if scale is not None:
            node['scale'] = list(scale)
        if extras:
            node['extras'] = extras
        idx = len(self.doc['nodes'])
        self.doc['nodes'].append(node)
        self.doc['nodes'][parent].setdefault('children', []).append(idx)
        return idx

    def polygon(self, group, material, vertices, normal=None):
        v = np.array(vertices, dtype=float)
        if normal is None:
            n = np.cross(v[1] - v[0], v[2] - v[0])
            n /= np.linalg.norm(n)
        else:
            n = np.array(normal)
        pos, normals, indices = self.geo[group][material]
        offset = len(pos)
        pos.extend(v.tolist())
        normals.extend([n.tolist()] * len(v))
        for i in range(1, len(v) - 1):
            indices.extend([offset, offset + i, offset + i + 1])

    def box(self, group, material, center, size, rotation=None):
        x, y, z = np.array(size) * .5
        vertices = np.array([[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z],
                             [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]])
        if rotation is not None:
            vertices = vertices @ np.array(rotation).T
        vertices += np.array(center)
        for f in [(0, 3, 2, 1), (4, 5, 6, 7), (0, 4, 7, 3),
                  (1, 2, 6, 5), (0, 1, 5, 4), (3, 7, 6, 2)]:
            self.polygon(group, material, vertices[list(f)])

    def beam(self, group, material, a, b, width, depth=None):
        a, b = np.array(a), np.array(b)
        delta = b - a
        height = np.linalg.norm(delta)
        y = delta / height
        auxiliary = np.array([0, 0, 1]) if abs(y[2]) < .95 else np.array([1, 0, 0])
        x = np.cross(y, auxiliary)
        x /= np.linalg.norm(x)
        z = np.cross(x, y)
        self.box(group, material, (a + b) / 2, (width, height, depth or width),
                 np.column_stack([x, y, z]))

    def cylinder(self, group, material, center, radius, length, axis='z', sides=16, inner=0):
        c = np.array(center)

        def v(theta, r, h):
            p = [r * math.cos(theta), r * math.sin(theta), h]
            if axis == 'y':
                p = [p[0], p[2], -p[1]]
            elif axis == 'x':
                p = [p[2], p[1], -p[0]]
            return c + np.array(p)

        for i in range(sides):
            a, b = 2 * math.pi * i / sides, 2 * math.pi * (i + 1) / sides
            self.polygon(group, material, [v(a, radius, -length/2), v(b, radius, -length/2),
                                           v(b, radius, length/2), v(a, radius, length/2)])
            if inner:
                self.polygon(group, material, [v(b, inner, -length/2), v(a, inner, -length/2),
                                               v(a, inner, length/2), v(b, inner, length/2)])
                self.polygon(group, material, [v(a, radius, length/2), v(b, radius, length/2),
                                               v(b, inner, length/2), v(a, inner, length/2)])
                self.polygon(group, material, [v(b, radius, -length/2), v(a, radius, -length/2),
                                               v(a, inner, -length/2), v(b, inner, -length/2)])
            else:
                self.polygon(group, material, [v(a, 0, length/2), v(a, radius, length/2), v(b, radius, length/2)])
                self.polygon(group, material, [v(a, 0, -length/2), v(b, radius, -length/2), v(a, radius, -length/2)])

    def accessor(self, values, kind, target=None):
        dtype = '<u4' if kind == 'INDEX' else '<f4'
        arr = np.asarray(values, dtype=dtype)
        while len(self.binary) % 4:
            self.binary.append(0)
        view = {'buffer': 0, 'byteOffset': len(self.binary), 'byteLength': arr.nbytes}
        if target:
            view['target'] = target
        vid = len(self.doc['bufferViews'])
        self.doc['bufferViews'].append(view)
        self.binary.extend(arr.tobytes())
        accessor = {'bufferView': vid, 'componentType': 5125 if kind == 'INDEX' else 5126,
                    'count': len(arr), 'type': 'SCALAR' if kind == 'INDEX' else kind}
        accessor['min'] = np.atleast_1d(arr.min(axis=0)).tolist()
        accessor['max'] = np.atleast_1d(arr.max(axis=0)).tolist()
        idx = len(self.doc['accessors'])
        self.doc['accessors'].append(accessor)
        return idx

    def animate(self, name, tracks):
        animation = {'name': name, 'samplers': [], 'channels': []}
        for node, path, times, values in tracks:
            sid = len(animation['samplers'])
            animation['samplers'].append({'input': self.accessor(times, 'SCALAR'),
                                          'output': self.accessor(values, 'VEC4' if path == 'rotation' else 'VEC3'),
                                          'interpolation': 'LINEAR'})
            animation['channels'].append({'sampler': sid, 'target': {'node': node, 'path': path}})
        self.doc['animations'].append(animation)

    def export(self, path):
        triangle_count = 0
        for group, materials in self.geo.items():
            primitives = []
            for material, (positions, normals, indices) in materials.items():
                primitives.append({'attributes': {'POSITION': self.accessor(positions, 'VEC3', 34962),
                                                   'NORMAL': self.accessor(normals, 'VEC3', 34962)},
                                   'indices': self.accessor(indices, 'INDEX', 34963),
                                   'material': self.materials[material], 'mode': 4})
                triangle_count += len(indices) // 3
            if primitives:
                self.doc['nodes'][group]['mesh'] = len(self.doc['meshes'])
                self.doc['meshes'].append({'name': self.doc['nodes'][group]['name'], 'primitives': primitives})
                self.primitives += len(primitives)
        for n in self.doc['nodes']:
            if not n.get('children'):
                n.pop('children', None)
        self.doc['buffers'] = [{'byteLength': len(self.binary)}]
        content = json.dumps(self.doc, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        content += b' ' * ((-len(content)) % 4)
        binary = bytes(self.binary) + b'\0' * ((-len(self.binary)) % 4)
        glb = struct.pack('<III', 0x46546c67, 2, 12 + 8 + len(content) + 8 + len(binary))
        glb += struct.pack('<II', len(content), 0x4e4f534a) + content
        glb += struct.pack('<II', len(binary), 0x004e4942) + binary
        path.write_bytes(glb)
        report = {'file': path.name, 'bytes': len(glb), 'triangles': triangle_count,
                  'mesh_primitives': self.primitives, 'nodes': len(self.doc['nodes']),
                  'materials': len(self.doc['materials']), 'animations': [a['name'] for a in self.doc['animations']],
                  'textures': 0, 'external_files': 0, 'units': 'illustrative meters; Y up; mascot faces +Z'}
        (OUT / 'model-info.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
        print(json.dumps(report, ensure_ascii=False, indent=2))


def quat(axis, angle):
    v = np.array(axis, dtype=float)
    v /= np.linalg.norm(v)
    return [*(v * math.sin(angle / 2)), math.cos(angle / 2)]


B = Builder()
for args in [
    ('ink', '111626', .15, .8), ('charcoal', '252B3C', .25, .65), ('metal', '4E586E', .65, .4),
    ('silver', 'ADB7C9', .6, .35), ('white', 'E8EDF6', .1, .7), ('whiteShade', 'BAC5D9', .15, .72),
    ('purple', '7141C6', .3, .5), ('purpleShade', '42277A', .3, .55), ('cyan', '31BDCF', .1, .5),
    ('gold', 'DDA248', .65, .35), ('amber', 'FBB649', .15, .6), ('wood', '88573F', .0, .9),
    ('woodLight', 'A5724F', .0, .85), ('woodDark', '654330', .0, .9),
    ('brown', '985123', .0, .85), ('brownLight', 'BB763D', .0, .8), ('brownDark', '713F23', .0, .85),
    ('skin', 'F0BB85', .0, .86), ('skinLight', 'F6CEA0', .0, .86), ('skinShade', 'DDA16D', .0, .85),
    ('rose', 'CC8272', .0, .85), ('red', 'C62D45', .0, .65), ('eye', '231517', .0, .65),
    ('green', '527246', .0, .92), ('greenLight', '839A51', .0, .9), ('greenDark', '324D39', .0, .95),
    ('floorA', '303953', .2, .64), ('floorB', '35405A', .2, .64), ('floorC', '29324A', .2, .64),
    ('wallA', '273049', .0, .95), ('wallB', '30384E', .0, .95), ('wallC', '222A40', .0, .95),
]:
    B.material(*args)
B.material('lightBlue', '8CA7FF', .0, .35, '8DABFF')
B.material('lightPurple', 'A369FC', .0, .35, 'A369FC')
B.material('lightWarm', 'FFE0A0', .0, .45, 'FFD48B')
B.material('screen', '438CF5', .0, .35, '458CEB')


FONT = {
    'M': ['10001','11011','10101','10001','10001','10001','10001'],
    'I': ['111','010','010','010','010','010','111'],
    'N': ['10001','11001','11001','10101','10011','10011','10001'],
    'H': ['10001','10001','10001','11111','10001','10001','10001'],
    'L': ['1000','1000','1000','1000','1000','1000','1111'],
    'A': ['01110','11011','10001','10001','11111','10001','10001'],
    'B': ['11110','10001','10001','11110','10001','10001','11110'],
    '3': ['1110','0001','0001','0110','0001','0001','1110'],
    'D': ['1110','1001','1001','1001','1001','1001','1110'],
    'P': ['1110','1001','1001','1110','1000','1000','1000'],
    'R': ['1110','1001','1001','1110','1010','1001','1001'],
    'T': ['11111','00100','00100','00100','00100','00100','00100'],
    ' ': ['000'] * 7,
}


def text_mesh(g, text, x, y, z, pixel, material):
    for char in text:
        bitmap = FONT[char]
        for row, line in enumerate(bitmap):
            for col, cell in enumerate(line):
                if cell == '1':
                    B.box(g, material, (x + col * pixel, y - row * pixel, z), (pixel*.95, pixel*.95, pixel*.45))
        x += (len(bitmap[0]) + 1.5) * pixel


def plant(parent, pos, scale=1):
    g = B.group('VoxelPlant', parent, pos, scale=(scale,)*3)
    B.box(g, 'whiteShade', (0, .17, 0), (.4, .34, .4))
    B.box(g, 'charcoal', (0, .345, 0), (.34, .018, .34))
    B.box(g, 'greenDark', (0, .62, 0), (.07, .55, .07))
    for i, (x, y, z) in enumerate([(-.15,.69,0),(.17,.82,.07),(-.1,.99,.02),(.05,1.1,0),(.2,.61,-.1),(-.15,.49,.11)]):
        B.box(g, ['green','greenLight','greenDark'][i % 3], (x, y, z), (.28,.14,.24))
    return g


def small_robot(g, position=(0,0,0), scale=1, material='white'):
    r = B.group('PrintedVoxelRobot', g, position, scale=(scale,)*3)
    for x in [-.105, .105]:
        B.box(r, material, (x,.085,.035), (.14,.17,.2))
    B.box(r, material, (0,.29,0), (.34,.28,.22))
    B.box(r, material, (0,.57,0), (.47,.28,.3))
    for x in [-.145,.145]:
        B.box(r, 'eye', (x,.6,.157), (.064,.085,.017))
    for x in [-.23,.23]:
        B.box(r, material, (x,.3,0), (.12,.23,.15))
    B.box(r, material, (0,.78,0), (.055,.14,.055))
    B.box(r, 'gold', (0,.85,0), (.095,.095,.095))
    return r


def gear(g, pos, radius=.27, material='silver'):
    B.cylinder(g, material, pos, radius*.76, .085, inner=radius*.32, sides=16)
    for i in range(8):
        a = i*math.pi/4
        rot = [[math.cos(a),-math.sin(a),0], [math.sin(a),math.cos(a),0], [0,0,1]]
        B.box(g, material, (pos[0]+math.cos(a)*radius*.85, pos[1]+math.sin(a)*radius*.85,pos[2]),
              (radius*.45,radius*.3,.1), rot)


def spool(parent, pos, material='purple', scale=1, name='FilamentSpool'):
    g = B.group(name, parent, pos, scale=(scale,)*3)
    B.cylinder(g, material, (0,0,0), .27, .28, inner=.07)
    for z in [-.17,.17]:
        B.cylinder(g, 'ink', (0,0,z), .34, .05, inner=.075)
    B.cylinder(g, 'silver', (0,0,.201), .11, .016, inner=.077, sides=12)
    for a in [0, math.pi*.5, math.pi, math.pi*1.5]:
        B.box(g, 'metal', (.23*math.cos(a),.23*math.sin(a),.205), (.07,.045,.016))
    return g


def build_room():
    g = B.group('Room_Static')
    B.box(g,'ink',(0,-.19,0),(10.5,.4,7.2))
    B.box(g,'metal',(0,-.37,0),(10.23,.09,6.96))
    for ix in range(14):
        for iz in range(10):
            mat = ['floorA','floorB','floorC'][int(RNG.integers(3))]
            B.box(g,mat,(-4.86+ix*.746,.025,-3.24+iz*.716),(.727,.06,.697))
    B.box(g,'wallC',(0,2.2,-3.54),(10.5,4.5,.22))
    B.box(g,'wallC',(-5.14,2.2,0),(.22,4.5,7.2))
    for row in range(9):
        for col in range(18):
            x=-4.95+col*.58
            B.box(g,['wallA','wallB','wallC'][int(RNG.integers(3))],(x,.22+row*.48,-3.405),(.558,.458,.045))
        for col in range(12):
            z=-3.3+col*.58
            B.box(g,['wallA','wallB','wallC'][int(RNG.integers(3))],(-5.0,.22+row*.48,z),(.045,.458,.558))
    for x in [-4.95,-1.42,2.1,5.02]:
        B.box(g,'ink',(x,2.22,-3.27),(.11,4.38,.15))
    B.box(g,'ink',(0,4.43,-3.35),(10.5,.12,.28))
    B.box(g,'ink',(-5.06,4.43,0),(.28,.12,7.2))
    B.box(g,'lightPurple',(-5.0,.19,-.2),(.055,.045,6.35))
    B.box(g,'lightPurple',(.1,.19,-3.27),(9.8,.045,.045))
    # Wall sign is actual extruded geometry.
    B.box(g,'ink',(-2.15,3.68,-3.22),(4.45,.94,.14))
    text_mesh(g,'MINHLAB',-4.12,3.99,-3.125,.095,'white')
    text_mesh(g,'3D PRINT',-3.58,3.38,-3.12,.043,'lightBlue')
    B.box(g,'gold',(-2.15,3.19,-3.2),(4.44,.025,.17))
    # Warm pendant-style wall task lights.
    for x, length in [(-3.0,1.8),(2.9,2.5)]:
        B.box(g,'charcoal',(x,4.13,-2.98),(length+.2,.14,.34))
        B.box(g,'lightWarm',(x,4.049,-2.98),(length,.035,.27))
    B.box(g,'charcoal',(-4.83,3.42,.1),(.35,.14,2.25))
    B.box(g,'lightWarm',(-4.82,3.338,.1),(.25,.035,2.05))
    return g


def build_bench():
    g=B.group('Workbench_Back')
    B.box(g,'wood',(.0,1.15,-2.35),(9.48,.2,1.78))
    B.box(g,'woodLight',(.0,1.267,-2.35),(9.52,.033,1.82))
    B.box(g,'woodDark',(.0,1.10,-1.435),(9.48,.11,.07))
    for x in [-4.55,-2.2,.2,2.6,4.55]:
        for z in [-3.05,-1.62]:
            B.box(g,'charcoal',(x,.55,z),(.105,1.08,.105))
    for x in [-3.8,-.9,3.7]:
        B.box(g,'ink',(x,.57,-2.3),(1.28,1.0,1.31))
        for y in [.34,.76]:
            B.box(g,'metal',(x,y,-1.61),(1.2,.35,.06))
            B.box(g,'silver',(x,y+.085,-1.56),(.36,.05,.06))
    B.box(g,'lightPurple',(.0,1.007,-2.6),(8.9,.035,.065))
    # Pegboard and workshop tools, under display shelf.
    B.box(g,'woodDark',(3.13,2.28,-3.16),(2.66,1.52,.1))
    for x in np.arange(1.91,4.4,.16):
        for y in np.arange(1.6,3.01,.16):
            B.box(g,'ink',(float(x),float(y),-3.098),(.038,.038,.017))
    for i,x in enumerate([2.08,2.55,3.04,3.55,4.04]):
        material='silver' if i<3 else 'gold'
        B.box(g,material,(x,2.35,-3.03),(.07,.62,.045))
        B.box(g,material,(x,2.72,-3.03),(.22,.16,.045))
        B.box(g,'woodDark',(x,2.785,-2.999),(.085,.12,.025))
        B.box(g,material,(x,2.0,-3.03),(.1,.11,.055))
    # Elevated shelf.
    B.box(g,'wood',(2.97,3.21,-2.99),(3.6,.13,.76))
    B.box(g,'lightWarm',(2.97,3.13,-2.79),(3.18,.028,.095))
    small_robot(g,(1.55,3.285,-2.99),.65,'white')
    small_robot(g,(2.3,3.285,-2.99),.72,'purple')
    gear(g,(3.16,3.62,-2.93),.34)
    rocket=B.group('PrintedRocket',g,(4.22,3.3,-3.0))
    B.box(rocket,'white',(0,.34,0),(.24,.65,.24))
    B.box(rocket,'red',(0,.76,0),(.15,.17,.15))
    B.box(rocket,'red',(0,.875,0),(.065,.065,.065))
    B.box(rocket,'screen',(0,.43,.126),(.095,.11,.019))
    for x in [-.17,.17]:
        B.box(rocket,'red',(x,.16,0),(.12,.3,.2))
    plant(g,(-4.36,1.3,-2.6),.85)
    plant(g,(4.45,1.3,-2.45),.85)
    return g


def build_printer(name, position, color='purple', scale=1):
    p=B.group(name,position=position,scale=(scale,)*3)
    B.box(p,'ink',(0,.125,0),(1.75,.25,1.35))
    B.box(p,'metal',(0,.25,0),(1.68,.045,1.29))
    B.box(p,'gold',(0,.205,.695),(1.64,.04,.04))
    for x in [-.77,.77]:
        for z in [-.55,.55]:
            B.box(p,'charcoal',(x,.975,z),(.11,1.46,.11))
            B.box(p,'metal',(x-.017,.98,z+.065),(.035,1.39,.015))
    for z in [-.55,.55]:
        B.box(p,'charcoal',(0,1.72,z),(1.78,.14,.16))
    for x in [-.77,.77]:
        B.box(p,'charcoal',(x,1.72,0),(.14,.14,1.2))
    B.box(p,'lightWarm',(0,1.627,-.5),(1.39,.035,.065))
    B.box(p,'metal',(0,.41,0),(1.27,.12,.95))
    B.box(p,'gold',(0,.482,0),(1.35,.035,1.03))
    B.box(p,'ink',(0,.507,0),(1.28,.017,.96))
    for y in [1.39,1.52]:
        B.cylinder(p,'silver',(0,y,.02),.025,1.48,axis='x',sides=8)
    B.box(p,'metal',(-.7,1.455,.02),(.14,.28,.2))
    B.box(p,'metal',(.7,1.455,.02),(.14,.28,.2))
    h=B.group(name+'_Head',p,(0,1.38,.06),extras={'animated':True,'purpose':'Independent print-head translation for animation/scroll control.'})
    B.box(h,'charcoal',(0,0,0),(.36,.33,.28))
    B.box(h,'metal',(0,0,.15),(.3,.25,.035))
    B.box(h,'silver',(0,.01,.177),(.14,.14,.028))
    B.box(h,'ink',(0,.01,.193),(.085,.085,.014))
    B.box(h,'gold',(0,-.205,0),(.14,.09,.14))
    B.box(h,'lightBlue',(0,-.274,0),(.065,.055,.065))
    # A stepped filament tube makes a clear connection to the top spool.
    filament=[(.0,1.59,-.1),(.0,1.9,-.16),(.12,2.08,-.2),(.33,2.16,-.24),(.53,2.1,-.24),(.62,1.94,-.25)]
    for a,b in zip(filament,filament[1:]):
        B.beam(p,'lightPurple' if color=='purple' else 'cyan',a,b,.035)
    roll=spool(p,(.59,1.95,-.28),color,.6,name+'_Spool')
    B.box(p,'metal',(.59,1.78,-.31),(.08,.32,.08))
    B.box(p,'metal',(.46,.117,.713),(.51,.14,.04))
    B.box(p,'screen',(.46,.117,.739),(.39,.095,.014))
    for x,w in [(.33,.055),(.43,.07),(.54,.05)]:
        B.box(p,'lightBlue',(x,.117,.75),(w,.012,.006))
    text_mesh(p,'M',-.63,.19,.727,.025,'whiteShade')
    printed=small_robot(p,(0,.52,.08),.76,'white' if color=='purple' else 'cyan')
    B.animate(name+'_Printing',[
        (h,'translation',[0,1,2,3,4,5,6,7,8],[[x,1.38,.06] for x in [-.38,.38,-.28,.28,-.38,.38,-.28,.28,-.38]]),
        (roll,'rotation',[0,2,4,6,8],[quat((0,0,1),a) for a in [0,math.pi*.5,math.pi,math.pi*1.5,math.pi*2]]),
    ])
    return p,printed


def build_mascot():
    root=B.group('Mascot',position=(1.36,.095,.92),rotation=quat((0,1,0),.15),
                 extras={'description':'Original block-built monkey engineer. Rigid part animations, not a skinned character.'})
    body=B.group('Mascot_Body',root)
    for x in [-.24,.24]:
        B.box(body,'purpleShade',(x,.62,0),(.31,.65,.33))
        B.box(body,'metal',(x,.39,.035),(.35,.39,.36))
        B.box(body,'gold',(x,.28,.045),(.37,.055,.38))
        B.box(body,'lightPurple',(x,.43,.235),(.14,.15,.026))
        B.box(body,'brown',(x,.14,.11),(.38,.22,.47))
        for dx in [-.13,0,.13]:
            B.box(body,'skin',(x+dx,.11,.36),(.118,.2,.18))
    B.box(body,'purpleShade',(0,.98,0),(.71,.35,.42))
    B.box(body,'purple',(0,1.4,0),(.73,.7,.43))
    B.box(body,'metal',(0,1.73,.018),(.62,.16,.43))
    B.box(body,'gold',(0,1.035,.232),(.67,.085,.055))
    B.box(body,'metal',(0,1.48,.259),(.31,.3,.08))
    B.box(body,'lightPurple',(0,1.48,.311),(.21,.21,.035))
    B.box(body,'lightBlue',(0,1.48,.335),(.11,.11,.019))
    # Separate layered coat panels, collar and squared-off split hem.
    for side in [-1,1]:
        x=side*.365
        B.box(body,'white',(x,1.4,.016),(.2,.77,.56))
        B.box(body,'whiteShade',(side*.425,1.04,.015),(.23,.24,.57))
        B.box(body,'white',(side*.46,.9,.02),(.27,.16,.61))
        B.box(body,'white',(side*.27,1.7,.289),(.18,.21,.09))
        B.box(body,'whiteShade',(side*.29,1.61,.35),(.1,.16,.04))
        B.box(body,'gold',(side*.35,1.715,.335),(.075,.055,.03))
        for y in [1.12,1.32]:
            B.box(body,'metal',(side*.37,y,.315),(.042,.042,.025))
        B.box(body,'lightBlue',(side*.425,1.04,.323),(.075,.035,.026))
    B.box(body,'white',(0,1.37,-.245),(.79,.81,.07))
    B.box(body,'whiteShade',(.343,1.46,.345),(.19,.25,.036))
    text_mesh(body,'M',.264,1.544,.375,.03,'red')
    # Left arm rests beside the coat, showing a bright square wrist joint.
    left=B.group('Mascot_LeftArm',root,(-.47,1.69,0),rotation=quat((0,0,1),-.22))
    B.box(left,'white',(0,-.13,0),(.3,.32,.39))
    B.box(left,'purpleShade',(0,-.4,0),(.255,.29,.31))
    B.box(left,'metal',(0,-.59,.02),(.28,.17,.32))
    B.box(left,'lightPurple',(0,-.59,.197),(.14,.1,.025))
    B.box(left,'skin',(0,-.77,.03),(.265,.23,.29))
    for x in [-.08,0,.08]:
        B.box(left,'skinShade',(x,-.84,.192),(.071,.11,.035))
    # Raised right arm is pivoted at the shoulder, so the GLB wave is reusable.
    arm=B.group('Mascot_RightArm',root,(.49,1.7,0),rotation=quat((0,0,1),1.93))
    B.box(arm,'white',(0,-.13,0),(.3,.32,.38))
    B.box(arm,'purpleShade',(0,-.4,0),(.26,.27,.3))
    B.box(arm,'gold',(0,-.51,0),(.285,.06,.33))
    B.box(arm,'metal',(0,-.62,.01),(.27,.17,.33))
    B.box(arm,'lightPurple',(0,-.62,.19),(.14,.11,.023))
    B.box(arm,'skin',(0,-.79,.035),(.25,.22,.29))
    for x in [-.08,0,.08]:
        B.box(arm,'skinShade',(x,-.79,.191),(.069,.19,.02))
    tool=B.group('Mascot_HandheldNozzle',arm,(0,-.88,.04),rotation=quat((0,0,1),-1.93))
    B.box(tool,'ink',(0,.1,0),(.115,.36,.12))
    B.box(tool,'gold',(0,.27,0),(.19,.07,.19))
    B.box(tool,'charcoal',(0,.48,0),(.38,.38,.34))
    B.box(tool,'metal',(0,.48,.18),(.29,.3,.04))
    B.box(tool,'lightPurple',(0,.48,.208),(.07,.22,.026))
    B.box(tool,'gold',(0,.231,.01),(.14,.09,.14))
    B.box(tool,'lightBlue',(0,.15,.01),(.065,.065,.065))
    for y in [.40,.48,.56]:
        B.box(tool,'ink',(-.205,y,0),(.025,.028,.2))
    cable=[(.0,.69,0),(-.05,.85,0),(-.24,.95,0),(-.46,.91,0),(-.64,.74,0)]
    for a,b in zip(cable,cable[1:]):
        B.beam(tool,'lightPurple',a,b,.042)
    # A chunky, stepped tail is recognizable from the reference.
    tail=[(-.25,1.02,-.3),(-.65,.97,-.51),(-.98,1.01,-.54),(-1.2,1.22,-.51),(-1.3,1.51,-.45),(-1.4,1.72,-.42)]
    for i,(a,b) in enumerate(zip(tail,tail[1:])):
        B.beam(body,'brown' if i%2==0 else 'brownDark',a,b,.15)
        B.box(body,'gold',a,(.17,.075,.17))
    B.box(body,'brown',tail[-1],(.3,.26,.3))
    B.box(body,'lightPurple',(-1.4,1.72,-.251),(.16,.14,.023))
    # Cubic head with a detailed pixel mask: eyes, muzzle, smile, ears and layered hair.
    head=B.group('Mascot_Head',root,(0,1.87,0))
    B.box(head,'brown',(0,.57,0),(1.15,1.12,.83))
    B.box(head,'brownDark',(0,.52,-.445),(1.04,.98,.09))
    B.box(head,'brownLight',(0,1.155,-.03),(1.04,.13,.75))
    B.box(head,'brown',(0,1.24,-.075),(.87,.08,.63))
    for pos,size in [((-.1,1.36,-.08),(.15,.2,.15)),((.04,1.44,-.08),(.15,.35,.15)),((.18,1.33,-.08),(.15,.14,.15))]:
        B.box(head,'brownLight',pos,size)
    for side in [-1,1]:
        B.box(head,'brownDark',(side*.69,.6,.025),(.28,.64,.35))
        B.box(head,'skin',(side*.71,.6,.115),(.25,.5,.24))
        B.box(head,'skin',(side*.71,.6,.12),(.35,.3,.25))
        B.box(head,'rose',(side*.72,.6,.255),(.15,.29,.038))
        B.box(head,'skinLight',(side*.72,.87,.11),(.15,.055,.22))
    pixel=.066
    for row in range(15):
        for col in range(15):
            if (row in [0,14] and (col<2 or col>12)) or (row==1 and (col==0 or col==14)):
                continue
            x=(col-7)*pixel
            y=1.05-row*pixel
            mat='skin' if RNG.random()>.13 else 'skinLight'
            # Hair fringe follows a stepped pixel silhouette across the forehead.
            if row==0 or (row==1 and col in [0,1,7,8,13,14]) or (row==2 and col in [0,14]):
                mat=['brown','brownLight','brownDark'][int(RNG.integers(3))]
            B.box(head,mat,(x,y,.437),(pixel,pixel,.055))
    # Muzzle steps protrude from the face, lower than the eyes.
    B.box(head,'skin',(0,.332,.495),(.8,.29,.12))
    B.box(head,'skin',(0,.383,.526),(.91,.14,.11))
    for x in [-.262,.262]:
        B.box(head,'eye',(x,.747,.481),(.132,.226,.031))
        B.box(head,'white',(x+.025,.821,.503),(.061,.061,.017))
        B.box(head,'brownDark',(x,.946,.489),(.17,.056,.03))
    B.box(head,'rose',(0,.562,.582),(.215,.103,.115))
    for x in [-.071,.071]:
        B.box(head,'brownDark',(x,.538,.645),(.037,.032,.018))
    for x,y in [(-.303,.336),(-.248,.286),(-.187,.247),(-.121,.247),(-.055,.247),(.011,.247),(.077,.247),(.143,.247),(.209,.276),(.275,.322)]:
        B.box(head,'eye',(x,y,.593),(.061,.038,.02))
    B.animate('Mascot_Wave',[(arm,'rotation',[0,.5,1,1.5,2,2.5,3,4,6],
                             [quat((0,0,1),a) for a in [1.93,2.13,1.78,2.1,1.82,2.06,1.93,1.93,1.93]])])
    B.animate('Mascot_Look',[(head,'rotation',[0,2,4,6,8],[quat((0,1,0),a) for a in [0,-.1,0,.1,0]])])
    return root


def build_front_table():
    g=B.group('Workbench_Front',position=(-2.76,0,1.68))
    B.box(g,'wood',(0,.9,0),(3.2,.18,1.39))
    B.box(g,'woodLight',(0,1.002,0),(3.23,.03,1.42))
    for x in [-1.36,1.36]:
        for z in [-.47,.47]:
            B.box(g,'charcoal',(x,.43,z),(.12,.87,.12))
    B.box(g,'wallC',(0,1.029,0),(2.82,.022,1.13))
    for x in np.arange(-1.3,1.35,.14):
        B.box(g,'metal',(float(x),1.043,0),(.009,.004,1.03))
    for z in np.arange(-.5,.55,.14):
        B.box(g,'metal',(0,1.043,float(z)),(2.7,.004,.009))
    small_robot(g,(-1.01,1.05,-.15),.66,'purple')
    gear(g,(-.39,1.25,-.25),.2)
    # A vernier caliper and screwdriver on the cutting mat.
    B.box(g,'silver',(.54,1.08,-.05),(.98,.055,.058))
    B.box(g,'metal',(.41,1.11,-.05),(.23,.09,.13))
    B.box(g,'ink',(.42,1.16,-.05),(.14,.018,.08))
    for x in [.09,.42]:
        B.box(g,'silver',(x,1.075,.035),(.035,.055,.22))
    B.box(g,'gold',(.57,1.1,.36),(.51,.09,.12))
    B.box(g,'ink',(.6,1.1,.36),(.11,.105,.14))
    B.box(g,'silver',(.11,1.1,.36),(.38,.034,.034))
    return g


def build_spool_rack():
    g=B.group('FilamentRack',position=(-4.5,0,-.17))
    B.box(g,'wood',(0,.62,0),(.68,.1,1.83))
    for z in [-.78,.78]:
        B.box(g,'metal',(0,.33,z),(.57,.6,.065))
    # Stand spools along the rack, their disc face points toward the entrance.
    for i,(z,color) in enumerate([(-.59,'purple'),(.0,'cyan'),(.59,'amber')]):
        spool(g,(0,1.05,z),color,1.02,'RackSpool_'+str(i))
    return g


def build_computer():
    g=B.group('DesignTerminal',position=(2.78,1.28,-2.09))
    B.box(g,'ink',(0,.035,0),(.53,.065,.34))
    B.box(g,'metal',(0,.27,-.05),(.09,.47,.09))
    B.box(g,'charcoal',(0,.63,-.05),(1.04,.66,.105))
    B.box(g,'wallC',(0,.64,.011),(.95,.56,.022))
    B.box(g,'cyan',(-.415,.86,.029),(.048,.025,.006))
    # Wireframe cube rendered with real beams on the screen.
    points=np.array([[-.18,.49,.029],[.12,.49,.029],[.12,.74,.029],[-.18,.74,.029],
                     [-.08,.56,.029],[.22,.56,.029],[.22,.81,.029],[-.08,.81,.029]])
    for a,b in [(0,1),(1,2),(2,3),(3,0),(4,5),(5,6),(6,7),(7,4),(0,4),(1,5),(2,6),(3,7)]:
        B.beam(g,'lightBlue',points[a],points[b],.012)
    B.box(g,'charcoal',(0,.031,.43),(.79,.061,.25))
    for i in range(9):
        for j in range(3):
            B.box(g,'metal',(-.32+i*.08,.071,.36+j*.074),(.059,.018,.046))
    return g


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    build_room()
    build_bench()
    build_printer('Printer_A',(-2.86,1.29,-2.29),'purple',1)
    build_printer('Printer_B',(-.57,1.29,-2.35),'cyan',.89)
    build_mascot()
    build_front_table()
    build_spool_rack()
    build_computer()
    plant(0,(4.38,.08,.2),1.18)
    # Camera positions are explicit authoring references, not an animation that overrides the host camera.
    B.doc['extras']={'cameraPresets':{
        'hero':{'position':[11,8.5,13],'target':[0,1.55,-.25]},
        'printer':{'position':[.3,4.1,3.8],'target':[-2.1,2.15,-2.1]},
        'mascot':{'position':[5.2,3.8,6.8],'target':[1.15,1.8,.8]},
        'products':{'position':[1.1,4.3,5.3],'target':[-2.75,1.38,1.6]}},
        'integration':'Load with GLTFLoader/useGLTF. Provide host lighting. Animation clips are optional.'}
    B.export(OUT/'minhlab-lab-v1.glb')


if __name__=='__main__':
    main()
