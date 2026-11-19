import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const deriveKey = promisify(scrypt);

export const authPasswords = {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const digest = (await deriveKey(password, salt, 64) as Buffer).toString('hex');
    return `scrypt$${salt}$${digest}`;
  },

  async verify(password: string, storedHash: string): Promise<boolean> {
    const [scheme, salt, digest, extra] = storedHash.split('$');
    if (scheme !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(digest ?? '') || extra !== undefined) return false;
    const expected = Buffer.from(digest, 'hex');
    const candidate = await deriveKey(password, salt, expected.length) as Buffer;
    return expected.length === candidate.length && timingSafeEqual(candidate, expected);
  },
};

export const authTokens = {
  createEmailCode: (): string => randomInt(0, 100_000_000).toString().padStart(8, '0'),
  create: (): string => randomBytes(32).toString('base64url'),
  hash: (token: string): string => createHash('sha256').update(token).digest('hex'),
};
