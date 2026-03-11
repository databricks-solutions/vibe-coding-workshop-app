/**
 * Reusable naming utilities for deriving Databricks identifiers
 * (catalog names, schema names, user prefixes, etc.).
 *
 * Mirrors the backend logic in src/backend/api/routes.py (user_schema_prefix derivation)
 * so the frontend can compute the same values without a round-trip.
 */

/** Normalize a string into a safe SQL / Unity Catalog identifier slug. */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Derive user prefix from a Databricks email address.
 *
 * "varunrao.bhamidimarri@databricks.com" → "varunrao_b"
 * "alice@example.com"                    → "alice"
 */
export function deriveUserPrefix(email: string): string {
  if (!email || !email.includes('@')) return 'user';
  const local = email.split('@')[0];
  const parts = local.split('.');
  const first = parts[0].toLowerCase();
  const lastInit =
    parts.length > 1 && parts[1] ? parts[1][0].toLowerCase() : '';
  return lastInit ? `${first}_${lastInit}` : first;
}

/**
 * Derive a fully-qualified schema name for a given medallion layer.
 *
 * deriveSchemaName("varunrao.b@db.com", "Booking App", "gold")
 *   → "varunrao_b_booking_app_gold"
 *
 * @param email        - User's email address
 * @param useCaseLabel - Human-readable use case label (e.g. "Booking App")
 * @param layer        - Medallion layer: "bronze" | "silver" | "gold" | custom
 */
export function deriveSchemaName(
  email: string,
  useCaseLabel: string,
  layer: string = 'gold',
): string {
  const prefix = deriveUserPrefix(email);
  const slug = slugify(useCaseLabel);
  return slug ? `${prefix}_${slug}_${layer}` : `${prefix}_${layer}`;
}
