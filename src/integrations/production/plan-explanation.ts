import type { AgentConfig } from './openai-agent';

export interface PlanTotals { orders: number; batches: number; blockers: number }

/** The provider sees counts only. It can choose wording, never operational parameters. */
export async function explainPlan(t: PlanTotals, config: AgentConfig | null, request: typeof fetch = fetch): Promise<string> {
    const facts = t.blockers ? `Cần xử lý ${t.blockers} mục trước khi duyệt kế hoạch cho ${t.orders} đơn.`
        : `Kế hoạch cho ${t.orders} đơn có ${t.batches} mẻ in, đang chờ người vận hành duyệt.`;
    if (!config) return facts;
    const alternatives = t.blockers ? ['Mở kế hoạch để xem các mục cần bổ sung.', 'Kiểm tra các mục còn thiếu trong kế hoạch.']
        : ['Kiểm tra lịch và phân bổ trước khi duyệt.', 'Xem từng mẻ in trước khi xác nhận.'];
    try {
        const url = config.provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
        const response = await request(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
            headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: config.model, max_completion_tokens: 40, messages: [
                { role: 'system', content: 'Chọn câu nhắc rõ hơn cho người vận hành. Chỉ trả lời 1 hoặc 2.' },
                { role: 'user', content: JSON.stringify({ facts, alternatives }) },
            ] }) });
        if (!response.ok) return facts;
        const selection: unknown = (await response.json())?.choices?.[0]?.message?.content;
        return selection === '1' || selection === '2' ? facts + ' ' + alternatives[Number(selection)-1] : facts;
    } catch { return facts; }
}
