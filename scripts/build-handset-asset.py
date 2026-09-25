#!/usr/bin/env python3
"""
Bake the Sketchfab "iPhone 18 Pro Max - High Quality 3D Model" download into
assets/handset.glb, the asset behind <PhoneReveal>.

The download is a display scene, not a runtime asset. This script turns one
into the other:

  - it drops the studio ground plane and erases the embossed maker's mark.
    The mark is geometry here rather than a texture, and it is cut from the
    back panel rather than laid on top of it, so deleting it would leave a
    hole in the shape of the mark. Its triangles are given the surrounding
    panel's material instead, which leaves one continuous unmarked surface;
  - it undoes the ~5 degree lean the scene was posed with, so the device is
    axis aligned and a rotation prop means what it says;
  - it re-centres on the body's bounding box and scales the body to 0.72
    units tall, matching the other assets' order of magnitude;
  - it turns the device to face +Z, so the content plane needs no rotation
    and therefore no mirrored UVs;
  - it renames every material after the part it covers. The originals carry
    a model designation, and a name is the one piece of a model that ends up
    quoted in application code;
  - it shrinks the textures. Three materials carry maps: a grille weave, a
    mesh noise and a photograph of a flash lens, at 1024 square and 4 MB
    together, for parts that are a fraction of a unit across. None of that
    detail survives to a pixel.

Everything the runtime needs to know about the result is written to
asset.extras, and src/handset/geometry.ts repeats it as constants.

Usage:  python3 build_handset.py <download-dir> <out.glb>
"""
import json
import struct
import sys
import os
import base64
import io
import numpy as np
from PIL import Image

# ---------------------------------------------------------------- input map

GROUND_PLANE_NODE = 22          # a 22 x 23 unit studio floor

# The embossed maker's mark on the back. It is not a decal on the panel: the
# modeller cut the shape out of the back panel and filled it with its own
# mesh and its own material, and the two share every boundary vertex to six
# decimal places. So deleting the node would leave a hole in the exact shape
# of the mark -- the mark again, in negative -- while giving its triangles the
# surrounding panel's material leaves one continuous, unmarked surface.
LOGO_NODE = 14
LOGO_ABSORBED_INTO = '17ProMax_color2'

# Original material name -> what the part actually is. Nothing here is a
# rename for taste: the originals are all "17ProMax_<something>", and that
# designation would end up in the palette groups below and, through them, in
# user code.
MATERIAL_NAMES = {
    '17ProMax_color':       'chassis',
    '17ProMax_color2':      'chassis-back',
    '17ProMax_color3':      'chassis-edge',
    '17ProMax_Black2':      'trim',
    '17ProMax_black1':      'camera-plate',
    '17ProMax_1111':        'grille-frame',
    '17ProMax_2222':        'grille',
    '17ProMax_Black2.001':  'cutout',
    '17ProMax_2112.001':    'cutout-inner',
    '17ProMax_glass':       'glass',
    '17ProMax_Lens':        'lens',
    '17ProMax_Lens2.001':   'lens-front',
    '17ProMax_G':           'port-contact',
    'Material.001':         'display-panel',
    'Material.002':         'flash',
    'material':             'flash-mesh',
}

# Longest side each texture is resized to. The parts they cover are between
# 0.03 and 0.22 units across once the model is scaled, so a 1024 map is three
# orders of magnitude more texel than the screen will ever ask for.
TEXTURE_MAX = {
    '17ProMax_2222_baseColor.png': 96,
    '17ProMax_2222_metallicRoughness.png': 32,
    'material_baseColor.png': 64,
    'Material.002_baseColor.jpeg': 64,
}
# A normal map on a flash lens 0.03 units across. Dropped rather than shrunk.
TEXTURE_DROP = {'material_normal.jpeg'}

BODY_HEIGHT = 0.72              # the target size, in world units
SCREEN_CLEARANCE = 0.0008       # how far the content plane floats off the glass

# --------------------------------------------------------------- glTF reader

COMPONENT = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2),
             5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_accessor(g, buf, index):
    a = g['accessors'][index]
    bv = g['bufferViews'][a['bufferView']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    fmt, size = COMPONENT[a['componentType']]
    n = NCOMP[a['type']]
    stride = bv.get('byteStride') or size * n
    out = np.empty((a['count'], n), dtype=np.float64)
    for i in range(a['count']):
        out[i] = struct.unpack_from('<' + fmt * n, buf, off + i * stride)
    return out, a['componentType']


def node_matrix(node):
    if 'matrix' in node:
        return np.array(node['matrix']).reshape(4, 4).T
    m = np.eye(4)
    if 'scale' in node:
        m = m @ np.diag(list(node['scale']) + [1.0])
    if 'rotation' in node:
        x, y, z, w = node['rotation']
        m = np.array([
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 0],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 0],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), 0],
            [0, 0, 0, 1]]) @ m
    if 'translation' in node:
        t = np.eye(4)
        t[:3, 3] = node['translation']
        m = t @ m
    return m


# ------------------------------------------------------------------- builder

