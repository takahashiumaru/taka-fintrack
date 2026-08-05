import { NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

export const runtime = "nodejs";

async function getApiRoutes(directory: string, apiBasePath: string): Promise<string[]> {
    let routes: string[] = [];
    try {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                routes = routes.concat(await getApiRoutes(fullPath, apiBasePath));
            } else if (entry.name === 'route.ts') {
                const routePath = path.dirname(fullPath)
                    .replace(apiBasePath, '/api')
                    .replace(/\\/g, '/'); // Normalize for Windows
                routes.push(routePath);
            }
        }
    } catch (error) {
        // Silently ignore directories that can't be read, like .next
        if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
             console.error(`Error reading directory ${directory}:`, error);
        }
    }
    return routes;
}


export async function GET() {
  const apiDir = path.join(process.cwd(), "app/api");
  const routes = (await getApiRoutes(apiDir, apiDir)).sort();
  return NextResponse.json({ routes });
}

