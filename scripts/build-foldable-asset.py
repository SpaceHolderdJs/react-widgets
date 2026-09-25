"""
Turn the Sketchfab "iPhone Duo" download into an asset this package can ship.

The source is four identical copies of a book-fold phone, posed ~49 degrees
open, with every transform living in a 223-node hierarchy. What the runtime
wants instead is: one copy, baked flat open, hinge on the Y axis at the
origin, and two wing groups whose rotation.y IS the fold angle — so a frame
costs two rotations and nothing else, exactly as laptop.glb does.

It also strips what the model's CC-BY licence cannot cover: the meshes named
"apple-logo", the manufacturer's name baked into material names, and the
texture's two screen regions, which carry a full iOS home screen (app icons,
wordmark) and a stock photograph.
"""

import json
import io
import struct
import sys
import numpy as np
from PIL import Image

SRC = '/mnt/user-data/uploads/iphone_duo_3d_model_-_by_pikkme_studio'
OUT = '/home/claude/pkgassets/phone.glb'

# The copy we keep, and the logo we drop, as node indices in the source.
PHONE_ROOT = 3
LOGO_NODE = 8
SPINE_NODE = 44           # middle-block: the hinge spine, stays put
WING_A_NODE = 4           # camera-side
WING_B_NODE = 47          # right-side, carries the inner display
FOLDABLE_NODE = 54        # the display spanning the crease
SCREEN_NODE = 51          # the inner display on wing B

# Coloured regions of the atlas: a full iOS home screen and a stock photo.
# Neither is licensed to us by the model's CC-BY, so both are blanked.
BLANK_REGIONS = [(582, 4, 1019, 784), (7, 14, 335, 491)]
SCREEN_OFF = (10, 11, 13)

MATERIAL_NAMES = {
    'apple-material-sides': 'chassis',
    'apple-material-sides-lighter': 'chassis-light',
    'apple-material-sides-darker': 'chassis-dark',
    'apple-material': 'frame',
    'less-black': 'trim',
    'glass': 'glass',
    'screen': 'display',
    'black': 'black',
}

gltf = json.load(open(f'{SRC}/scene.gltf'))
blob = open(f'{SRC}/scene.bin', 'rb').read()

