import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: Request) {
  const user = await getSessionUser(req as any);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  return NextResponse.json({ user });
}
