import { DEFAULT_PRINTER_CONFIG, analyzeStl, type MeshFeatures } from '../lib/quote';

type StlQuoteWorkerResponse =
  | { status: 'success'; features: MeshFeatures }
  | { status: 'error'; message: string };

interface StlQuoteWorkerScope {
  onmessage: ((event: MessageEvent<ArrayBuffer>) => void) | null;
  postMessage: (message: StlQuoteWorkerResponse) => void;
}

const workerScope = self as unknown as StlQuoteWorkerScope;

workerScope.onmessage = (event) => {
  try {
    const features = analyzeStl(new Uint8Array(event.data), {
      buildVolumeMm: DEFAULT_PRINTER_CONFIG.buildVolumeMm,
    });
    workerScope.postMessage({ status: 'success', features });
  } catch (error) {
    workerScope.postMessage({
      status: 'error',
      message: error instanceof Error ? error.message : 'Không phân tích được tệp STL.',
    });
  }
};
