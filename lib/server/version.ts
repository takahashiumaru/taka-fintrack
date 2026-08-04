import * as fs from "fs";
import * as path from "path";

export function getVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    return pkg.version ?? "1.0.0";
  } catch {
    return "1.0.0";
  }
}
