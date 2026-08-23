#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const rootDir = resolve(process.cwd());
const aiDir = join(rootDir, "ai-backend");
const isWin = process.platform === "win32";
const venvDir = join(aiDir, ".venv");

console.log("==========================================");
console.log("🐍 IntelliClass AI — Python Setup");
console.log("==========================================");

try {
  if (!existsSync(venvDir)) {
    console.log(`📦 Creating virtual environment at ${venvDir}...`);
    execSync("python -m venv .venv", { cwd: aiDir, stdio: "inherit" });
  } else {
    console.log(`ℹ️ Virtual environment already exists at ${venvDir}`);
  }

  const pipCmd = isWin
    ? join(venvDir, "Scripts", "pip.exe")
    : join(venvDir, "bin", "pip");

  console.log("📥 Installing requirements.txt...");
  execSync(`"${pipCmd}" install --upgrade pip`, { cwd: aiDir, stdio: "inherit" });
  execSync(`"${pipCmd}" install -r requirements.txt`, { cwd: aiDir, stdio: "inherit" });

  console.log("✅ Python AI Backend environment ready!");
} catch (err) {
  console.error("❌ Python environment setup failed:", err.message);
  process.exit(1);
}
