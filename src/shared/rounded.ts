import * as THREE from 'three';

/*
 * A plane with the display's own rounded corners.
 *
 * Every device here has a rounded screen aperture, and everything drawn on it
 * was a square rectangle — so the content ran out past the curve and sat on
 * the bezel at each corner. Obvious once seen, and invisible in a wireframe.
 *
 * The DOM panel solves this with `border-radius`, which the homography
 * carries along with everything else. The meshes cannot, so they get their
 * geometry cut to shape instead: the backing plane, the image texture when
 * `screen` is a URL, and the glass over the laptop's display.
 *
 * `ShapeGeometry` triangulates in XY with the normal on +Z, which is the same
 * orientation `planeGeometry` produces, so this drops straight in. Its UVs
 * are not: they come out in the shape's own coordinates, so a texture would
 * be offset by half the panel and scaled wrongly. They are rebuilt below.
 */
export function roundedPlane(
  width: number,
  height: number,
  radius: number,
  segments = 8,
): THREE.BufferGeometry {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (r === 0) return new THREE.PlaneGeometry(width, height);

  const w = width / 2;
  const h = height / 2;
  const shape = new THREE.Shape();

  // Anticlockwise from the start of the bottom edge, so the winding matches
  // what a plane would give and the face is not culled.
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.absarc(w - r, -h + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(w, h - r);
  shape.absarc(w - r, h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-w + r, h);
  shape.absarc(-w + r, h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-w, -h + r);
  shape.absarc(-w + r, -h + r, r, Math.PI, (3 * Math.PI) / 2, false);

  const geometry = new THREE.ShapeGeometry(shape, segments);

  const position = geometry.attributes.position;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = (position.getX(i) + w) / width;
    uv[i * 2 + 1] = (position.getY(i) + h) / height;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

  return geometry;
}
