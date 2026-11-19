import type { BankDestination } from '../contracts/payments';

/** Manual VietQR is opt-in. Never infer a receiving account from demo/marketing content. */
export function manualVietQrDestination(environment: NodeJS.ProcessEnv = process.env): BankDestination | null {
  if (environment.MINHLAB_MANUAL_VIETQR_ENABLED !== 'true') return null;
  const bin = environment.MINHLAB_VIETQR_BANK_BIN?.trim() ?? '';
  const name = environment.MINHLAB_VIETQR_BANK_NAME?.trim() ?? '';
  const accountNumber = environment.MINHLAB_VIETQR_ACCOUNT_NUMBER?.trim() ?? '';
  const accountName = environment.MINHLAB_VIETQR_ACCOUNT_NAME?.trim() ?? '';
  if (
    !/^\d{6}$/.test(bin) ||
    !/^[A-Za-z0-9]{6,34}$/.test(accountNumber) ||
    !name ||
    name.length > 120 ||
    !accountName ||
    accountName.length > 120
  )
    return null;
  return { bin, name, accountNumber, accountName };
}
