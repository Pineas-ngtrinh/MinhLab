export interface CustomProductionItem {
    id: string;
    orderId: string;
    orderNumber: string;
    quantity: number;
    materialId: string;
    materialCode: string;
    technology: string;
    color: string;
    fileId: string;
    fileHash: string;
    fileReady: boolean;
    reviewerId: string;
    packedAt: string | null;
    readyAt: string | null;
    orderStatus: string;
    paymentStatus: string;
    length: number;
    width: number;
    height: number;
}
export interface CustomBatch {
    id: string;
    itemId: string;
    printerId: string;
    holdId: string;
    status: string;
    quantity: number;
    good: number;
    failed: number;
    startAt: string;
    finishAt: string;
    actualStartAt: string | null;
    actualFinishAt: string | null;
    profileId: string;
    evidenceCode: string;
}
export interface CustomProductionView {
    items: CustomProductionItem[];
    batches: CustomBatch[];
}
export interface CustomBatchInput {
    itemId: string;
    profileId: string;
    quantity: number;
    durationMinutes: number;
    materialQuantity: number;
    startAt: string;
    evidenceCode: string;
    confirmed: boolean;
}
