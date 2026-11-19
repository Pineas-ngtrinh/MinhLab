const { performance } = require('node:perf_hooks');
const { analyzeStl } = require('../../src/lib/quote/stl/analyze.ts');

const TARGET_BYTES = 50 * 1024 * 1024;
const HEADER_BYTES = 84;
const TRIANGLE_BYTES = 50;
const MAX_DURATION_MS = 3_000;

function createBinaryStl() {
  const triangleCount = Math.ceil((TARGET_BYTES - HEADER_BYTES) / TRIANGLE_BYTES);
  const bytes = Buffer.allocUnsafe(HEADER_BYTES + triangleCount * TRIANGLE_BYTES);
  bytes.fill(0, 0, HEADER_BYTES);
  bytes.writeUInt32LE(triangleCount, 80);

  const tetrahedronFaces = [
    [[0, 0, 0], [0, 1, 0], [1, 0, 0]],
    [[0, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 0, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
  ];

  for (
    let triangleIndex = 0, offset = HEADER_BYTES;
    triangleIndex < triangleCount;
    triangleIndex += 1, offset += TRIANGLE_BYTES
  ) {
    const face = tetrahedronFaces[triangleIndex % tetrahedronFaces.length];
    for (let vertexIndex = 0; vertexIndex < face.length; vertexIndex += 1) {
      const vertexOffset = offset + 12 + vertexIndex * 12;
      for (let axis = 0; axis < 3; axis += 1) {
        bytes.writeFloatLE(face[vertexIndex][axis], vertexOffset + axis * 4);
      }
    }
  }

  return bytes;
}

function toMiB(bytes, precision = 3) {
  return Number((bytes / (1024 * 1024)).toFixed(precision));
}

const stl = createBinaryStl();
const memoryBefore = process.memoryUsage();
const startedAt = performance.now();
const features = analyzeStl(stl);
const elapsedMs = performance.now() - startedAt;
const memoryAfter = process.memoryUsage();

const result = {
  node: process.version,
  platform: `${process.platform} ${process.arch}`,
  fileBytes: stl.byteLength,
  fileMiB: toMiB(stl.byteLength, 6),
  triangleCount: features.triangleCount,
  analysisMs: Number(elapsedMs.toFixed(1)),
  rssBeforeMiB: toMiB(memoryBefore.rss),
  rssAfterMiB: toMiB(memoryAfter.rss),
  flags: features.flags,
  topologySkippedRequiresReview: features.flags.includes('TOPOLOGY_SKIPPED'),
  limitMs: MAX_DURATION_MS,
};

console.log(JSON.stringify(result, null, 2));

if (elapsedMs >= MAX_DURATION_MS) {
  process.exitCode = 1;
}
