import type { PrintColorOption } from '../contracts/printing';

/** Owner's requested colors. Swatches are approximate and do not imply material availability,
 * pricing, stock levels or a change to the calibrated FDM model.
 */
export const PRINT_COLOR_OPTIONS: readonly PrintColorOption[] = [
  { id: 'orange', label: 'Cam', previewHex: '#EB722F' },
  { id: 'black', label: 'Đen', previewHex: '#24262B' },
  { id: 'blue-purple', label: 'Xanh dương tím', previewHex: '#6961AE' },
  { id: 'gold', label: 'Gold', previewHex: '#C8A261' },
  { id: 'pink', label: 'Hồng', previewHex: '#D992AD' },
  { id: 'ivory', label: 'Trắng ngà', previewHex: '#E8DECA' },
  { id: 'brown', label: 'Nâu', previewHex: '#79543A' },
  { id: 'light-brown', label: 'Nâu nhạt', previewHex: '#AD8966' },
  { id: 'light-blue', label: 'Xanh dương nhạt', previewHex: '#8CBAD6' },
  { id: 'silver-blue', label: 'Xanh bạc', previewHex: '#92B6BC' },
  { id: 'gray', label: 'Xám', previewHex: '#92969B' },
  { id: 'yellow', label: 'Vàng', previewHex: '#E7C537' },
  { id: 'clear', label: 'Trong suốt', previewHex: '#DCE6E9' },
  { id: 'white', label: 'Trắng tinh', previewHex: '#F5F4F0' },
  { id: 'blue', label: 'Xanh dương', previewHex: '#327ABE' },
  { id: 'red', label: 'Đỏ', previewHex: '#C74640' },
  { id: 'green', label: 'Xanh lá', previewHex: '#5A8A5B' },
];
