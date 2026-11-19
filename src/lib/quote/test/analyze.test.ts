import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  analyzeStl,
  scaleMeshFeatures,
  StlParseError,
  type MeshFeatures,
} from '../stl/analyze';

type Point = readonly [number, number, number];
type Triangle = readonly [Point, Point, Point];

function makeBinaryStl(triangles: readonly Triangle[]): Uint8Array {
  const bytes = new Uint8Array(84 + triangles.length * 50);
  const view = new DataView(bytes.buffer);
  new TextEncoder().encodeInto('solid binary header is still binary', bytes.subarray(0, 80));
  view.setUint32(80, triangles.length, true);
  triangles.forEach((triangle, triangleIndex) => {
    const offset = 84 + triangleIndex * 50;
    view.setFloat32(offset, 0, true);
    view.setFloat32(offset + 4, 0, true);
    view.setFloat32(offset + 8, 0, true);
    triangle.forEach((point, pointIndex) => {
      const pointOffset = offset + 12 + pointIndex * 12;
      view.setFloat32(pointOffset, point[0], true);
      view.setFloat32(pointOffset + 4, point[1], true);
      view.setFloat32(pointOffset + 8, point[2], true);
    });
    view.setUint16(offset + 48, 0, true);
  });
  return bytes;
}

function makeAsciiStl(triangles: readonly Triangle[]): Uint8Array {
  const lines = ['solid fixture'];
  for (const triangle of triangles) {
    lines.push(' facet normal 0 0 0', '  outer loop');
    for (const point of triangle) {
      lines.push('   vertex ' + point[0] + ' ' + point[1] + ' ' + point[2]);
    }
    lines.push('  endloop', ' endfacet');
  }
  lines.push('endsolid fixture');
  return new TextEncoder().encode(lines.join('\n'));
}

function orientOutward(triangle: Triangle, center: Point): Triangle {
  const [a, b, c] = triangle;
  const ab: Point = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac: Point = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const normal: Point = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  const faceCenter: Point = [
    (a[0] + b[0] + c[0]) / 3,
    (a[1] + b[1] + c[1]) / 3,
    (a[2] + b[2] + c[2]) / 3,
  ];
  const outward: Point = [
    faceCenter[0] - center[0],
    faceCenter[1] - center[1],
    faceCenter[2] - center[2],
  ];
  const dot = normal[0] * outward[0] + normal[1] * outward[1] + normal[2] * outward[2];
  return dot >= 0 ? triangle : [a, c, b];
}

function makeCubeTriangles(side = 10): Triangle[] {
  const n = side;
  const raw: Triangle[] = [
    [[0, 0, 0], [0, n, 0], [n, n, 0]],
    [[0, 0, 0], [n, n, 0], [n, 0, 0]],
    [[0, 0, n], [n, 0, n], [n, n, n]],
    [[0, 0, n], [n, n, n], [0, n, n]],
    [[0, 0, 0], [n, 0, 0], [n, 0, n]],
    [[0, 0, 0], [n, 0, n], [0, 0, n]],
    [[0, n, 0], [n, n, n], [n, n, 0]],
    [[0, n, 0], [0, n, n], [n, n, n]],
    [[0, 0, 0], [0, 0, n], [0, n, n]],
    [[0, 0, 0], [0, n, n], [0, n, 0]],
    [[n, 0, 0], [n, n, n], [n, 0, n]],
    [[n, 0, 0], [n, n, 0], [n, n, n]],
  ];
  return raw.map((triangle) => orientOutward(triangle, [n / 2, n / 2, n / 2]));
}

function makeIcosphereTriangles(radius: number, subdivisions: number): Triangle[] {
  const t = (1 + Math.sqrt(5)) / 2;
  const vertices: Point[] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map((point) => {
    const length = Math.hypot(point[0], point[1], point[2]);
    return [point[0] * radius / length, point[1] * radius / length, point[2] * radius / length];
  });
  let faces: Array<[number, number, number]> = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  for (let level = 0; level < subdivisions; level += 1) {
    const midpointCache = new Map<string, number>();
    const midpoint = (left: number, right: number): number => {
      const key = Math.min(left, right) + ':' + Math.max(left, right);
      const cached = midpointCache.get(key);
      if (cached !== undefined) {
        return cached;
      }
      const a = vertices[left];
      const b = vertices[right];
      const x = (a[0] + b[0]) / 2;
      const y = (a[1] + b[1]) / 2;
      const z = (a[2] + b[2]) / 2;
      const length = Math.hypot(x, y, z);
      const index = vertices.length;
      vertices.push([x * radius / length, y * radius / length, z * radius / length]);
      midpointCache.set(key, index);
      return index;
    };

    const nextFaces: Array<[number, number, number]> = [];
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b);
      const bc = midpoint(b, c);
      const ca = midpoint(c, a);
      nextFaces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = nextFaces;
  }

  return faces.map(([a, b, c]) =>
    orientOutward([vertices[a], vertices[b], vertices[c]], [0, 0, 0]),
  );
}

function makeCylinderTriangles(radius: number, height: number, segments: number): Triangle[] {
  const triangles: Triangle[] = [];
  const center: Point = [0, 0, height / 2];
  for (let index = 0; index < segments; index += 1) {
    const angleA = (2 * Math.PI * index) / segments;
    const angleB = (2 * Math.PI * (index + 1)) / segments;
    const bottomA: Point = [radius * Math.cos(angleA), radius * Math.sin(angleA), 0];
    const bottomB: Point = [radius * Math.cos(angleB), radius * Math.sin(angleB), 0];
    const topA: Point = [bottomA[0], bottomA[1], height];
    const topB: Point = [bottomB[0], bottomB[1], height];
    triangles.push(
      orientOutward([bottomA, bottomB, topB], center),
      orientOutward([bottomA, topB, topA], center),
      orientOutward([bottomA, [0, 0, 0], bottomB], [0, 0, 0]),
      orientOutward([topA, topB, [0, 0, height]], [0, 0, height]),
    );
  }
  return triangles;
}

