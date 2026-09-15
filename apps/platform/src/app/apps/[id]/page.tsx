import { redirect } from 'next/navigation';
import { one, query } from '@/lib/db';
import { requireUser } from '@/lib/require-user';
import { AppView } from '@/components/AppView';

export const dynamic = 'force-dynamic';

export default async function AppDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // US-A02 AC4: the guard carries the exact page back to /login, so the user
  // returns to this app rather than the list.
  await requireUser(`/apps/${id}`);

  const app = await one('SELECT * FROM apps WHERE id = $1', [id]);
  if (!app) redirect('/apps');

  const pages = await query('SELECT * FROM pages WHERE app_id = $1 ORDER BY order_index', [id]);
  const workflows = await query('SELECT * FROM workflows WHERE app_id = $1 ORDER BY created_at DESC', [id]);

  // Fetch components for each page
  const pagesWithComponents = await Promise.all(
    pages.rows.map(async (p: any) => {
      const comps = await query('SELECT * FROM components WHERE page_id = $1 ORDER BY order_index', [p.id]);
      return { ...p, components: comps.rows };
    })
  );

  // Fetch steps for each workflow
  const workflowsWithSteps = await Promise.all(
    workflows.rows.map(async (w: any) => {
      const steps = await query('SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order', [w.id]);
      return { ...w, steps: steps.rows };
    })
  );

  return (
      <AppView
        app={app}
        pages={pagesWithComponents}
        workflows={workflowsWithSteps}
      />
    );
}
