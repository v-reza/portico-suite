import { redirect } from 'next/navigation';

// Browsers default-request /favicon.ico even when <link rel="icon"> points at
// the SVG. Redirect the legacy path to the real icon so nothing 404s.
export function GET() {
  return redirect('/icon.svg');
}
