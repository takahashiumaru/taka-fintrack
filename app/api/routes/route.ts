import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export const runtime = "nodejs";

export async function GET() {
  const apiDir = path.join(process.cwd(), "app/api");
  
  const getRoutes = (dir: string): string[] => {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getRoutes(filePath));
      } else if (file === "route.ts") {
        // Convert dir path to API route path
        const route = dir.replace(apiDir, "/api");
        results.push(route);
      }
    });
    return results;
  };

  const routes = getRoutes(apiDir);
  return NextResponse.json({ routes });
}
