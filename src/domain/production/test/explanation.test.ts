import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explainPlan } from '../../../integrations/production/plan-explanation';
test('provider outage or unexpected text cannot change the local explanation', async () => {
    const totals = { orders: 3, batches: 1, blockers: 0 };
    const config = { provider: 'groq', model: 'fixture', apiKey: 'fixture' } as const;
    const expected = await explainPlan(totals, null);
    assert.equal(await explainPlan(totals, config, async () => { throw Error('timeout'); }), expected);
    assert.equal(await explainPlan(totals, config, async () => Response.json({ choices: [{ message: { content: 'APPROVE' } }] })), expected);
    assert.match(await explainPlan(totals, config, async () => Response.json({ choices: [{ message: { content: '2' } }] })), /Xem từng mẻ/);
});

import { batchingDue } from '../batch-trigger';
test('multiple lines do not inflate trigger; the oldest order releases the wait at the boundary', () => {
    const line = { orderId: 'a', placedAt: '2026-01-01T00:00:00Z' };
    const now = Date.parse(line.placedAt);
    assert.equal(batchingDue([line,line,line],now,3,2),false);
    assert.equal(batchingDue([line],now+7200000,3,2),true);
    assert.equal(batchingDue([line,{...line,orderId:'b'}],now,2,2),true);
});
