import { extractModelGeometry, type ModelGeometry } from './model-geometry';

export type QuoteFlag =
  | 'OPEN_MESH'
  | 'NON_MANIFOLD'
  | 'INVERTED_NORMALS'
  | 'INCONSISTENT_WINDING'
  | 'MISSING_MODEL_GEOMETRY'
  | 'DEGENERATE_TRIANGLES'
  | 'SUSPICIOUS_UNITS'
  | 'EXCEEDS_BUILD_VOLUME'
  | 'OUT_OF_TRAINING_RANGE'
  | 'MODEL_PROVISIONAL'
  | 'TOPOLOGY_SKIPPED';

export type StlParseErrorCode = 'CORRUPT' | 'EMPTY';

export class StlParseError extends Error {
  readonly code: StlParseErrorCode;

  constructor(code: StlParseErrorCode, message: string) {
    super(message);
    this.name = 'StlParseError';
    this.code = code;
  }
}

export interface MeshFeatures {
  /** Unscaled, orientation-aware geometry for v3 inference. */
  modelGeometry?: ModelGeometry;
  triangleCount: number;
  volumeMm3: number;
  areaMm2: number;
  bboxMm: { w: number; d: number; h: number };
  overhangAreaMm2: number;
  degenerateTriangleCount: number;
  flags: QuoteFlag[];
}

export interface BuildVolumeMm {
  w: number;
  d: number;
  h: number;
}

export interface AnalyzeStlOptions {
  buildVolumeMm?: BuildVolumeMm;
  topologyBudgetMs?: number;
  topologyMaxTriangles?: number;
}

type TriangleVisitor = (
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  x3: number,
  y3: number,
  z3: number,
) => void;

interface TriangleSource {
  triangleCount: number;
  forEachTriangle(visitor: TriangleVisitor): void;
}

const ASCII_NUMBER = '[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?';
const ASCII_VERTEX_PATTERN = new RegExp(
  '\\bvertex\\s+(' + ASCII_NUMBER + ')\\s+(' + ASCII_NUMBER + ')\\s+(' + ASCII_NUMBER + ')',
  'gi',
);
const TOPOLOGY_GRID_PER_MM = 10_000;
const TOPOLOGY_MAX_PACKED_ID = 2 ** 24;

function parseBinaryStl(bytes: Uint8Array, triangleCount: number): TriangleSource {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const firstTriangleOffset = 84;

  return {
    triangleCount,
    forEachTriangle(visitor) {
      for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
        const triangleOffset = firstTriangleOffset + triangleIndex * 50 + 12;
        const x1 = view.getFloat32(triangleOffset, true);
        const y1 = view.getFloat32(triangleOffset + 4, true);
        const z1 = view.getFloat32(triangleOffset + 8, true);
        const x2 = view.getFloat32(triangleOffset + 12, true);
        const y2 = view.getFloat32(triangleOffset + 16, true);
        const z2 = view.getFloat32(triangleOffset + 20, true);
        const x3 = view.getFloat32(triangleOffset + 24, true);
        const y3 = view.getFloat32(triangleOffset + 28, true);
        const z3 = view.getFloat32(triangleOffset + 32, true);

        if (
          !Number.isFinite(x1) ||
          !Number.isFinite(y1) ||
          !Number.isFinite(z1) ||
          !Number.isFinite(x2) ||
          !Number.isFinite(y2) ||
          !Number.isFinite(z2) ||
          !Number.isFinite(x3) ||
          !Number.isFinite(y3) ||
          !Number.isFinite(z3)
        ) {
          throw new StlParseError('CORRUPT', 'STL chứa tọa độ không hữu hạn.');
        }
        visitor(x1, y1, z1, x2, y2, z2, x3, y3, z3);
      }
    },
  };
}