function hasFlag(features: MeshFeatures, flag: MeshFeatures['flags'][number]): boolean {
  return features.flags.includes(flag);
}

test('binary cube reports volume, area, and bounds', () => {
  const features = analyzeStl(makeBinaryStl(makeCubeTriangles()));
  assert.equal(features.triangleCount, 12);
  assert.ok(Math.abs(features.volumeMm3 - 1_000) < 1e-9);
  assert.ok(Math.abs(features.areaMm2 - 600) < 1e-9);
  assert.deepEqual(features.bboxMm, { w: 10, d: 10, h: 10 });
  assert.equal(features.degenerateTriangleCount, 0);
  assert.equal(features.overhangAreaMm2, 0);
  assert.equal(hasFlag(features, 'OPEN_MESH'), false);
  assert.equal(hasFlag(features, 'NON_MANIFOLD'), false);
});

test('icosphere and cylinder volumes agree with analytic volumes within one percent', () => {
  const radius = 10;
  const sphere = analyzeStl(makeBinaryStl(makeIcosphereTriangles(radius, 3)));
  const expectedSphere = (4 / 3) * Math.PI * radius ** 3;
  assert.ok(Math.abs(sphere.volumeMm3 - expectedSphere) / expectedSphere < 0.01);

  const cylinderRadius = 8;
  const cylinderHeight = 24;
  const cylinder = analyzeStl(makeBinaryStl(makeCylinderTriangles(cylinderRadius, cylinderHeight, 64)));
  const expectedCylinder = Math.PI * cylinderRadius ** 2 * cylinderHeight;
  assert.ok(Math.abs(cylinder.volumeMm3 - expectedCylinder) / expectedCylinder < 0.01);
});

test('ASCII and binary STL produce the same geometric features', () => {
  const triangles = makeCubeTriangles();
  const binary = analyzeStl(makeBinaryStl(triangles));
  const ascii = analyzeStl(makeAsciiStl(triangles));
  assert.equal(ascii.volumeMm3, binary.volumeMm3);
  assert.equal(ascii.areaMm2, binary.areaMm2);
  assert.deepEqual(ascii.bboxMm, binary.bboxMm);
  assert.deepEqual(ascii.flags, binary.flags);
});

test('open mesh, non-manifold edge, inverted winding, and degenerate triangles are flagged', () => {
  const cube = makeCubeTriangles();
  assert.equal(hasFlag(analyzeStl(makeBinaryStl(cube.slice(1))), 'OPEN_MESH'), true);
  assert.equal(hasFlag(analyzeStl(makeBinaryStl([...cube, cube[0]])), 'NON_MANIFOLD'), true);

  const inverted = cube.map(([a, b, c]) => [a, c, b] as Triangle);
  const invertedFeatures = analyzeStl(makeBinaryStl(inverted));
  assert.ok(Math.abs(invertedFeatures.volumeMm3 - 1_000) < 1e-9);
  assert.equal(hasFlag(invertedFeatures, 'INVERTED_NORMALS'), true);

  const degenerate: Triangle = [[0, 0, 0], [1, 1, 1], [2, 2, 2]];
  const degenerateFeatures = analyzeStl(makeBinaryStl([...cube, degenerate]));
  assert.equal(degenerateFeatures.degenerateTriangleCount, 1);
  assert.equal(hasFlag(degenerateFeatures, 'DEGENERATE_TRIANGLES'), true);
});

test('recentering keeps volume stable for coordinates translated by one million millimeters', () => {
  const translated = makeCubeTriangles().map((triangle) =>
    triangle.map((point) => [point[0] + 1_000_000, point[1] + 1_000_000, point[2] + 1_000_000] as Point) as unknown as Triangle,
  );
  const features = analyzeStl(makeBinaryStl(translated));
  assert.ok(Math.abs(features.volumeMm3 - 1_000) / 1_000 < 1e-6);
});

test('scale applies geometric powers and flags build-volume overflow', () => {
  const original = analyzeStl(makeBinaryStl(makeCubeTriangles()));
  const scaled = scaleMeshFeatures(original, 1.5, { w: 12, d: 20, h: 20 });
  assert.ok(Math.abs(scaled.volumeMm3 - 3_375) < 1e-9);
  assert.ok(Math.abs(scaled.areaMm2 - 1_350) < 1e-9);
  assert.deepEqual(scaled.bboxMm, { w: 15, d: 15, h: 15 });
  assert.equal(hasFlag(scaled, 'EXCEEDS_BUILD_VOLUME'), true);
  assert.equal(scaleMeshFeatures(original, 1.6).bboxMm.w, 16);
  assert.throws(() => scaleMeshFeatures(original, 0), RangeError);
});

test('truncated or empty files fail with StlParseError', () => {
  assert.throws(() => analyzeStl(new Uint8Array()), (error: unknown) =>
    error instanceof StlParseError && error.code === 'EMPTY',
  );
  assert.throws(() => analyzeStl(new Uint8Array([115, 111, 108, 105, 100])), (error: unknown) =>
    error instanceof StlParseError && error.code === 'CORRUPT',
  );
  const truncated = makeBinaryStl(makeCubeTriangles()).subarray(0, 120);
  assert.throws(() => analyzeStl(truncated), (error: unknown) =>
    error instanceof StlParseError && error.code === 'CORRUPT',
  );
});
