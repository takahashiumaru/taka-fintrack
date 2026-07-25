import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Get all files in app/api recursively
function getApiRoutes(dir: string, base: string = 'api'): string[] {
  let routes: string[] = [];
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      routes = routes.concat(getApiRoutes(fullPath, `${base}/${file}`));
    } else if (file === 'route.ts') {
      routes.push(`/${base}`);
    }
  }
  return routes;
}

export async function GET() {
  const apiDir = path.join(process.cwd(), 'app', 'api');
  const routes = getApiRoutes(apiDir);
  return NextResponse.json({ routes, count: routes.length });
}
