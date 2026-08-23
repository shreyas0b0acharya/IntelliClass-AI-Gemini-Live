#!/usr/bin/env node

import { rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const rootDir = resolve(process.cwd());

const targets = [
  join(rootDir, "node_modules"),
  join(rootDir, "model-next", "node_modules"),
  join(rootDir, "model-next", ".next"),
  join(rootDir, "model-next", "tsconfig.tsbuildinfo"),
  join(rootDir, "HeadTTS", "node_modules"),
  join(rootDir, "ai-backend", ".venv"),
  join(rootDir, "ai-backend", "__pycache__"),
  join(rootDir, "ai-backend", "services", "__pycache__"),
];

console.log("🧨 Running deep monorepo clean (removes node_modules, .venv, and build caches)...");

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

console.log("✨ Deep clean complete. Run `pnpm install` and `pnpm setup:python` to reinstall.");
