import { SITE_CONFIG } from '../config/site.config';

export const CHECKOUT_CONTACT_FIELDS = ['fullName', 'email', 'phone', 'address'] as const;
export type CheckoutContactField = typeof CHECKOUT_CONTACT_FIELDS[number];
export type CheckoutContactValues = Record<CheckoutContactField, string>;
export type CheckoutContactErrors = Partial<Record<CheckoutContactField, string>>;

/** Browser feedback mirrors the contact checks in parseOrderInput; server validation remains authoritative. */
export function validateCheckoutContact(values: CheckoutContactValues): CheckoutContactErrors {
  const copy = SITE_CONFIG.checkout.validation;
  const errors: CheckoutContactErrors = {};
  if (!values.fullName.trim()) errors.fullName = copy.fullName;
  if (!values.email.trim()) errors.email = copy.email;
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = copy.emailFormat;
  if (!values.phone.trim()) errors.phone = copy.phone;
  else if (!/^\+?[0-9 ()-]{8,20}$/.test(values.phone.trim())) errors.phone = copy.phoneFormat;
  if (!values.address.trim()) errors.address = copy.address;
  return errors;
}