DT = {5120: 'i1', 5121: 'u1', 5122: 'i2', 5123: 'u2', 5125: 'u4', 5126: 'f4'}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def accessor(i):
    a = gltf['accessors'][i]
    bv = gltf['bufferViews'][a['bufferView']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n, nc, dt = a['count'], NC[a['type']], DT[a['componentType']]
    packed = np.dtype(dt).itemsize * nc
    stride = bv.get('byteStride') or packed
    if stride == packed:
        return np.frombuffer(blob, dtype=dt, count=n * nc, offset=off).reshape(n, nc).astype(np.float64)
    return np.array(
        [np.frombuffer(blob, dtype=dt, count=nc, offset=off + k * stride) for k in range(n)],
        dtype=np.float64,
    )


def local_matrix(node):
    M = np.eye(4)
    if 'matrix' in node:
        return np.array(node['matrix']).reshape(4, 4).T
    if 'scale' in node:
        M[:3, :3] = M[:3, :3] @ np.diag(node['scale'])
    if 'rotation' in node:
        x, y, z, w = node['rotation']
        M[:3, :3] = np.array([
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ]) @ M[:3, :3]
    if 'translation' in node:
        M[:3, 3] = node['translation']
    return M


world = {}


def resolve(i, parent=np.eye(4)):
    M = parent @ local_matrix(gltf['nodes'][i])
    world[i] = M
    for c in gltf['nodes'][i].get('children', []):
        resolve(c, M)


for s in gltf['scenes'][gltf.get('scene', 0)]['nodes']:
    resolve(s)


def subtree(root, skip=()):
    out, stack = [], [root]
    while stack:
        k = stack.pop()
        if k in skip:
            continue
        out.append(k)
        stack += gltf['nodes'][k].get('children', [])
    return out


def ry(deg):
    t = np.radians(deg)
    c, s = np.cos(t), np.sin(t)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


# ---------------------------------------------------------------- geometry

def gather(nodes):
    """Flatten a set of nodes into world-space triangle soup, per material."""
    per_mat = {}
    for k in nodes:
        node = gltf['nodes'][k]
        if 'mesh' not in node:
            continue
        M = world[k]
        N = np.linalg.inv(M[:3, :3]).T
        for prim in gltf['meshes'][node['mesh']]['primitives']:
            mat = prim.get('material', 0)
            pos = accessor(prim['attributes']['POSITION'])
            pos = (M[:3, :3] @ pos.T).T + M[:3, 3]
            nrm = (N @ accessor(prim['attributes']['NORMAL']).T).T if 'NORMAL' in prim['attributes'] else np.zeros_like(pos)
            uv = accessor(prim['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in prim['attributes'] else np.zeros((len(pos), 2))
            idx = accessor(prim['indices'])[:, 0].astype(np.int64) if 'indices' in prim else np.arange(len(pos))
            per_mat.setdefault(mat, []).append((pos, nrm, uv, idx))
    return per_mat


skip = set(subtree(LOGO_NODE))
print(f'dropping the maker mark: {len(skip)} node(s)')

wing_a = set(subtree(WING_A_NODE, skip))
wing_b = set(subtree(WING_B_NODE, skip))
spine = set(subtree(SPINE_NODE, skip))
fold = set(subtree(FOLDABLE_NODE, skip))
keep = set(subtree(PHONE_ROOT, skip))
print(f'keeping {len(keep)} of {len(gltf["nodes"])} nodes (one of four copies)')

# Hinge: the spine's own centre, as a vertical line through XZ.
sp = np.vstack([accessor(p['attributes']['POSITION']) @ world[k][:3, :3].T + world[k][:3, 3]
                for k in spine if 'mesh' in gltf['nodes'][k]
                for p in gltf['meshes'][gltf['nodes'][k]['mesh']]['primitives']])
HX, HZ = sp[:, 0].mean(), sp[:, 2].mean()


def bearing(points):
    d = points[:, [0, 2]] - np.array([HX, HZ])
    r = np.linalg.norm(d, axis=1)
    k = r > r.max() * 0.35
    ang = np.arctan2(d[k, 1], d[k, 0])
    return np.degrees(np.arctan2(np.sin(ang).mean(), np.cos(ang).mean()))


def points_of(nodes):
    return np.vstack([accessor(p['attributes']['POSITION']) @ world[k][:3, :3].T + world[k][:3, 3]
                      for k in nodes if 'mesh' in gltf['nodes'][k]
                      for p in gltf['meshes'][gltf['nodes'][k]['mesh']]['primitives']])


BA, BB = bearing(points_of(wing_a)), bearing(points_of(wing_b))
print(f'hinge at x={HX:.5f} z={HZ:.5f}; wings bear {BA:.2f} and {BB:.2f} ({abs((BA-BB+540)%360-180):.1f} deg apart)')

# Baked flat open, with the display facing +Z.
#
# The extra half turn is what keeps the runtime honest: three's PlaneGeometry
# faces +Z, so a display on +Z means the content plane needs no rotation and
# therefore no mirrored UVs. Rotating the plane to meet a -Z display would
# flip the content left-to-right, and un-flipping it is two more places to get
# wrong. The phone's camera is staged on +Z to match; the laptop, whose lid
# opens the other way, stages on -Z.
FLIP = ry(180)
ROT_A, ROT_B = FLIP @ ry(BA), FLIP @ ry(BB - 180)

groups = {'WingA': gather(wing_a), 'WingB': gather(wing_b), 'Spine': gather(spine)}

# The crease display belongs to whichever wing each triangle sits on.
fold_geo = gather(fold)
for mat, chunks in fold_geo.items():
    for pos, nrm, uv, idx in chunks:
        tri = idx.reshape(-1, 3)
        cen = pos[tri].mean(axis=1)
        d = cen[:, [0, 2]] - np.array([HX, HZ])
        ang = np.degrees(np.arctan2(d[:, 1], d[:, 0]))
        to_a = np.abs((ang - BA + 540) % 360 - 180)
        to_b = np.abs((ang - BB + 540) % 360 - 180)
        for side, mask in (('WingA', to_a <= to_b), ('WingB', to_a > to_b)):
            sub = tri[mask].ravel()
            if len(sub):
                groups[side].setdefault(mat, []).append((pos, nrm, uv, sub))
print(f'crease display split: {sum(len(v) for v in fold_geo.values())} chunk(s) divided between the wings')


def bake(chunks, R):
    """Weld a material's chunks into one indexed mesh, hinge-centred and rotated."""
    P, N, U, I = [], [], [], []
    base = 0
    for pos, nrm, uv, idx in chunks:
        used, remap = np.unique(idx, return_inverse=True)
        p = pos[used].copy()
        p[:, 0] -= HX
        p[:, 2] -= HZ
        P.append(p @ R.T)
        N.append(nrm[used] @ R.T)
        U.append(uv[used])
        I.append(remap + base)
        base += len(used)
    return (np.vstack(P).astype(np.float32), np.vstack(N).astype(np.float32),
            np.vstack(U).astype(np.float32), np.concatenate(I).astype(np.uint32))


src_mat_names = {i: m.get('name') for i, m in enumerate(gltf['materials'])}
baked = {}
for name, R in (('WingA', ROT_A), ('WingB', ROT_B), ('Spine', FLIP)):
    baked[name] = {m: bake(c, R) for m, c in groups[name].items()}

tris = sum(len(v[3]) // 3 for g in baked.values() for v in g.values())
print(f'baked {tris} triangles across {sum(len(g) for g in baked.values())} primitives')

# Centre vertically and record the display rectangle, flat open.
allp = np.vstack([v[0] for g in baked.values() for v in g.values()])
Y_MID = (allp[:, 1].min() + allp[:, 1].max()) / 2
for g in baked.values():
    for v in g.values():
        v[0][:, 1] -= Y_MID
allp = np.vstack([v[0] for g in baked.values() for v in g.values()])
print(f'bounds after centring: x {allp[:,0].min():.4f}..{allp[:,0].max():.4f}  '
      f'y {allp[:,1].min():.4f}..{allp[:,1].max():.4f}  z {allp[:,2].min():.4f}..{allp[:,2].max():.4f}')

# The display plane, measured from the baked geometry: every triangle on a
# "display" material whose face normal points at +Z, which is the front once
# the phone is flat open. Both wings carry one; together they are the screen.
disp = []
for name in ('WingA', 'WingB'):
    for mat, (P, N, U, I) in baked[name].items():
        if src_mat_names[mat] != 'screen':
            continue
        tri = I.reshape(-1, 3)
        v0, v1, v2 = P[tri[:, 0]], P[tri[:, 1]], P[tri[:, 2]]
        fn = np.cross(v1 - v0, v2 - v0)
        fn = fn / np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
        face = (fn[:, 2] > 0.97)
        if face.any():
            disp.append(P[tri[face].ravel()])
disp = np.vstack(disp)
SW = float(disp[:, 0].max() - disp[:, 0].min())
SH = float(disp[:, 1].max() - disp[:, 1].min())
SX = float((disp[:, 0].max() + disp[:, 0].min()) / 2)
SY = float((disp[:, 1].max() + disp[:, 1].min()) / 2)
# Sit just proud of the glass so the panel is never z-fought by it.
SZ = float(disp[:, 2].max() + 0.0008)
print(f'display rect, flat open: {SW:.5f} x {SH:.5f} at x={SX:.5f} y={SY:.5f} z={SZ:.5f} '
      f'(aspect {SW/SH:.3f})')

# ---------------------------------------------------------------- texture

tex = Image.open(f'{SRC}/textures/screen_baseColor.png').convert('RGB')
arr = np.asarray(tex).astype(np.uint8).copy()
for (x0, y0, x1, y1) in BLANK_REGIONS:
    arr[y0:y1 + 1, x0:x1 + 1] = SCREEN_OFF
buf = io.BytesIO()
Image.fromarray(arr).resize((512, 512), Image.LANCZOS).save(buf, format='WEBP', quality=88, method=6)
TEXTURE = buf.getvalue()
print(f'texture: two branded regions blanked, re-encoded to {len(TEXTURE)/1024:.0f} KB webp')

# ------------------------------------------------------------------- glb

out = {
    'asset': {
        'version': '2.0',
        'extras': {
            'source': gltf['asset']['extras']['source'],
            'author': gltf['asset']['extras']['author'],
            'license': 'CC-BY-4.0',
            'modified': ('one of four copies kept; maker mark meshes removed; branded screen '
                         'regions blanked from the texture; baked flat open with a Y-axis hinge '
                         'at the origin and one group per wing'),
            'hinge': [0, 0, 0],
            'screen': {'width': SW, 'height': SH, 'centerX': SX, 'centerY': SY, 'z': SZ},
        },
    },
    'extensionsUsed': ['EXT_texture_webp'],
    'extensionsRequired': ['EXT_texture_webp'],
    'scene': 0,
}

bin_out = bytearray()
views, accs, meshes, mats = [], [], [], []


def add_view(data, target=None):
    while len(bin_out) % 4:
        bin_out.append(0)
    v = {'buffer': 0, 'byteOffset': len(bin_out), 'byteLength': len(data)}
    if target:
        v['target'] = target
    bin_out.extend(data)
    views.append(v)
    return len(views) - 1


def add_acc(array, ctype, atype, target, minmax=False):
    v = add_view(array.tobytes(), target)
    a = {'bufferView': v, 'componentType': ctype, 'count': len(array), 'type': atype}
    if minmax:
        a['min'] = array.min(axis=0).tolist()
        a['max'] = array.max(axis=0).tolist()
    accs.append(a)
    return len(accs) - 1


src_mats = gltf['materials']
mat_index = {}
for i, m in enumerate(src_mats):
    pbr = dict(m.get('pbrMetallicRoughness', {}))
    name = MATERIAL_NAMES.get(m.get('name'), m.get('name', f'material{i}'))
    nm = {'name': name, 'doubleSided': m.get('doubleSided', False)}
    if 'baseColorTexture' in pbr:
        pbr['baseColorTexture'] = {'index': 0}
    nm['pbrMetallicRoughness'] = pbr
    if 'alphaMode' in m:
        nm['alphaMode'] = m['alphaMode']
    mats.append(nm)
    mat_index[i] = len(mats) - 1

for name in ('WingA', 'WingB', 'Spine'):
    prims = []
    for mat, (P, N, U, I) in sorted(baked[name].items()):
        prims.append({
            'attributes': {
                'POSITION': add_acc(P, 5126, 'VEC3', 34962, minmax=True),
                'NORMAL': add_acc(N, 5126, 'VEC3', 34962),
                'TEXCOORD_0': add_acc(U, 5126, 'VEC2', 34962),
            },
            'indices': add_acc(I.reshape(-1, 1), 5125, 'SCALAR', 34963),
            'material': mat_index[mat],
        })
    meshes.append({'name': name, 'primitives': prims})

out['images'] = [{'mimeType': 'image/webp', 'bufferView': add_view(TEXTURE)}]
out['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]
out['textures'] = [{'sampler': 0, 'extensions': {'EXT_texture_webp': {'source': 0}}}]
out['bufferViews'] = views
out['accessors'] = accs
out['meshes'] = meshes
out['materials'] = mats
# Each wing is a bare pivot at the hinge with the mesh hanging beneath it.
# The indirection matters: quantisation writes its de-quantise translate and
# scale onto whichever node holds the mesh, and a pivot carrying a
# translation no longer rotates about the hinge. Keeping the pivots empty
# means rotation.y stays the fold angle whatever the asset pipeline does.
out['nodes'] = [
    {'name': 'Phone', 'children': [1, 3, 5]},
    {'name': 'WingA', 'children': [2]},     # rotation.y opens this wing
    {'name': 'WingAMesh', 'mesh': 0},
    {'name': 'WingB', 'children': [4]},     # rotation.y opens the other
    {'name': 'WingBMesh', 'mesh': 1},
    {'name': 'Spine', 'mesh': 2},
]
out['scenes'] = [{'nodes': [0]}]
out['buffers'] = [{'byteLength': len(bin_out)}]

js = json.dumps(out, separators=(',', ':')).encode()
while len(js) % 4:
    js += b' '
while len(bin_out) % 4:
    bin_out.append(0)
glb = b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(bin_out))
glb += struct.pack('<II', len(js), 0x4E4F534A) + js
glb += struct.pack('<II', len(bin_out), 0x004E4942) + bytes(bin_out)
open(OUT, 'wb').write(glb)
print(f'\nwrote {OUT}  {len(glb)/1024:.0f} KB')
