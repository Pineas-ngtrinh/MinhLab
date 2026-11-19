'use client';

import { useEffect, useState } from 'react';
import type { MeshFeatures } from '../../lib/quote';

type WorkerResponse = { status: 'success'; features: MeshFeatures } | { status: 'error'; message: string };
export interface PartAnalysisResult { features: MeshFeatures | null; error: string | null }

interface AnalysisResult {
  file: File;
  features: MeshFeatures | null;
  error: string | null;
}

export function useStlAnalysis(file: File | null, onComplete?: (file: File, result: PartAnalysisResult) => void) {
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    if (!file) return;
    let active = true;
    let settled = false;
    let worker: Worker | undefined;
    const deadline = setTimeout(() => fail('Phân tích tự động quá thời gian. Bạn vẫn có thể gửi file để xưởng kiểm tra và báo giá thủ công.'), 20_000);
    const fail = (message: string) => {
      if (!active || settled) return;
      settled = true;
      clearTimeout(deadline);
      const result = { features: null, error: message };
      setResult({ file, ...result });
      onComplete?.(file, result);
      worker?.terminate();
    };
    try {
      worker = new Worker(new URL('../../workers/stl-quote.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        if (!active || settled) return;
        settled = true;
        clearTimeout(deadline);
        const result = { features: event.data.status === 'success' ? event.data.features : null,
          error: event.data.status === 'error' ? event.data.message : null };
        setResult({ file, ...result });
        onComplete?.(file, result);
        worker?.terminate();
      };
      worker.onerror = () => fail('Không thể phân tích tệp để tính giá tham khảo. Xưởng sẽ kiểm tra thủ công.');
      file.arrayBuffer().then(buffer => {
        if (active && !settled) worker?.postMessage(buffer, [buffer]);
      }).catch(() => fail('Không thể đọc dữ liệu STL để tính giá tham khảo.'));
    } catch {
      // Restricted browsers may refuse Worker construction; keep the form usable.
      queueMicrotask(() => fail('Trình duyệt chưa hỗ trợ phân tích tự động. Xưởng sẽ kiểm tra file trực tiếp.'));
    }
    return () => { active = false; clearTimeout(deadline); worker?.terminate(); };
  }, [file, onComplete]);

  const current = result?.file === file ? result : null;
  return {
    meshFeatures: current?.features ?? null,
    isAnalyzingQuote: file !== null && current === null,
    quoteAnalysisError: current?.error ?? null,
  };
}
