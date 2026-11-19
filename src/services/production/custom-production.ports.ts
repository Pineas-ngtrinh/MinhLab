import type { CustomProductionView, CustomBatchInput, CustomBatch } from '../../contracts/custom-production';
import type { ProductionSnapshot } from '../../contracts/production';
export interface CustomProductionWriter {
    view(): Promise<CustomProductionView>;
    resources(): Promise<ProductionSnapshot>;
    replay(key: string): Promise<{
        actorId: string;
        hash: string;
        result: unknown;
    } | null>;
    remember(key: string, actorId: string, hash: string, result: unknown): Promise<void>;
    approve(input: CustomBatchInput, actorId: string): Promise<string>;
    step(batch: CustomBatch, action: 'START' | 'FINISH' | 'QC_READY' | 'FAIL', actorId: string): Promise<void>;
    qc(batch: CustomBatch, good: number, failed: number, actorId: string): Promise<void>;
    pack(itemId: string, ready: boolean, actorId: string): Promise<void>;
    audit(action: string, id: string, actorId: string, detail: unknown): Promise<void>;
}
export interface CustomProductionDependencies {
    transaction<T>(run: (w: CustomProductionWriter) => Promise<T>): Promise<T>;
    hash(value: unknown): string;
    now(): string;
}
