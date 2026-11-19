import assert from 'node:assert/strict';
import { test } from 'node:test';
import { productionAgentConfig, runGroqProductionAgent, runOpenAIProductionAgent } from '../../../integrations/production/openai-agent';
import { agentMetadata } from '../../../server/production-agent';
import type { ProductionSnapshot } from '../../../contracts/production';
test('provider calls require explicit model, provider, key and metadata authorization', () => {
    assert.equal(productionAgentConfig({ NODE_ENV: 'test' }), null);
    assert.equal(productionAgentConfig({ NODE_ENV: 'test', MINHLAB_PRODUCTION_AGENT_ENABLED: 'true', MINHLAB_PRODUCTION_AGENT_PROVIDER: 'openai', MINHLAB_PRODUCTION_AGENT_MODEL: 'fixture-model', MINHLAB_PRODUCTION_AGENT_API_KEY: 'fixture-key' }), null);
    assert.equal(productionAgentConfig({ NODE_ENV: 'production', MINHLAB_PRODUCTION_AGENT_ENABLED: 'true', MINHLAB_PRODUCTION_AGENT_METADATA_AUTHORIZED: 'true', MINHLAB_PRODUCTION_AGENT_PROVIDER: 'groq', MINHLAB_PRODUCTION_AGENT_MODEL: 'openai/gpt-oss-20b', MINHLAB_PRODUCTION_AGENT_API_KEY: 'fixture-key' })?.provider, 'groq');
    assert.equal(productionAgentConfig({ NODE_ENV: 'production', MINHLAB_PRODUCTION_AGENT_ENABLED: 'true', MINHLAB_PRODUCTION_AGENT_METADATA_AUTHORIZED: 'true', MINHLAB_PRODUCTION_AGENT_PROVIDER: 'groq', MINHLAB_PRODUCTION_AGENT_MODEL: 'bad/model/name', MINHLAB_PRODUCTION_AGENT_API_KEY: 'fixture-key' }), null);
});
test('agent metadata projection excludes file paths, evidence, customer fields and prices even if source labels contain them', () => {
    const source = { revisions: [{ id: 'c', kind: 'COMPONENT', code: 'private-file.stl', revision: 1, status: 'PUBLISHED', verifiedBy: 'operator', verifiedAt: null, printerId: null, variantId: null, body: { name: '/private/workshop/model.stl', unit: '/private/unit.gcode', routing: 'PRINTED', objectsPerUnit: 2, mirrorRequired: true, technology: 'FDM', material: 'PLA', color: 'BLACK', appearance: 'OPAQUE' } }], items: [], inventory: [], checks: [], printers: [], supplies: [], holds: [], jobs: [] } satisfies ProductionSnapshot;
    const payload = JSON.stringify(agentMetadata(source, []));
    assert(!payload.includes('/private'));
    assert(!payload.includes('.stl'));
    assert(!payload.includes('gcode'));
});
test('provider fixture can only read then propose a draft; approval is never an exposed tool', async () => {
    let calls = 0;
    let drafts = 0;
    const fetchImpl: typeof fetch = async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        assert.equal(body.store, false);
        assert.equal(body.parallel_tool_calls, false);
        assert.equal(body.tools.length, 1);
        assert(!JSON.stringify(body.tools).includes('approve_production'));
        calls++;
        return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'function_call', name: calls === 1 ? 'read_production_metadata' : 'create_draft_production_plan', call_id: `call_${calls}`, arguments: calls === 1 ? '{}' : JSON.stringify({ itemIds: ['fixture-item'], checkIds: [] }) }] }));
    };
    const result = await runOpenAIProductionAgent({ provider: 'openai', model: 'fixture-model', apiKey: 'fixture-never-sent' }, { read: async () => ({ safe: true }), draft: async () => { drafts++; return { id: 'fixture-plan' }; } }, fetchImpl);
    assert.equal(result.id, 'fixture-plan');
    assert.equal(calls, 2);
    assert.equal(drafts, 1);
});
test('malicious or malformed provider output cannot invoke another tool or create a draft', async () => {
    let writes = 0;
    await assert.rejects(runOpenAIProductionAgent({ provider: 'openai', model: 'fixture-model', apiKey: 'fixture-never-sent' }, { read: async () => ({}), draft: async () => { writes++; return { id: 'bad' }; } }, async () => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'function_call', name: 'approve_plan', call_id: 'x', arguments: '{}' }] }))), /tool/);
    assert.equal(writes, 0);
});

test('Groq adapter performs only the scoped read and unapproved draft tool calls', async () => {
    let calls = 0;
    let drafts = 0;
    const fetchImpl: typeof fetch = async (url, init) => {
        assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
        const body = JSON.parse(String(init?.body));
        assert.equal(body.parallel_tool_calls, false);
        assert.equal(body.max_completion_tokens, 2000);
        assert.equal(body.tools.length, 1);
        assert.equal(body.tool_choice.function.name, body.tools[0].function.name);
        assert(!JSON.stringify(body.tools).includes('approve_plan'));
        calls++;
        const name = calls === 1 ? 'read_production_metadata' : 'create_draft_production_plan';
        const argumentsText = calls === 1 ? '{}' : JSON.stringify({ itemIds: ['fixture-item'], checkIds: [] });
        return new Response(JSON.stringify({
            choices: [{
                finish_reason: 'tool_calls',
                message: { role: 'assistant', tool_calls: [{ id: `groq_${calls}`, type: 'function', function: { name, arguments: argumentsText } }] },
            }],
        }));
    };
    const result = await runGroqProductionAgent({ provider: 'groq', model: 'openai/gpt-oss-20b', apiKey: 'fixture-never-sent' }, { read: async () => ({ safe: true }), draft: async () => { drafts++; return { id: 'fixture-plan' }; } }, fetchImpl);
    assert.equal(result.id, 'fixture-plan');
    assert.equal(calls, 2);
    assert.equal(drafts, 1);
});

test('Groq tool output outside the allowed read tool cannot create a draft', async () => {
    let drafts = 0;
    await assert.rejects(runGroqProductionAgent({ provider: 'groq', model: 'openai/gpt-oss-20b', apiKey: 'fixture-never-sent' }, { read: async () => ({}), draft: async () => { drafts++; return { id: 'bad' }; }, }, async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'tool_calls', message: { tool_calls: [{ id: 'call_bad', type: 'function', function: { name: 'approve_plan', arguments: '{}' } }] } }] }))), /tool/);
    assert.equal(drafts, 0);
});
