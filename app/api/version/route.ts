import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return NextResponse.json({ version: packageJson.version });
  } catch (error) {
    return NextResponse.json({ error: 'Could not read version from package.json' }, { status: 500 });
  }
}
