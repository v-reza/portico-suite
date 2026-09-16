import { requireUser } from '@/lib/require-user';
import { SettingsView } from '@/components/SettingsView';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const u = await requireUser('/settings');
  return <SettingsView user={{ id: u.id, name: u.name, role: u.role }} />;
}