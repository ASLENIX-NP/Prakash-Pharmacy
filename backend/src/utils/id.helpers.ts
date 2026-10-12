/**
 * Prakash Pharmacy - ID Formatting and Parsing Helpers
 * Provides standardized human-friendly IDs:
 * - Medicine / Inventory: MED-001, MED-002, etc.
 * - Storage Racks:        RCK-001, RCK-002, etc.
 * - Categories:           CAT-001, CAT-002, etc.
 * - Generics:             GEN-001, GEN-002, etc.
 */

export const formatMedicineCode = (id: number): string =>
  `MED-${String(id).padStart(3, "0")}`;

export const formatRackCode = (id: number): string =>
  `RCK-${String(id).padStart(3, "0")}`;

export const formatCategoryCode = (id: number): string =>
  `CAT-${String(id).padStart(3, "0")}`;

export const formatGenericCode = (id: number): string =>
  `GEN-${String(id).padStart(3, "0")}`;

/**
 * Parses route parameter into integer database ID.
 * Supports:
 * - Formatted codes: "MED-001", "med-1", "RCK-005", "cat-3" -> 1, 5, 3
 * - Pure numeric strings: "1", "42" -> 1, 42
 */
export const parseIdParam = (
  param: string | string[] | undefined | null
): number | null => {
  if (!param) return null;
  const str = Array.isArray(param) ? param[0] : String(param);
  if (!str) return null;
  const trimmed = str.trim();
  const match = trimmed.match(/\d+$/);
  if (match) {
    const num = parseInt(match[0], 10);
    return isNaN(num) ? null : num;
  }
  return null;
};
