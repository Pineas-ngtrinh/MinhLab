/** Authorized metadata only. No manufacturing file, download URL or customer data. */
export type Routing = 'PRINTED' | 'STOCKED' | 'PURCHASED' | 'FINISHING';
export interface ComponentSpec {
    /** Envelope of one oriented production unit, including all mirrored objects/supports. Millimetres. */
    envelope?: { width: number; depth: number; height: number };
    geometryCode?: string;
    finishedColor?: string;
    name: string;
    unit: string;
    routing: Routing;
    objectsPerUnit: number | null;
    mirrorRequired: boolean;
    technology: 'FDM' | 'SLA' | '';
    material: string;
    color: string;
    appearance: string;
}
export interface BomSpec {
    lines: {
        componentRevisionId: string;
        quantity: number;
    }[];
}
export type GroupingRule = {
    id: string; priority: number; effect: 'ALLOW'|'DENY';
    field: 'geometryCode'|'finishedColor'|'material'|'color'|'appearance';
    value: string;
};

export interface ProfileSpec {
    groupingRules?: GroupingRule[];
    plate?: { width: number; depth: number; height: number; margin: number; spacing: number };
    name: string;
    technology: 'FDM' | 'SLA' | '';
    material: string;
    color: string;
    appearance: string;
    processCode: string;
}
export type Revision = {
    id: string;
    code: string;
    revision: number;
    status: 'DRAFT' | 'PUBLISHED' | 'REVOKED';
    verifiedBy: string | null;
    verifiedAt: string | null;
} & ({
    kind: 'COMPONENT';
    body: ComponentSpec;
    variantId: null;
    printerId: null;
} | {
    kind: 'BOM';
    body: BomSpec;
    variantId: string;
    printerId: null;
} | {
    kind: 'PROFILE';
    body: ProfileSpec;
    variantId: null;
    printerId: string;
});
export type RevisionInput = {
    code: string;
} & ({
    kind: 'COMPONENT';
    body: ComponentSpec;
} | {
    kind: 'BOM';
    variantId: string;
    body: BomSpec;
} | {
    kind: 'PROFILE';
    printerId: string;
    body: ProfileSpec;
});
export interface ProductionItem {
    id: string;
    orderId: string;
    orderNumber: string;
    variantId: string;
    sku: string;
    quantity: number;
    placedAt: string;
    orderStatus: string;
    paymentStatus: string;
    paymentTiming: string;
    bomRevisionId: string | null;
    groupId: string | null;
    packedAt: string | null;
    dispatchReadyAt: string | null;
}
export interface ProductionSupply {
    id: string;
    itemId: string;
    componentRevisionId: string | null;
    jobId: string | null;
    quantity: number;
    good: number;
    failed: number;
    inspectedAt: string | null;
}
export interface Inventory {
    key: string;
    available: number;
    revision: number;
}
export interface Printer {
    id: string;
    code: string;
    name: string;
    technology: 'FDM' | 'SLA';
    status: string;
}
export interface TechnicalCheckInput {
    code: string;
    profileRevisionId: string;
    members: {
        componentRevisionId: string;
        quantity: number;
    }[];
    durationMinutes: number;
    preparationMinutes: number;
    finishingMinutes: number;
    materialQuantity: number;
    evidenceCode: string;
    resourcesConfirmed: boolean;
}
export interface TechnicalCheck extends TechnicalCheckInput {
    id: string;
    verifiedBy: string;
    revoked: boolean;
}
export interface MachineHold {
    id: string;
    printerId: string;
    groupId: string;
    itemIds: string[];
}
export interface ProductionJob {
    id: string;
    number: string;
    printerId: string;
    holdId: string;
    status: string;
    startAt: string;
    finishAt: string;
    actualStartAt: string | null;
    actualFinishAt: string | null;
    check: TechnicalCheck;
    supplies: ProductionSupply[];
}
export interface ProductionSnapshot {
    revisions: Revision[];
    items: ProductionItem[];
    inventory: Inventory[];
    checks: TechnicalCheck[];
    printers: Printer[];
    supplies: ProductionSupply[];
    holds: MachineHold[];
    jobs: ProductionJob[];
}
export interface PlannedStock {
    itemId: string;
    componentRevisionId: string | null;
    key: string;
    quantity: number;
}
export interface PlannedJob {
    checkId: string;
    printerId: string;
    startAt: string;
    finishAt: string;
    packingAt: string;
    allocations: {
        itemId: string;
        componentRevisionId: string;
        quantity: number;
    }[];
}
export interface PlanBody {
    itemIds: string[];
    stocks: PlannedStock[];
    jobs: PlannedJob[];
    blockers: string[];
    groupId: string | null;
    warnings: string[];
}
export interface ProductionPlan {
    id: string;
    revision: number;
    status: string;
    snapshotHash: string;
    body: PlanBody;
    proposedBy: string;
    decisionNote: string | null;
}
export interface ProductionWorkspace extends ProductionSnapshot {
    serverTime: string;
    custom: import('./custom-production').CustomProductionView;
    plans: ProductionPlan[];
    variants: {
        id: string;
        sku: string;
        name: string;
    }[];
    agent: {
        status: 'WAITING_CONFIGURATION' | 'CONFIGURED';
        message: string;
    };
}
