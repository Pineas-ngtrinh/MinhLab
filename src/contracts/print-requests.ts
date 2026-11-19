export interface PrintContact {
    name: string;
    phone: string;
    address: string;
}
export interface PrintSubmission {
    fileId: string | null;
    quantity: number;
    material: string;
    color: string;
    purpose: string;
    note: string;
    rightsAccepted: boolean;
    contact: PrintContact;
}
export interface PrintFileRetention {
    id: string;
    availability: 'AVAILABLE' | 'PROCESSING' | 'PURGED';
    scheduledDeletionAt: string | null;
    retentionReason: string;
}
export interface PrintFileHold {
    id: string;
    reason: string;
    reviewAt: string;
    overdue: boolean;
}
export interface PrivatePrintFile {
    originalFilename?: string;
    id: string;
    scanStatus: string;
    analysisStatus: string;
    bytes: number;
    availability?: PrintFileRetention['availability'];
    scheduledDeletionAt?: string | null;
    analysis: {
        bboxMm: {
            w: number;
            d: number;
            h: number;
        };
        triangleCount: number;
        flags: string[];
    } | null;
}
export interface PrintQuote {
    id: string;
    revision: number;
    requestRevision: number;
    status: string;
    quantity: number;
    unitPrice: number;
    shipping: number;
    total: number;
    validUntil: string;
    promisedFinishAt: string;
    terms: string;
    termsHash: string;
    orderNumber: string | null;
    spec: {
        material: string;
        color: string;
        length: number;
        width: number;
        height: number;
        scale: number;
    };
}
export interface PrintRequestView {
    closedReason?: string | null;
    retainedFiles?: PrintFileRetention[];
    fileHolds?: PrintFileHold[];
    id: string;
    number: string;
    revision: number;
    status: string;
    assignedReviewerId: string | null;
    itemId: string;
    quantity: number;
    requested: {
        material: string;
        color: string;
        purpose: string;
    };
    note: string;
    rightsAccepted: boolean;
    contact: PrintContact;
    file: PrivatePrintFile | null;
    issue: string | null;
    quotes: PrintQuote[];
}
export interface PrintQuoteInput {
    requestId: string;
    revision: number;
    materialId: string;
    color: string;
    length: number;
    width: number;
    height: number;
    scale: number;
    unitPrice: number;
    shipping: number;
    validUntil: string;
    promisedFinishAt: string;
    terms: string;
    evidenceCode: string;
    checksConfirmed: boolean;
}
export interface PrintRequestWorkspace {
    pagination: import('./pagination').PageInfo;
    requests: PrintRequestView[];
    materials: {
        id: string;
        name: string;
    }[];
    reviewers: {
        id: string;
        name: string;
    }[];
    privateFilesConfigured: boolean;
}
