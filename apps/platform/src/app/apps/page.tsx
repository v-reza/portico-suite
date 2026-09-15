import { requireUser } from '@/lib/require-user';
import { AppsView } from '@/components/AppsView';

/**
 * US-A02 AC4/AC5 — guarded by requireUser(), which redirects to
 * /login?next=/apps and marks the page no-store (see next.config.mjs).
 */
export const dynamic = 'force-dynamic';

export default async function AppsPage() {
  const u = await requireUser('/apps');

  return <AppsView user={{ name: u.name, role: u.role }} />;
}
