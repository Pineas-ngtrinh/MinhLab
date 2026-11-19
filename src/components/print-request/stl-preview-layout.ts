export interface PreviewDimensions { x: number; y: number; z: number }
export function previewFileKey(file: Pick<File, 'name' | 'size' | 'lastModified'>) {
  return JSON.stringify([file.name, file.size, file.lastModified]);
}
/** Display layout only: one of each file, not an assembly or production nesting plan. */
export function layoutPreviewParts(dimensions: PreviewDimensions[], scale: number) {
  const columns = Math.ceil(Math.sqrt(dimensions.length));
  const rows = Math.ceil(dimensions.length / Math.max(1, columns));
  const widths = Array<number>(columns).fill(0);
  const depths = Array<number>(rows).fill(0);
  dimensions.forEach((size, index) => {
    widths[index % columns] = Math.max(widths[index % columns], size.x * scale);
    depths[Math.floor(index / columns)] = Math.max(depths[Math.floor(index / columns)], size.y * scale);
  });
  const gap = dimensions.length > 1 ? 10 : 0;
  const width = widths.reduce((sum, value) => sum + value, 0) + Math.max(0, columns - 1) * gap;
  const depth = depths.reduce((sum, value) => sum + value, 0) + Math.max(0, rows - 1) * gap;
  return {
    width, depth, height: Math.max(0, ...dimensions.map(size => size.z * scale)),
    positions: dimensions.map((_, index) => {
      const column = index % columns, row = Math.floor(index / columns);
      return { x: widths.slice(0, column).reduce((sum, value) => sum + value + gap, 0) + widths[column] / 2 - width / 2,
        z: depths.slice(0, row).reduce((sum, value) => sum + value + gap, 0) + depths[row] / 2 - depth / 2 };
    }),
  };
}
