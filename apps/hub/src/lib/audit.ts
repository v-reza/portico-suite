import { query } from './db';

/**
 * Append-only activity log (US-M11 AC3: "perubahan itu tercatat di log aktivitas
 * Hub (siapa mengubah apa, kapan)").
 *
 * Never throws — an audit write must not be able to fail the action it records.
 */
export async function audit(
  actorId: string | null,
  action: string,
  subject: string | null,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    await query(
      'INSERT INTO hub_audit_log (actor_id, action, subject, detail) VALUES ($1, $2, $3, $4)',
      [actorId, action, subject, detail ? JSON.stringify(detail) : null],
    );
  } catch (err) {
    console.error('[audit] write failed:', (err as Error).message);
  }
}
