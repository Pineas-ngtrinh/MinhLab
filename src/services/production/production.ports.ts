import type { RevisionInput, ProductionSnapshot, ProductionPlan, ProductionWorkspace, TechnicalCheckInput, Revision, Printer, PlanBody, ProductionJob } from '../../contracts/production';
export interface ProductionWriter {
    snapshot(): Promise<ProductionSnapshot>;
    workspace(): Promise<Omit<ProductionWorkspace, 'agent' | 'custom' | 'serverTime'>>;
    replay(key: string): Promise<{
        actorId: string;
        requestHash: string;
        result: unknown;
    } | null>;
    remember(key: string, actorId: string, requestHash: string, result: unknown): Promise<void>;
    audit(action: string, id: string, actorId: string, detail: unknown): Promise<void>;
    event(type: string, id: string): Promise<void>;
    saveRevision(input: RevisionInput, actorId: string): Promise<string>;
    setRevision(id: string, status: Revision['status'], actorId: string, verify?: boolean): Promise<void>;
    savePrinter(input: Omit<Printer, 'id'>, actorId: string, id?: string): Promise<string>;
    inventory(key: string, quantity: number, revision: number, actorId: string): Promise<void>;
    saveCheck(input: TechnicalCheckInput, actorId: string): Promise<string>;
    revokeCheck(id: string): Promise<void>;
    pinRequirements(itemIds: string[]): Promise<void>;
    savePlan(body: PlanBody, hash: string, actorId: string, id?: string, revision?: number): Promise<string>;
    plan(id: string): Promise<ProductionPlan | null>;
    decidePlan(id: string, status: string, actorId: string, note: string): Promise<void>;
    deletePlan(id: string, revision: number, actorId: string): Promise<void>;
    applyPlan(plan: ProductionPlan, actorId: string): Promise<void>;
    jobAction(job: ProductionJob, action: 'START' | 'FINISH' | 'QC_READY' | 'FAIL', actorId: string, machineFailure?: boolean): Promise<void>;
    inspect(job: ProductionJob, results: {
        supplyId: string;
        good: number;
        failed: number;
    }[], actorId: string): Promise<void>;
    pack(itemId: string, ready: boolean, actorId: string): Promise<void>;
}
export interface ProductionDependencies {
    transaction<T>(operation: (writer: ProductionWriter, notifications?: ProductionNotifications) => Promise<T>): Promise<T>;
    hash(value: unknown): string;
    now(): string;
}
export interface ProductionPlanNotification {
    planId: string;
    revision: number;
    status: 'WAITING_DATA' | 'PENDING_APPROVAL';
    orderCount: number;
    batchCount: number;
    blockerCount: number;
}
export interface ProductionNotifications {
    planProposed(input: ProductionPlanNotification): Promise<void>;
}
export interface ProductionActor {
    id: string;
    role: 'ADMIN' | 'WORKSHOP_OPERATOR' | 'PRINT_OPERATOR' | 'FILE_REVIEWER' | 'AGENT';
}
