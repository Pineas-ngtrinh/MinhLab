export function describePrintSettings(purpose: string, scalePercent: string, infillPercent: string, layerHeight: string): string {
  return `${purpose}\nTỷ lệ mong muốn: ${scalePercent}%\nMật độ ruột: ${infillPercent}%\nChiều cao lớp: ${layerHeight}\nHướng in theo file STL; xưởng kiểm tra và xác nhận trước khi chế tạo.`;
}

export function formatPrintDuration(hours: number): string {
  const minutes = Math.round(hours * 60);
  if (!Number.isFinite(hours) || hours <= 0) return 'Chưa xác định';
  if (minutes < 1) return 'Dưới 1 phút';
  if (minutes < 60) return `${minutes} phút`;
  const remainder = minutes % 60;
  return `${Math.floor(minutes / 60)} giờ${remainder ? ` ${remainder} phút` : ''}`;
}