function parseAsciiStl(bytes: Uint8Array): TriangleSource {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new StlParseError('CORRUPT', 'STL không khớp định dạng binary hoặc ASCII.');
  }

  const trimmed = text.trimStart();
  if (!/^solid(?:\s|$)/i.test(trimmed) || !/\bendsolid\b/i.test(text)) {
    throw new StlParseError('CORRUPT', 'STL không khớp định dạng binary hoặc ASCII.');
  }

  const countPattern = new RegExp(ASCII_VERTEX_PATTERN.source, ASCII_VERTEX_PATTERN.flags);
  let vertexCount = 0;
  for (const _match of text.matchAll(countPattern)) {
    vertexCount += 1;
  }
  if (vertexCount === 0 || vertexCount % 3 !== 0) {
    throw new StlParseError('CORRUPT', 'STL ASCII thiếu hoặc thừa đỉnh tam giác.');
  }

  const triangleCount = vertexCount / 3;
  return {
    triangleCount,
    forEachTriangle(visitor) {
      const vertexPattern = new RegExp(ASCII_VERTEX_PATTERN.source, ASCII_VERTEX_PATTERN.flags);
      let verticesInTriangle = 0;
      let x1 = 0;
      let y1 = 0;
      let z1 = 0;
      let x2 = 0;
      let y2 = 0;
      let z2 = 0;

      for (const match of text.matchAll(vertexPattern)) {
        const x = Number(match[1]);
        const y = Number(match[2]);
        const z = Number(match[3]);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
          throw new StlParseError('CORRUPT', 'STL chứa tọa độ không hữu hạn.');
        }

        if (verticesInTriangle === 0) {
          x1 = x;
          y1 = y;
          z1 = z;
        } else if (verticesInTriangle === 1) {
          x2 = x;
          y2 = y;
          z2 = z;
        } else {
          visitor(x1, y1, z1, x2, y2, z2, x, y, z);
        }
        verticesInTriangle = (verticesInTriangle + 1) % 3;
      }
    },
  };
}

function parseStl(bytes: Uint8Array): TriangleSource {
  if (bytes.byteLength === 0) {
    throw new StlParseError('EMPTY', 'File STL rỗng.');
  }

  if (bytes.byteLength >= 84) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const triangleCount = view.getUint32(80, true);
    const expectedByteLength = 84 + 50 * triangleCount;
    if (expectedByteLength === bytes.byteLength && triangleCount > 0) {
      return parseBinaryStl(bytes, triangleCount);
    }
  }

  return parseAsciiStl(bytes);
}

function nextPowerOfTwo(value: number): number {
  let result = 1;
  while (result < value) {
    result *= 2;
  }
  return result;
}

class EdgeTopology {
  private readonly coordinates: Int32Array;
  private readonly ids: Uint32Array;
  private readonly edges: Float64Array;
  private readonly mask: number;
  private readonly origin: { x: number; y: number; z: number };
  private readonly budgetMs: number;
  private readonly startedAt: number;
  private uniqueVertexCount = 0;
  private edgeCount = 0;
  private triangleIndex = 0;
  private skipped = false;

  constructor(
    triangleCount: number,
    origin: { x: number; y: number; z: number },
    budgetMs: number,
  ) {
    const maxVertices = triangleCount * 3;
    const capacity = nextPowerOfTwo(Math.max(8, maxVertices * 2));
    this.coordinates = new Int32Array(capacity * 3);
    this.ids = new Uint32Array(capacity);
    this.edges = new Float64Array(triangleCount * 3);
    this.mask = capacity - 1;
    this.origin = origin;
    this.budgetMs = budgetMs;
    this.startedAt = Date.now();
  }

  addTriangle(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    x3: number,
    y3: number,
    z3: number,
  ): void {
    this.triangleIndex += 1;
    if (this.skipped) {
      return;
    }
    if ((this.triangleIndex & 1023) === 0 && Date.now() - this.startedAt > this.budgetMs) {
      this.skipped = true;
      return;
    }

    const a = this.vertexId(x1, y1, z1);
    const b = this.vertexId(x2, y2, z2);
    const c = this.vertexId(x3, y3, z3);
    this.pushEdge(a, b);
    this.pushEdge(b, c);
    this.pushEdge(c, a);
  }

  finish(): QuoteFlag[] {
    if (this.skipped) {
      return ['TOPOLOGY_SKIPPED'];
    }
    this.edges.subarray(0, this.edgeCount).sort();
    if (Date.now() - this.startedAt > this.budgetMs) {
      return ['TOPOLOGY_SKIPPED'];
    }

    const flags: QuoteFlag[] = [];
    let runLength = 1;
    let directionBalance = this.edgeCount ? (this.edges[0] % 2 === 1 ? 1 : -1) : 0;
    for (let edgeIndex = 1; edgeIndex < this.edgeCount; edgeIndex += 1) {
      if (Math.floor(this.edges[edgeIndex] / 2) === Math.floor(this.edges[edgeIndex - 1] / 2)) {
        runLength += 1;
        directionBalance += this.edges[edgeIndex] % 2 === 1 ? 1 : -1;
      } else {
        this.addEdgeFlag(flags, runLength, directionBalance);
        runLength = 1;
        directionBalance = this.edges[edgeIndex] % 2 === 1 ? 1 : -1;
      }
    }
    if (this.edgeCount > 0) {
      this.addEdgeFlag(flags, runLength, directionBalance);
    }
    return flags;
  }

