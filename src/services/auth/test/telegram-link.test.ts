import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTelegramLinkStart } from '../../../integrations/notifications/telegram-link';
import { createTelegramLinkService, type TelegramLinkRepository } from '../telegram-link.service';

const token = 'a'.repeat(43);
const start = { message: { text: `/start link_${token}`, chat: { type: 'private', id: 99 }, from: { id: 99, first_name: 'Test', username: 'fixture', is_bot: false } } };
test('linking accepts only private human Start messages with exact secret payload', () => {
  assert.deepEqual(parseTelegramLinkStart(start), { token, telegramId: '99', name: 'Test (@fixture)' });
  assert.equal(parseTelegramLinkStart({ ...start, message: { ...start.message, chat: { type: 'group', id: -99 } } }), null);
  assert.equal(parseTelegramLinkStart({ ...start, message: { ...start.message, chat: { type: 'private', id: 100 } } }), null);
  assert.equal(parseTelegramLinkStart({ ...start, message: { ...start.message, from: { id: 99, is_bot: true } } }), null);
  assert.equal(parseTelegramLinkStart({ ...start, message: { ...start.message, text: '/start link_short' } }), null);
  assert.equal(parseTelegramLinkStart({ callback_query: start.message }), null);
});
test('link start hashes secret before persistence and bounds account attempts', async () => {
  let attempts = 0;
  const stored: unknown[][] = [];
  const repository: TelegramLinkRepository = {
    async status() { return { linkedId: null, pending: null, waiting: false }; },
    async start(...args) { stored.push(args); }, async propose() { return true; }, async confirm() {}, async unlink() {},
  };
  const service = createTelegramLinkService({ repository, recordAttempt: async () => ++attempts, hash: value => `hashed:${value}`, token: () => token, requestId: () => 'request', botUsername: async () => 'fixture_bot' });
  const result = await service.start('user');
  assert.equal(result.url, `https://t.me/fixture_bot?start=link_${token}`);
  assert.deepEqual(stored[0], ['user', 'request', `hashed:${token}`]);
  for (let i = 0; i < 4; i++) await service.start('user');
  await assert.rejects(service.start('user'), /quá nhiều/);
  assert.equal(stored.length, 5);
  assert.equal(await service.propose({ token, telegramId: '-99', name: 'group' }), false);
  await assert.rejects(service.confirm('user', 'bad'), /không hợp lệ/);
});
