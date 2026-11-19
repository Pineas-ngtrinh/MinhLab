/** Approved plans retain their resource allocations and production history. */
export function canDeleteProductionPlan(status: string): boolean {
    return ['WAITING_DATA', 'PENDING_APPROVAL', 'REJECTED', 'STALE', 'SUPERSEDED'].includes(status);
}
