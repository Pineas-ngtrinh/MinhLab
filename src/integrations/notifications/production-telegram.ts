import type { PoolClient } from 'pg';
import type { ProductionNotifications } from '../../services/production/production.ports';
import { enqueueTelegramNotification, telegramProductionPlanDraftMessage } from './telegram-outbox';

/** Queue operator alerts in the same transaction as the production draft. */
export function productionTelegramNotifications(client: PoolClient): ProductionNotifications {
    return {
        async planProposed(input) {
            await enqueueTelegramNotification(client, {
                dedupKey: `production-plan-drafted:${input.planId}:${input.revision}`,
                type: 'PRODUCTION_PLAN_DRAFTED',
                productionPlanId: input.planId,
                body: telegramProductionPlanDraftMessage(input),
            });
        },
    };
}
