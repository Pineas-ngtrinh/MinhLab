import type { PrintRequestView, PrintSubmission, PrintQuoteInput } from '../../contracts/print-requests';
import type { PageOptions, PageResult } from '../../contracts/pagination';
import type { AcceptedCustomQuote } from '../../domain/orders/accepted-quote';
export interface RequestState {
    view: PrintRequestView;
    ownerId: string;
    email: string;
    attachmentId: string | null;
    fileHash: string | null;
}
export interface RequestWriter {
    list(ownerId: string | undefined, options: PageOptions, reviewerId?: string): Promise<PageResult<PrintRequestView>>;
    request(id: string): Promise<RequestState | null>;
    fileOwner(id: string, ownerId: string): Promise<boolean>;
    confirmManualAnalysis(r: RequestState, actorId: string, bbox: {
        w: number;
        d: number;
        h: number;
    }, evidenceCode: string): Promise<boolean>;
    submit(input: PrintSubmission, actorId: string, existing?: RequestState): Promise<string>;
    lifecycle(id: string, action: 'CLOSE' | 'REOPEN' | 'HOLD' | 'RELEASE_HOLD', actorId: string, note: string, reviewAt?: string, holdId?: string): Promise<void>;
    canReuseFiles(id: string): Promise<boolean>;
    claim(id: string, reviewerId: string): Promise<void>;
    assign(id: string, reviewerId: string): Promise<void>;
    reviewerExists(id: string): Promise<boolean>;
    decline(id: string, quoteId: string, note: string): Promise<void>;
    decision(r: RequestState, status: 'NEEDS_REVISION' | 'REJECTED', note: string, actorId: string): Promise<void>;
    material(id: string): Promise<{
        id: string;
        name: string;
    } | null>;
    issue(r: RequestState, input: PrintQuoteInput, termsHash: string, actorId: string): Promise<string>;
    conversion(quoteId: string): Promise<{
        number: string;
    } | null>;
    convert(r: RequestState, quoteId: string, actorId: string, input: Omit<AcceptedCustomQuote, 'customerId' | 'email' | 'name' | 'phone' | 'address' | 'specificationId'>): Promise<{
        number: string;
    }>;
    audit(action: string, id: string, actorId: string, detail: unknown): Promise<void>;
    replay(key: string): Promise<{
        actorId: string;
        hash: string;
        result: unknown;
    } | null>;
    remember(key: string, actorId: string, hash: string, result: unknown): Promise<void>;
}
export interface RequestDependencies {
    transaction<T>(op: (w: RequestWriter) => Promise<T>): Promise<T>;
    hash(value: unknown): string;
    now(): string;
}
export interface RequestActor {
    id: string;
    role: 'CUSTOMER' | 'FILE_REVIEWER' | 'ADMIN';
}
