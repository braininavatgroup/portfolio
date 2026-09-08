"""Offline UV-atlas repair. Normal builds consume its checked-in output files.

Authoring dependencies: numpy==2.4.2, Pillow==12.1.1.
"""
import argparse
import hashlib
import io
import json
import struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def repack_texture(image, uv, triangles, size=4096, padding=16):
    height, width = image.shape[:2]
    parents = list(range(len(uv)))

    def root(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i

    # Meshy splits vertices at UV seams, so connected indices identify charts.
    for triangle in triangles:
        parent = root(int(triangle[0]))
        for vertex in triangle[1:]:
            parents[root(int(vertex))] = parent
    labels = {}
    charts = []
    for triangle in triangles:
        parent = root(int(triangle[0]))
        labels.setdefault(parent, len(labels) + 1)
        charts.append(labels[parent])
    charts = np.asarray(charts)
    mask_image = Image.new('I', (width, height))
    draw = ImageDraw.Draw(mask_image)
    for triangle, chart in zip(triangles, charts):
        draw.polygon([(float(uv[i, 0] * width), float(uv[i, 1] * height)) for i in triangle], fill=int(chart))
    mask = np.asarray(mask_image)
    rectangles = []
    dimensions = np.array([width, height])
    for chart in np.unique(charts):
        vertices = np.unique(triangles[charts == chart])
        points = uv[vertices] * dimensions
        low = np.maximum(np.floor(points.min(axis=0)).astype(int), 0)
        high = np.minimum(np.ceil(points.max(axis=0)).astype(int) + 1, dimensions)
        w, h = high - low
        rectangles.append((chart, vertices, low, w, h))
    rectangles.sort(key=lambda item: -item[4])
    shelves = []
    atlas = np.zeros((size, size, 3), dtype=np.uint8)
    result = uv.copy()
    for chart, vertices, low, w, h in rectangles:
        W, H = w + padding * 2, h + padding * 2
        if W > size:
            raise ValueError('Padded patch does not fit in the atlas.')
        for shelf in shelves:
            if shelf[2] >= H and shelf[0] + W <= size:
                break
        else:
            y = sum(row[2] for row in shelves)
            if y + H > size:
                raise ValueError('Padded patches do not fit in the atlas.')
            shelf = [0, y, H]
            shelves.append(shelf)
        x, y = shelf[:2]
        shelf[0] += W
        colors = np.zeros((H, W, 3), dtype=np.uint8)
        known = np.zeros((H, W), dtype=bool)
        crop = mask[low[1]:low[1] + h, low[0]:low[0] + w] == chart
        # Boundary texels can already contain another patch's colors. Extend
        # clean interior colors over that boundary and into the new gutter.
        interior = crop.copy()
        for axis in (0, 1):
            for direction in (-1, 1):
                interior &= np.roll(crop, direction, axis)
        if not interior.any():
            interior = crop
        known[padding:padding + h, padding:padding + w] = interior
        colors[padding:padding + h, padding:padding + w] = image[low[1]:low[1] + h, low[0]:low[0] + w]
        for _ in range(padding + 4):
            old_known, old_colors = known.copy(), colors.copy()
            for axis, direction in ((0, -1), (0, 1), (1, -1), (1, 1)):
                valid = np.roll(old_known, direction, axis)
                if axis == 0:
                    valid[0 if direction == 1 else -1, :] = False
                else:
                    valid[:, 0 if direction == 1 else -1] = False
                fill = ~known & valid
                colors[fill] = np.roll(old_colors, direction, axis)[fill]
                known[fill] = True
        atlas[y:y + H, x:x + W] = colors
        result[vertices] = (uv[vertices] * dimensions - low + [x + padding, y + padding]) / size
    return atlas, result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', default='assets/avatar-sources/bradley-quiet-portrait.glb')
    parser.add_argument('--output-prefix', default='assets/avatar-sources/bradley-texture-repair')
    args = parser.parse_args()
    source = Path(args.source).read_bytes()
    json_length = struct.unpack_from('<I', source, 12)[0]
    gltf = json.loads(source[20:20 + json_length])
    binary = source[28 + json_length:]

    def accessor(index):
        spec = gltf['accessors'][index]
        view = gltf['bufferViews'][spec['bufferView']]
        components = {'SCALAR': 1, 'VEC2': 2}[spec['type']]
        dtype = np.dtype({5126: '<f4', 5125: '<u4', 5123: '<u2'}[spec['componentType']])
        offset = view.get('byteOffset', 0) + spec.get('byteOffset', 0)
        return np.ndarray((spec['count'], components), dtype=dtype, buffer=binary, offset=offset,
                          strides=(view.get('byteStride', dtype.itemsize * components), dtype.itemsize)).copy()

    primitive = gltf['meshes'][0]['primitives'][0]
    uv = accessor(primitive['attributes']['TEXCOORD_0'])
    triangles = accessor(primitive['indices']).reshape(-1, 3)
    image_view = gltf['bufferViews'][gltf['images'][0]['bufferView']]
    offset = image_view.get('byteOffset', 0)
    image = np.array(Image.open(io.BytesIO(binary[offset:offset + image_view['byteLength']])).convert('RGB'))
    atlas, result = repack_texture(image, uv, triangles)
    prefix = args.output_prefix
    Image.fromarray(atlas).save(prefix + '.webp', lossless=True, method=6)
    result.astype('<f4').tofile(prefix + '-uv.bin')
    Path(prefix + '.json').write_text(json.dumps({
        'sourceSha256': hashlib.sha256(source).hexdigest(),
        'sourceUvSha256': hashlib.sha256(uv.astype('<f4').tobytes()).hexdigest(),
        'atlasSize': 4096, 'padding': 16,
    }, indent=2) + '\n')


if __name__ == '__main__':
    main()
