#!/usr/bin/env node

import { rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const rootDir = resolve(process.cwd());

const targets = [
  join(rootDir, "model-next", ".next"),
  join(rootDir, "model-next", "tsconfig.tsbuildinfo"),
  join(rootDir, "ai-backend", "__pycache__"),
  join(rootDir, "ai-backend", "services", "__pycache__"),
];

console.log("🧹 Running conservative cache clean...");

targets.forEach((p) => {
  if (existsSync(p)) {
    try {
      rmSync(p, { recursive: true, force: true });
      console.log(`  🗑️ Removed: ${p}`);
    } catch (e) {
      console.warn(`  ⚠️ Could not remove ${p}:`, e.message);
    }
  }
});

console.log("✅ Clean complete!");
