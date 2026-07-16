import { NextResponse } from 'next/server';
import { readPackageVersion } from '@/lib/server/version';

export async function GET() {
  const version = readPackageVersion();
  if (version === 'unknown') {
    return NextResponse.json({ error: 'Could not read version from package.json' }, { status: 500 });
  }
  return NextResponse.json({ version });
}
