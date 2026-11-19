'use client';

import { useCallback, useState } from 'react';
import type { MeshFeatures } from '../../lib/quote';
import { useStlAnalysis } from './useStlAnalysis';

export interface PartAnalysis { features: MeshFeatures | null; error: string | null }

/** One worker at a time keeps a set of components usable on phones. */
export function useStlPartsAnalysis(files: File[]) {
  const [results, setResults] = useState<Map<File, PartAnalysis>>(() => new Map());
  const next = files.find(file => !results.has(file)) ?? null;
  const onComplete = useCallback((file: File, result: PartAnalysis) => {
    setResults(previous => {
      const retained = new Map(Array.from(previous).filter(([known]) => files.includes(known)));
      retained.set(file, result);
      return retained;
    });
  }, [files]);
  useStlAnalysis(next, onComplete);
  return results;
}
