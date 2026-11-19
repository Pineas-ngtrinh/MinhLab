'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';

import { useStlPartsAnalysis } from './useStlPartsAnalysis';
import { resolvePrintFileDimensions, type PrintFileDimensions } from './print-file-dimensions';
import { estimatePrintQuantity, parsePrintQuantity, PRINT_QUANTITY_MIN, PRINT_QUANTITY_MAX } from './print-request-quantity';
import { formatPrintDuration } from './print-request-settings';
import { SITE_CONFIG } from '../../config/site.config';
import { PRINT_COLOR_OPTIONS } from '../../config/printing.config';
import { computeQuote, DEFAULT_QUOTE_CONFIG, toReferenceQuoteView, type ReferenceQuoteView, type InfillFraction, type Material } from '../../lib/quote';

import { formatVND } from '../../lib/format';
import { copyTextToClipboard } from '../../lib/clipboard';

export function usePrintRequest() {
  // Trạng thái Form & 3D Slicer
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: string } | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [partQuantities, setPartQuantities] = useState<Map<File, string>>(() => new Map());
  const [wireframe, setWireframe] = useState(false);
  const [previewDimensions, setDetectedDims] = useState<PrintFileDimensions | null>(null);
  const [scalePercent, setScalePercent] = useState('100');
  const [infillPercent, setInfillPercent] = useState('15');
  const [material, setMaterial] = useState('PLA Basic');
  const [color, setColor] = useState('Mặc định / Studio tư vấn');
  const filamentColor = PRINT_COLOR_OPTIONS.find(option => option.label === color)?.previewHex ?? '#EB4037';
  const [layerHeight, setLayerHeight] = useState('0.20mm · mặc định');
  const [purpose, setPurpose] = useState('Trưng bày sưu tầm');
  const quantity = rawFile ? partQuantities.get(rawFile) ?? '1' : '1';
  const setQuantity = (value: string) => { if (rawFile) setPartQuantities(previous => new Map(previous).set(rawFile, value)); };
  const setPartQuantity = (file: File, value: string) => setPartQuantities(previous => new Map(previous).set(file, value));
  const [notes, setNotes] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmedRights, setConfirmedRights] = useState(false);

  // Trạng thái kiểm lỗi & tóm tắt
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const copyFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyRevision = useRef(0);

  useEffect(() => () => {
    copyRevision.current += 1;
    if (copyFeedbackTimer.current !== null) clearTimeout(copyFeedbackTimer.current);
  }, []);

  const analyses = useStlPartsAnalysis(files);
  const meshFeatures = rawFile ? analyses.get(rawFile)?.features ?? null : null;
  const isAnalyzingQuote = rawFile !== null && !analyses.has(rawFile);
  const quoteAnalysisError = rawFile ? analyses.get(rawFile)?.error ?? null : null;
  const detectedDims = resolvePrintFileDimensions(previewDimensions, meshFeatures);
  const MATERIALS = [
    { label: 'PLA Basic', desc: 'Vật liệu phổ thông, phù hợp mô hình trang trí và chi tiết nhẹ' },
    { label: 'PETG HF', desc: 'Độ bền cơ học tốt, phù hợp chi tiết sử dụng thường ngày' },
    { label: 'TPU 95A HF', desc: 'Vật liệu đàn hồi dẻo; cần kiểm tra khả năng in theo hình học' },
    { label: 'Cần MinhLab tư vấn', desc: 'Kỹ sư xưởng sẽ kiểm tra file và xác nhận vật liệu tương thích' },
  ];

  // Độ mịn layer
  const LAYER_HEIGHTS = [
    { label: '0.20mm · mặc định', desc: 'Độ mịn tham khảo; kỹ sư xưởng sẽ xác nhận cấu hình phù hợp sau khi kiểm tra file.' },
  ];

  // Mục đích in
  const PURPOSES = [
    'Trưng bày sưu tầm',
    'Lắp ráp cơ khí',
    'Phụ kiện bàn làm việc',
    'Mô hình kiến trúc / Diorama',
  ];

  const INFILL_OPTIONS = [
    { value: '15', label: '15% · Nhẹ', desc: 'Móc khóa, đồ trưng bày, mô hình trang trí.' },
    { value: '40', label: '40% · Dùng thường', desc: 'Khay, hộp, phụ kiện bàn làm việc.' },
    { value: '80', label: '80% · Dự kiến chịu lực', desc: 'Mẫu thử tay nắm, gá đỡ; xưởng cần kiểm tra thêm vách và hướng in.' },
  ];

  const DEFAULT_INFILL_BY_PURPOSE: Record<string, string> = {
    'Trưng bày sưu tầm': '15',
    'Lắp ráp cơ khí': '80',
    'Phụ kiện bàn làm việc': '40',
    'Mô hình kiến trúc / Diorama': '15',
  };

  // Xử lý kéo thả tệp
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    processFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  };
  function selectPart(file: File | null) {
    setRawFile(file);
    setSelectedFile(file ? { name: file.name, size: `${(file.size / (1024 * 1024)).toFixed(1)} MB` } : null);
    setDetectedDims(null);
  }
  function removePart(file: File) {
    const remaining = files.filter(value => value !== file);
    setFiles(remaining);
    setPartQuantities(previous => { const next = new Map(previous); next.delete(file); return next; });
    if (rawFile === file) selectPart(remaining[0] ?? null);
  }
  function processFiles(incoming: File[]) {
    if (!incoming.length) return;
    const added = incoming.filter(file => !files.some(old => old.name === file.name && old.size === file.size && old.lastModified === file.lastModified));
    let message = '';
    if (incoming.some(file => !/\.stl$/i.test(file.name))) message = 'Chỉ nhận tệp .STL để dự đoán. Hãy xuất mô hình sang STL rồi chọn lại.';
    else if (incoming.some(file => file.size <= 0 || file.size > 100 * 1024 * 1024)) message = 'Mỗi tệp STL phải lớn hơn 0 và không vượt 100 MB.';
    else if (files.length + added.length > 10) message = 'Mỗi lượt xem tối đa 10 linh kiện.';
    else if ([...files, ...added].reduce((sum, file) => sum + file.size, 0) > 100 * 1024 * 1024) message = 'Tổng tệp xem trước tối đa 100 MB để tránh quá tải thiết bị. Hãy chia thành nhiều lượt.';
    if (message) { setErrors(previous => ({ ...previous, file: message })); return; }
    if (!added.length) return;
    setErrors(previous => { const next = { ...previous }; delete next.file; return next; });
    setFiles(previous => [...previous, ...added]);
    selectPart(added[0]);
  }

  const handleDimensionsDetected = useCallback((dims: { x: number; y: number; z: number }) => {
    setDetectedDims(dims);
  }, []);

  const scaleValue = Number(scalePercent);
  const hasValidScale = Number.isFinite(scaleValue) && scaleValue >= 1 && scaleValue <= 5000;
  const scaledDimensionsCm = detectedDims && hasValidScale
    ? {
        x: (detectedDims.x * scaleValue) / 1000,
        y: (detectedDims.y * scaleValue) / 1000,
        z: (detectedDims.z * scaleValue) / 1000,
      }
    : null;
  const exceedsBuildVolume = Boolean(
    scaledDimensionsCm && (
      scaledDimensionsCm.x * 10 + 2 * DEFAULT_QUOTE_CONFIG.model.assumedBrimWidthMm > DEFAULT_QUOTE_CONFIG.model.usableXyMm[0] ||
      scaledDimensionsCm.y * 10 + 2 * DEFAULT_QUOTE_CONFIG.model.assumedBrimWidthMm > DEFAULT_QUOTE_CONFIG.model.usableXyMm[1] ||
      scaledDimensionsCm.z * 10 > DEFAULT_QUOTE_CONFIG.printer.buildVolumeMm.h
    ),
  );
  const formatDimension = (value: number) => Number(value.toFixed(1)).toString();

  const referenceQuote = useMemo<ReferenceQuoteView | null>(() => {
    if (!meshFeatures || !hasValidScale) return null;
    const materials: Record<string, Material> = { 'PLA Basic': 'PLA', 'PETG HF': 'PETG', 'TPU 95A HF': 'TPU' };
    const selectedMaterial = materials[material];
    if (!selectedMaterial) return { status: 'review', message: 'Xưởng sẽ tư vấn vật liệu và xác nhận báo giá sau khi kiểm tra tệp.' };
    const infill: InfillFraction = infillPercent === '40' ? 0.4 : infillPercent === '80' ? 0.8 : 0.15;
    try {
      const quote = computeQuote(meshFeatures,
        { material: selectedMaterial, scale: scaleValue / 100, infill }, DEFAULT_QUOTE_CONFIG);
      return toReferenceQuoteView(quote, selectedMaterial, DEFAULT_QUOTE_CONFIG.rateCard);
    } catch {
      return { status: 'review', message: 'Chưa thể ước tính tự động với tệp này. Xưởng sẽ kiểm tra và xác nhận báo giá.' };
    }
  }, [hasValidScale, infillPercent, material, meshFeatures, scaleValue]);

  const partEstimates = files.map(file => {
    const result = analyses.get(file);
    const count = partQuantities.get(file) ?? '1';
    let quote: ReferenceQuoteView | null = null;
    const selectedMaterial: Material | undefined = ({ 'PLA Basic': 'PLA', 'PETG HF': 'PETG', 'TPU 95A HF': 'TPU' } as Record<string, Material>)[material];
    if (result?.features && hasValidScale && selectedMaterial) {
      try {
        quote = toReferenceQuoteView(computeQuote(result.features, { material: selectedMaterial, scale: scaleValue / 100, infill: infillPercent === '80' ? 0.8 : infillPercent === '40' ? 0.4 : 0.15 }, DEFAULT_QUOTE_CONFIG), selectedMaterial, DEFAULT_QUOTE_CONFIG.rateCard);
      } catch { quote = { status: 'review', message: 'Xưởng cần kiểm tra file.' }; }
    }
    return { file, quantity: count, quote, estimate: estimatePrintQuantity(quote, count), analyzing: !result, error: result?.error };
  });

  const hasValidQuantity = parsePrintQuantity(quantity) !== null;
  const quantityEstimate = !isAnalyzingQuote && !quoteAnalysisError
    ? estimatePrintQuantity(referenceQuote, quantity)
    : null;

  // Nội dung khách gửi cho xưởng qua Zalo hoặc email.
  const generateSummaryText = () => {
    return [
      'Chào MinhLab, mình muốn nhờ xưởng kiểm tra file và báo giá in 3D.',
      '',
      `Người gửi: ${fullName || 'Chưa cung cấp'}`,
      `Điện thoại / Zalo: ${phone || 'Chưa cung cấp'}`,
      `Tệp STL: ${selectedFile ? `${selectedFile.name} (${selectedFile.size})` : 'Chưa chọn tệp'}`,
      `Kích thước trong file: ${detectedDims ? `${formatDimension(detectedDims.x)} × ${formatDimension(detectedDims.y)} × ${formatDimension(detectedDims.z)} mm (X × Y × Z)` : 'Chưa đọc được'}`,
      `Tỷ lệ mong muốn: ${hasValidScale ? `${scaleValue}%` : 'Chưa xác định'}`,
      `Kích thước sau chỉnh tỷ lệ: ${scaledDimensionsCm ? `${formatDimension(scaledDimensionsCm.x)} × ${formatDimension(scaledDimensionsCm.y)} × ${formatDimension(scaledDimensionsCm.z)} cm (X × Y × Z)` : 'Chưa xác định'}`,
      '',
      'Thông số mình đang cân nhắc:',
      `Vật liệu: ${material}`,
      `Màu: ${color}`,
      `Chiều cao lớp: ${layerHeight}`,
      `Mật độ ruột: ${infillPercent}% (${INFILL_OPTIONS.find((option) => option.value === infillPercent)?.label || 'Tư vấn tại xưởng'})`,
      `Số lượng: ${quantity}`,
      `Mục đích: ${purpose}`,
      referenceQuote?.status === 'ready'
        ? `Ước tính hiện tại: ${formatVND(referenceQuote.referencePriceVnd)} / sản phẩm; khoảng ${formatVND(referenceQuote.lowPriceVnd)}–${formatVND(referenceQuote.highPriceVnd)}. Nhờ xưởng xác nhận lại sau khi xem file.`
        : undefined,
      referenceQuote?.status === 'ready'
        ? `Tài nguyên tham khảo cho một sản phẩm: ${referenceQuote.massG.toFixed(2)} g nhựa (gồm support/brim); thời gian in ${formatPrintDuration(referenceQuote.modelTimeHours)}, chưa gồm chuẩn bị máy và hậu xử lý.`
        : undefined,
      quantityEstimate
        ? `Ước tính cho ${quantityEstimate.quantity} sản phẩm: ${formatVND(quantityEstimate.referencePriceVnd)}; khoảng ${formatVND(quantityEstimate.lowPriceVnd)}–${formatVND(quantityEstimate.highPriceVnd)} (chưa gồm giao hàng và hậu xử lý).`
        : undefined,
      notes.trim() ? `Ghi chú: ${notes}` : undefined,
      `Quyền sử dụng tệp: ${confirmedRights ? 'Mình xác nhận có quyền gửi tệp này.' : 'Chưa xác nhận.'}`,
      '',
      'Mình sẽ đính kèm file STL khi gửi yêu cầu này để xưởng kiểm tra. Nhờ MinhLab xác nhận khả năng in và báo giá cuối trước khi thực hiện. Cảm ơn xưởng.',
    ]
      .filter((line): line is string => line !== undefined)
      .join('\n');
  };

  // Validate form trước khi xem tóm tắt
  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!phone.trim()) {
      errs.phone = 'Vui lòng nhập số điện thoại để xưởng liên hệ về file và báo giá.';
    }

    if (!confirmedRights) {
      errs.confirmedRights = 'Vui lòng xác nhận bạn có quyền sử dụng tệp in này.';
    }

    if (!rawFile) {
      errs.file = 'Chọn tệp STL để thợ có thể mở và kiểm tra khả năng in.';
    } else if (!detectedDims && !quoteAnalysisError) {
      errs.file = errors.file || 'Đang đọc STL hoặc tệp không có lưới hợp lệ. Hãy chờ phân tích xong hoặc xuất lại STL.';
    }

    if (!hasValidScale) {
      errs.scalePercent = 'Tỷ lệ in phải nằm trong khoảng 1% đến 5000%.';
    }

    if (!hasValidQuantity) {
      errs.quantity = `Số lượng phải là số nguyên từ ${PRINT_QUANTITY_MIN} đến ${PRINT_QUANTITY_MAX}.`;
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});
    setShowSummary(true);
  };

  // Chép sẵn nội dung rồi mở cuộc trò chuyện Zalo để người dùng dán và gửi.
  const handleSendZalo = () => {
    void handleCopy();
    const url = SITE_CONFIG.contact.socials.zalo ?? `https://zalo.me/${SITE_CONFIG.contact.zaloPhone.replace(/\s+/g, '')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Gửi qua Email
  const handleSendEmail = () => {
    const text = generateSummaryText();
    const subject = encodeURIComponent(`[MinhLab 3D] Yêu cầu in theo file từ ${fullName || phone}`);
    const body = encodeURIComponent(text);
    window.location.assign(`mailto:${SITE_CONFIG.contact.email}?subject=${subject}&body=${body}`);
  };

  // Sao chép nội dung
  const handleCopy = async () => {
    const revision = ++copyRevision.current;
    if (copyFeedbackTimer.current !== null) clearTimeout(copyFeedbackTimer.current);
    setCopied(false);
    setCopyError('');
    try {
      const success = await copyTextToClipboard(generateSummaryText(), navigator.clipboard);
      if (copyRevision.current !== revision) return;
      if (!success) {
        setCopyError('Không thể sao chép. Hãy thử lại hoặc chọn và sao chép nội dung bản tóm tắt trực tiếp.');
        return;
      }
      setCopied(true);
      copyFeedbackTimer.current = setTimeout(() => {
        setCopied(false);
        copyFeedbackTimer.current = null;
      }, 2000);
    } catch {
      if (copyRevision.current === revision) {
        setCopyError('Không thể sao chép. Hãy thử lại hoặc chọn và sao chép nội dung bản tóm tắt trực tiếp.');
      }
    }
  };
  return {
    files,
    partEstimates,
    selectPart,
    removePart,
    setPartQuantity,
    filamentColor,
    MATERIALS,
    material,
    setMaterial,
    color,
    handleValidate,
    rawFile,
    wireframe,
    hasValidScale,
    scaleValue,
    handleDimensionsDetected,
    setWireframe,
    detectedDims,
    formatDimension,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    isDragOver,
    selectedFile,
    fileInputRef,
    handleFileChange,
    setSelectedFile,
    setRawFile,
    setDetectedDims,
    setScalePercent,
    setErrors,
    errors,
    LAYER_HEIGHTS,
    layerHeight,
    setLayerHeight,
    purpose,
    setPurpose,
    setInfillPercent,
    DEFAULT_INFILL_BY_PURPOSE,
    PURPOSES,
    infillPercent,
    INFILL_OPTIONS,
    scalePercent,
    scaledDimensionsCm,
    exceedsBuildVolume,
    setColor,
    quantity,
    setQuantity,
    hasValidQuantity,
    quantityEstimate,
    isAnalyzingQuote,
    quoteAnalysisError,
    referenceQuote,
    fullName,
    setFullName,
    phone,
    setPhone,
    notes,
    setNotes,
    confirmedRights,
    setConfirmedRights,
    showSummary,
    setShowSummary,
    generateSummaryText,
    handleCopy,
    copied,
    copyError,
    handleSendZalo,
    handleSendEmail,
  };
}
