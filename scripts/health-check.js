import fs from "fs";
import path from "path";

const rootDir = process.cwd();

console.log("Checking project integrity...");

let hasError = false;

// 1. Check required configuration files
const reqFiles = ["package.json", "tsconfig.json", "next.config.mjs", "capacitor.config.ts"];
reqFiles.forEach((file) => {
  if (fs.existsSync(path.join(rootDir, file))) {
    console.log(`[OK] Found ${file}`);
  } else {
    console.error(`[ERROR] Missing required file: ${file}`);
    hasError = true;
  }
});


// 2. Warn about .env files
const envFile = path.join(rootDir, ".env.local");
if (!fs.existsSync(envFile)) {
  console.log("[WARN] .env.local not found. Application might run with default env configuration.");
} else {
  console.log("[OK] Found .env.local");
}

if (hasError) {
  console.error("Health check failed!");
  process.exit(1);
} else {
  console.log("Health check passed! Project is ready for builds.");
  process.exit(0);
}
