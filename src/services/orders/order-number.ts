import { randomBytes } from 'node:crypto';

const ORDER_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Create a short, speakable public reference with 64 bits of cryptographic randomness. */
export function createOrderNumber(): string {
  let value = randomBytes(8).readBigUInt64BE();
  let code = '';

  for (let index = 0; index < 13; index += 1) {
    code = ORDER_CODE_ALPHABET[Number(value & 31n)] + code;
    value >>= 5n;
  }

  return `ML-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`;
}
