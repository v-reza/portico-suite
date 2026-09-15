import { safeNextPath } from '@/lib/next-path';
import { LoginForm } from '@/components/LoginForm';

/**
 * US-A02 AC4 — /login?next=<path>.
 *
 * The param is read on the server (not via useSearchParams in the client form),
 * so the page needs no Suspense boundary and the value is validated before it
 * ever reaches the browser.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <LoginForm nextPath={safeNextPath(next)} />;
}