  private vertexId(x: number, y: number, z: number): number {
    const qx = Math.round((x - this.origin.x) * TOPOLOGY_GRID_PER_MM);
    const qy = Math.round((y - this.origin.y) * TOPOLOGY_GRID_PER_MM);
    const qz = Math.round((z - this.origin.z) * TOPOLOGY_GRID_PER_MM);
    let slot = (
      Math.imul(qx, 73_856_093) ^
      Math.imul(qy, 19_349_663) ^
      Math.imul(qz, 83_492_791)
    ) & this.mask;

    while (true) {
      const storedId = this.ids[slot];
      const coordinateOffset = slot * 3;
      if (storedId === 0) {
        this.uniqueVertexCount += 1;
        this.coordinates[coordinateOffset] = qx;
        this.coordinates[coordinateOffset + 1] = qy;
        this.coordinates[coordinateOffset + 2] = qz;
        this.ids[slot] = this.uniqueVertexCount;
        return this.uniqueVertexCount - 1;
      }
      if (
        this.coordinates[coordinateOffset] === qx &&
        this.coordinates[coordinateOffset + 1] === qy &&
        this.coordinates[coordinateOffset + 2] === qz
      ) {
        return storedId - 1;
      }
      slot = (slot + 1) & this.mask;
    }
  }

  private pushEdge(left: number, right: number): void {
    const smaller = Math.min(left, right);
    const larger = Math.max(left, right);
    this.edges[this.edgeCount] = (smaller * TOPOLOGY_MAX_PACKED_ID + larger) * 2 + Number(left < right);
    this.edgeCount += 1;
  }

  private addEdgeFlag(flags: QuoteFlag[], edgeUseCount: number, balance: number): void {
    if (edgeUseCount === 2 && balance !== 0 && !flags.includes('INCONSISTENT_WINDING')) {
      flags.push('INCONSISTENT_WINDING');
    }
    if (edgeUseCount === 1 && !flags.includes('OPEN_MESH')) {
      flags.push('OPEN_MESH');
    } else if (edgeUseCount > 2 && !flags.includes('NON_MANIFOLD')) {
      flags.push('NON_MANIFOLD');
    }
  }
}