class Out:
    """Accumulates a single-buffer glTF."""

    def __init__(self):
        self.blob = bytearray()
        self.views = []
        self.accessors = []

    def _view(self, data, target=None):
        while len(self.blob) % 4:
            self.blob.append(0)
        off = len(self.blob)
        self.blob += data
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target:
            v['target'] = target
        self.views.append(v)
        return len(self.views) - 1

    def vec(self, arr, kind, target=34962):
        arr = np.asarray(arr, dtype=np.float32)
        view = self._view(arr.tobytes(), target)
        self.accessors.append({
            'bufferView': view, 'componentType': 5126, 'count': len(arr),
            'type': kind, 'min': arr.min(0).tolist(), 'max': arr.max(0).tolist(),
        })
        return len(self.accessors) - 1

    def indices(self, arr):
        arr = np.asarray(arr, dtype=np.uint32)
        dtype, ctype = (np.uint16, 5123) if arr.max(initial=0) < 65536 else (np.uint32, 5125)
        view = self._view(arr.astype(dtype).tobytes(), 34963)
        self.accessors.append({
            'bufferView': view, 'componentType': ctype, 'count': len(arr),
            'type': 'SCALAR', 'min': [int(arr.min(initial=0))], 'max': [int(arr.max(initial=0))],
        })
        return len(self.accessors) - 1

    def image(self, data, mime):
        view = self._view(data)
        return {'bufferView': view, 'mimeType': mime}


def write_glb(doc, blob, path):
    doc['buffers'] = [{'byteLength': len(blob)}]
    j = json.dumps(doc, separators=(',', ':')).encode()
    j += b' ' * (-len(j) % 4)
    b = bytes(blob) + b'\0' * (-len(blob) % 4)
    header = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(j) + 8 + len(b))
    with open(path, 'wb') as f:
        f.write(header)
        f.write(struct.pack('<II', len(j), 0x4E4F534A) + j)
        f.write(struct.pack('<II', len(b), 0x004E4942) + b)


# ---------------------------------------------------------------------- main

