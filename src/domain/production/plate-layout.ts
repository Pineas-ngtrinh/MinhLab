export interface Box { width: number; depth: number; height: number }
export interface Plate extends Box { margin: number; spacing: number }
export interface Piece { id: string; size: Box; count: number }
export interface Placement { id: string; x: number; y: number }
const validBox = (b: Box) => [b.width,b.depth,b.height].every(v => Number.isFinite(v) && v > 0);

/** Fixed orientation; decreasing footprints on first-fit shelves. Never proves printability. */
export function fitPlate(plate: Plate, pieces: Piece[]): Placement[] | null {
    if (!validBox(plate) || ![plate.margin,plate.spacing].every(n => Number.isFinite(n) && n >= 0) ||
        !pieces.length || pieces.some(p => !validBox(p.size) || p.size.height > plate.height || !Number.isSafeInteger(p.count) || p.count < 1) ||
        pieces.reduce((n,p) => n+p.count,0) > 1000) return null;
    const right = plate.width-plate.margin, bottom = plate.depth-plate.margin;
    const shelves: { x: number; y: number; depth: number }[] = [];
    const result: Placement[] = [];
    for (const p of [...pieces].sort((a,b) => b.size.width*b.size.depth-a.size.width*a.size.depth || a.id.localeCompare(b.id))) {
        for (let i=0;i<p.count;i++) {
            let row = shelves.find(r => r.depth >= p.size.depth && r.x+p.size.width <= right);
            if (!row) {
                const last = shelves.at(-1);
                const y = last ? last.y+last.depth+plate.spacing : plate.margin;
                if (plate.margin+p.size.width > right || y+p.size.depth > bottom) return null;
                row = { x: plate.margin, y, depth: p.size.depth };
                shelves.push(row);
            }
            result.push({ id: p.id, x: row.x, y: row.y });
            row.x += p.size.width+plate.spacing;
        }
    }
    return result;
}
