/** One transition per wheel gesture, including a trackpad's momentum tail. */
export function createWheelGate() {
  let lastEvent = -Infinity;
  let total = 0;
  let consumed = false;
  let gesture = 0;
  return {
    get gesture() { return gesture; },
    reset() {
      total = 0;
      consumed = false;
    },
    push(delta: number, time: number): -1 | 0 | 1 {
      if (!Number.isFinite(delta) || !delta) return 0;
      if (time - lastEvent > 200) {
        total = 0;
        consumed = false;
        gesture += 1;
      }
      lastEvent = time;
      if (consumed) return 0;
      if (total && Math.sign(delta) !== Math.sign(total)) total = 0;
      total += delta;
      if (Math.abs(total) < 36) return 0;
      consumed = true;
      return total > 0 ? 1 : -1;
    },
  };
}

/** Long chapters keep their native reading space before advancing. */
export function chapterDestination(
  tops: number[], heights: number[], index: number, y: number,
  viewport: number, direction: number, contentInset: number,
): number | null {
  if (!direction || index < 0 || index >= tops.length || heights.length !== tops.length) return null;
  if (direction > 0 && y < tops[index] + heights[index] - viewport - 8) return null;
  if (direction < 0 && y > tops[index] + Math.max(8, contentInset)) return null;
  const next = index + Math.sign(direction);
  return next >= 0 && next < tops.length ? next : null;
}

/** A reading gesture can reach an edge, but cannot carry through to another page. */
export function clampChapterScroll(top: number, bottom: number, y: number, delta: number) {
  return Math.max(top, Math.min(Math.max(top, bottom), y + delta));
}