def main(src_dir, out_path):
    g = json.load(open(os.path.join(src_dir, 'scene.gltf')))
    buf = open(os.path.join(src_dir, 'scene.bin'), 'rb').read()

    # Every mesh node in this download is a direct, untransformed child of one
    # parent that carries the whole pose, so the raw vertex data is already
    # level -- dropping that parent's matrix IS the levelling.
    keep = [i for i, n in enumerate(g['nodes'])
            if 'mesh' in n and i != GROUND_PLANE_NODE]

    parts = []
    for i in keep:
        prim = g['meshes'][g['nodes'][i]['mesh']]['primitives'][0]
        pos, _ = read_accessor(g, buf, prim['attributes']['POSITION'])
        nrm = read_accessor(g, buf, prim['attributes']['NORMAL'])[0] \
            if 'NORMAL' in prim['attributes'] else None
        uv = read_accessor(g, buf, prim['attributes']['TEXCOORD_0'])[0] \
            if 'TEXCOORD_0' in prim['attributes'] else None
        idx = read_accessor(g, buf, prim['indices'])[0].astype(np.uint32).ravel()
        name = g['materials'][prim['material']]['name']
        if i == LOGO_NODE:
            name = LOGO_ABSORBED_INTO
        parts.append({'node': i, 'pos': pos, 'nrm': nrm, 'uv': uv,
                      'idx': idx, 'material': name})

    allpos = np.vstack([p['pos'] for p in parts])
    lo, hi = allpos.min(0), allpos.max(0)
    centre = (lo + hi) / 2
    scale = BODY_HEIGHT / (hi[1] - lo[1])
    print(f"body {np.round(hi - lo, 5)}  centre {np.round(centre, 5)}  scale {scale:.6f}")

    # Centre, then turn to face +Z. The front-facing camera sits at the
    # model's -Z, so a half turn about Y puts the display on +Z; being a half
    # turn it is exactly a sign flip on x and z, with no rounding to argue
    # about later.
    def place(v):
        w = (v - centre) * scale
        w[:, 0] *= -1
        w[:, 2] *= -1
        return w

    def place_dir(v):
        w = v.copy()
        w[:, 0] *= -1
        w[:, 2] *= -1
        return w

    for p in parts:
        p['pos'] = place(p['pos'])
        if p['nrm'] is not None:
            p['nrm'] = place_dir(p['nrm'])

    # --- the display rectangle
    panel = next(p for p in parts if p['material'] == 'Material.001')
    plo, phi = panel['pos'].min(0), panel['pos'].max(0)
    glass = next(p for p in parts if p['material'] == '17ProMax_glass')
    screen = {
        'width':  round(float(phi[0] - plo[0]), 5),
        'height': round(float(phi[1] - plo[1]), 5),
        'x':      round(float((phi[0] + plo[0]) / 2), 5),
        'y':      round(float((phi[1] + plo[1]) / 2), 5),
        'z':      round(float(glass['pos'][:, 2].max() + SCREEN_CLEARANCE), 5),
    }
    print("screen", screen, " aspect", round(screen['height'] / screen['width'], 4))

    # --- textures
    out = Out()
    images, image_of_uri = [], {}
    for im in g['images']:
        uri = im['uri']
        base = os.path.basename(uri)
        if base in TEXTURE_DROP:
            image_of_uri[uri] = None
            continue
        pic = Image.open(os.path.join(src_dir, uri))
        cap = TEXTURE_MAX.get(base)
        if cap and max(pic.size) > cap:
            pic = pic.resize((min(cap, pic.size[0]), min(cap, pic.size[1])), Image.LANCZOS)
        keep_alpha = pic.mode in ('LA', 'RGBA', 'PA')
        pic = pic.convert('RGBA' if keep_alpha else 'RGB')
        blob = io.BytesIO()
        if keep_alpha:
            pic.save(blob, 'PNG', optimize=True)
            mime = 'image/png'
        else:
            pic.save(blob, 'JPEG', quality=82)
            mime = 'image/jpeg'
        image_of_uri[uri] = len(images)
        images.append(out.image(blob.getvalue(), mime))
        print(f"  texture {base}: {pic.size} {len(blob.getvalue())} bytes")

    textures, texture_of = [], {}

    def texture_ref(src_tex):
        """Re-point a texture at the possibly-resized image, or drop it."""
        if src_tex is None:
            return None
        uri = g['images'][g['textures'][src_tex['index']]['source']]['uri']
        image = image_of_uri.get(uri)
        if image is None:
            return None
        if image not in texture_of:
            texture_of[image] = len(textures)
            textures.append({'sampler': 0, 'source': image})
        return {'index': texture_of[image]}

    # --- materials, one per part, renamed
    used = []
    for p in parts:
        if p['material'] not in used:
            used.append(p['material'])
    materials, material_index = [], {}
    for name in used:
        src = next(m for m in g['materials'] if m['name'] == name)
        pbr = dict(src.get('pbrMetallicRoughness', {}))
        for key in ('baseColorTexture', 'metallicRoughnessTexture'):
            if key in pbr:
                ref = texture_ref(pbr[key])
                if ref:
                    pbr[key] = ref
                else:
                    del pbr[key]
        m = {'name': MATERIAL_NAMES.get(name, name), 'pbrMetallicRoughness': pbr,
             'doubleSided': False}
        if 'normalTexture' in src:
            ref = texture_ref(src['normalTexture'])
            if ref:
                m['normalTexture'] = ref
        if src.get('alphaMode'):
            m['alphaMode'] = src['alphaMode']
        material_index[name] = len(materials)
        materials.append(m)

    # --- one mesh, one primitive per material
    prims = []
    for name in used:
        group = [p for p in parts if p['material'] == name]
        pos = np.vstack([p['pos'] for p in group])
        has_n = all(p['nrm'] is not None for p in group)
        has_uv = all(p['uv'] is not None for p in group)
        nrm = np.vstack([p['nrm'] for p in group]) if has_n else None
        uv = np.vstack([p['uv'] for p in group]) if has_uv else None
        idx, base = [], 0
        for p in group:
            idx.append(p['idx'] + base)
            base += len(p['pos'])
        attrs = {'POSITION': out.vec(pos, 'VEC3')}
        if nrm is not None:
            attrs['NORMAL'] = out.vec(nrm, 'VEC3')
        if uv is not None:
            attrs['TEXCOORD_0'] = out.vec(uv, 'VEC2')
        prims.append({'attributes': attrs, 'indices': out.indices(np.concatenate(idx)),
                      'material': material_index[name]})
        print(f"  {MATERIAL_NAMES.get(name, name):<15} {len(pos):6d} verts"
              f"  {sum(len(p['idx']) for p in group) // 3:6d} tris")

    doc = {
        'asset': {
            'version': '2.0',
            'generator': 'react-widgets build_handset.py',
            'extras': {
                'screen': screen,
                'bodyHeight': BODY_HEIGHT,
                'source': 'iPhone 18 Pro Max - High Quality 3D Model by Pro Animator, CC-BY-4.0',
                'note': ('levelled, centred, scaled and turned to face +Z; studio floor '
                         'removed and the embossed maker\'s mark erased into the back '
                         'panel; materials renamed after the part they cover; textures '
                         'reduced. See NOTICE.'),
            },
        },
        'scene': 0,
        'scenes': [{'nodes': [0]}],
        'nodes': [{'name': 'Handset', 'mesh': 0}],
        'meshes': [{'name': 'Handset', 'primitives': prims}],
        'materials': materials,
        'accessors': out.accessors,
        'bufferViews': out.views,
    }
    if images:
        doc['images'] = images
        doc['textures'] = textures
        doc['samplers'] = [{'magFilter': 9729, 'minFilter': 9987,
                            'wrapS': 10497, 'wrapT': 10497}]

    write_glb(doc, out.blob, out_path)
    print(f"wrote {out_path}  {os.path.getsize(out_path)} bytes")
    print(json.dumps(screen))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
