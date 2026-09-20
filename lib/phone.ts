// Loose E.164 normalization for matching phone numbers across leads,
// deals, and inbound WhatsApp messages. Not a validator — just enough to
// make "(555) 123-4567" and "+15551234567" compare equal. Assumes US/CA
// numbers when no country code is present, which is a reasonable default
// for a single-location US dealership; revisit if that stops being true.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export function formatPhoneForDisplay(e164: string | null | undefined): string {
  if (!e164) return "";
  const match = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
  return e164;
}