export function analyzeStl(bytes: Uint8Array, options: AnalyzeStlOptions = {}): MeshFeatures {
  const source = parseStl(bytes);
  if (source.triangleCount <= 0) {
    throw new StlParseError('EMPTY', 'STL không có tam giác.');
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  source.forEachTriangle((x1, y1, z1, x2, y2, z2, x3, y3, z3) => {
    minX = Math.min(minX, x1, x2, x3);
    minY = Math.min(minY, y1, y2, y3);
    minZ = Math.min(minZ, z1, z2, z3);
    maxX = Math.max(maxX, x1, x2, x3);
    maxY = Math.max(maxY, y1, y2, y3);
    maxZ = Math.max(maxZ, z1, z2, z3);
  });

  const width = maxX - minX;
  const depth = maxY - minY;
  const height = maxZ - minZ;
  if (!Number.isFinite(width) || !Number.isFinite(depth) || !Number.isFinite(height)) {
    throw new StlParseError('CORRUPT', 'Kích thước STL vượt giới hạn số học.');
  }

  const centerX = minX + width / 2;
  const centerY = minY + depth / 2;
  const centerZ = minZ + height / 2;
  const flags = new Set<QuoteFlag>();
  let signedVolumeMm3 = 0;
  let areaMm2 = 0;
  let overhangAreaMm2 = 0;
  let degenerateTriangleCount = 0;
  let longestEdgeMm = 0;

  const topologyBudgetMs = options.topologyBudgetMs ?? 2_500;
  const topologyMaxTriangles = options.topologyMaxTriangles ?? 500_000;
  const maxTopologyExtentMm = (2 ** 31 - 1) / TOPOLOGY_GRID_PER_MM;
  const canCheckTopology =
    source.triangleCount <= topologyMaxTriangles &&
    Math.max(width, depth, height) <= maxTopologyExtentMm &&
    source.triangleCount * 3 < TOPOLOGY_MAX_PACKED_ID;
  const topology = canCheckTopology
    ? new EdgeTopology(source.triangleCount, { x: minX, y: minY, z: minZ }, topologyBudgetMs)
    : null;

  source.forEachTriangle((x1, y1, z1, x2, y2, z2, x3, y3, z3) => {
    const abX = x2 - x1;
    const abY = y2 - y1;
    const abZ = z2 - z1;
    const acX = x3 - x1;
    const acY = y3 - y1;
    const acZ = z3 - z1;
    const normalX = abY * acZ - abZ * acY;
    const normalY = abZ * acX - abX * acZ;
    const normalZ = abX * acY - abY * acX;
    const doubledArea = Math.hypot(normalX, normalY, normalZ);
    const triangleArea = doubledArea / 2;

    if (triangleArea < 1e-9) {
      degenerateTriangleCount += 1;
    } else {
      areaMm2 += triangleArea;
      const unitNormalZ = normalZ / doubledArea;
      const faceCenterZ = (z1 + z2 + z3) / 3;
      const bottomTolerance = Math.max(1e-4, height * 1e-6);
      if (unitNormalZ < -Math.SQRT1_2 && faceCenterZ > minZ + bottomTolerance) {
        overhangAreaMm2 += triangleArea;
      }
    }

    const p1x = x1 - centerX;
    const p1y = y1 - centerY;
    const p1z = z1 - centerZ;
    const p2x = x2 - centerX;
    const p2y = y2 - centerY;
    const p2z = z2 - centerZ;
    const p3x = x3 - centerX;
    const p3y = y3 - centerY;
    const p3z = z3 - centerZ;
    const crossX = p2y * p3z - p2z * p3y;
    const crossY = p2z * p3x - p2x * p3z;
    const crossZ = p2x * p3y - p2y * p3x;
    signedVolumeMm3 += (p1x * crossX + p1y * crossY + p1z * crossZ) / 6;

    longestEdgeMm = Math.max(
      longestEdgeMm,
      Math.hypot(abX, abY, abZ),
      Math.hypot(acX, acY, acZ),
      Math.hypot(x3 - x2, y3 - y2, z3 - z2),
    );
    topology?.addTriangle(x1, y1, z1, x2, y2, z2, x3, y3, z3);
  });

  if (
    !Number.isFinite(signedVolumeMm3) ||
    !Number.isFinite(areaMm2) ||
    !Number.isFinite(overhangAreaMm2)
  ) {
    throw new StlParseError('CORRUPT', 'Không thể tính đặc trưng STL trong giới hạn số học.');
  }
  if (signedVolumeMm3 < 0) {
    flags.add('INVERTED_NORMALS');
  }
  if (degenerateTriangleCount > 0) {
    flags.add('DEGENERATE_TRIANGLES');
  }
  if (longestEdgeMm < 1 || longestEdgeMm > 1_000) {
    flags.add('SUSPICIOUS_UNITS');
  }
  if (topology === null) {
    flags.add('TOPOLOGY_SKIPPED');
  } else {
    for (const flag of topology.finish()) {
      flags.add(flag);
    }
  }

  if (options.buildVolumeMm) {
    const buildVolume = options.buildVolumeMm;
    if (
      width > buildVolume.w ||
      depth > buildVolume.d ||
      height > buildVolume.h
    ) {
      flags.add('EXCEEDS_BUILD_VOLUME');
    }
  }

  return {
    modelGeometry: extractModelGeometry(source, [minX, minY, minZ], [width, depth, height], signedVolumeMm3),
    triangleCount: source.triangleCount,
    volumeMm3: Math.abs(signedVolumeMm3),
    areaMm2,
    bboxMm: { w: width, d: depth, h: height },
    overhangAreaMm2,
    degenerateTriangleCount,
    flags: Array.from(flags),
  };
}

export function scaleMeshFeatures(
  features: MeshFeatures,
  scale: number,
  buildVolumeMm?: BuildVolumeMm,
): MeshFeatures {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError('Scale phải là số hữu hạn dương.');
  }
  const flags = new Set(features.flags);
  flags.delete('EXCEEDS_BUILD_VOLUME');
  const bboxMm = {
    w: features.bboxMm.w * scale,
    d: features.bboxMm.d * scale,
    h: features.bboxMm.h * scale,
  };
  if (
    buildVolumeMm &&
    (bboxMm.w > buildVolumeMm.w || bboxMm.d > buildVolumeMm.d || bboxMm.h > buildVolumeMm.h)
  ) {
    flags.add('EXCEEDS_BUILD_VOLUME');
  }

  return {
    ...features,
    volumeMm3: features.volumeMm3 * scale ** 3,
    areaMm2: features.areaMm2 * scale ** 2,
    overhangAreaMm2: features.overhangAreaMm2 * scale ** 2,
    bboxMm,
    flags: Array.from(flags),
  };
}
