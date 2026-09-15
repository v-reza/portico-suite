import { redirect } from 'next/navigation';
import { one, query } from '@/lib/db';
import { requireUser } from '@/lib/require-user';
import { AppSettingsView } from '@/components/AppSettingsView';

export const dynamic = 'force-dynamic';

/**
 * `/apps/[id]/settings` — US-A07 AC1 (edit name/description) and AC5 (permanent
 * delete, admin). The ownership guard is server-side: an app from another
 * workspace must not render here (US-A04 AC6).
 */
export default async function AppSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/apps/${id}/settings`);

  const app = await one(
    'SELECT id, name, slug, description, is_published, archived_at, org_id FROM apps WHERE id = $1',
    [id],
  );
  if (!app) redirect('/apps');
  if (app.org_id !== user.org_id) redirect('/apps');

  const counts = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM pages WHERE app_id = $1) AS pages,
       (SELECT COUNT(*)::int FROM components c JOIN pages p ON p.id = c.page_id WHERE p.app_id = $1) AS components,
       (SELECT COUNT(*)::int FROM app_data_rows WHERE app_id = $1) AS rows`,
    [id],
  );

  return (
    <AppSettingsView
      user={{ name: user.name, role: user.role }}
      app={app}
      counts={counts.rows[0]}
    />
  );
}
