import { phoneSearchDigits } from "@/lib/format";

/**
 * PostgREST `or` filter for the customer search (BR-03): phone digits match anywhere in the stored
 * normalized phone, text matches the name. Characters that carry meaning in the filter syntax are dropped.
 */
export function customerSearchFilter(q: string): string | null {
  const query = q.trim();
  if (!query) return null;
  const digits = phoneSearchDigits(query);
  const looksLikePhone = /^[\d\s\-+().]+$/.test(query);
  if (looksLikePhone && digits.length >= 3) {
    return `phone.like.*${digits}*`;
  }
  const text = query.replace(/[,()*%\\:."']/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return digits.length >= 3 ? `full_name.ilike.*${text}*,phone.like.*${digits}*` : `full_name.ilike.*${text}*`;
}
