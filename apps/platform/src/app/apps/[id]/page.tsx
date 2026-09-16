import { redirect } from 'next/navigation';
import { one, query } from '@/lib/db';
import { requireUser } from '@/lib/require-user';
import { AppView } from '@/components/AppView';

export const dynamic = 'force-dynamic';

export default async function AppDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // US-A02 AC4: the guard carries the exact page back to /login, so the user
  // returns to this app rather than the list.
  const user = await requireUser(`/apps/${id}`);

  const app = await one('SELECT * FROM apps WHERE id = $1', [id]);
  if (!app) redirect('/apps');
  // US-A04 AC6: an app from another workspace must not render here. This is the
  // SSR page the public link and list guard the same way, and the `?id` value
  // any cross-tenant probe guesses first. Like `/apps/[id]/settings`, a forbidden
  // app redirects to the list — the refusal leaks no name, page, or workflow.
  // The API layer distinguishes 403 from 404 (`tenant.ts`) so a probe can be
  // alerted on; the page answers with the same generic list redirect either way.
  if (app.org_id !== user.org_id) redirect('/apps');

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
