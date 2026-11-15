#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const rootDir = resolve(process.cwd());
const aiDir = join(rootDir, "ai-backend");

// Candidate directories to search for virtual environments
const searchDirs = [aiDir];

// If running in a git worktree, also search the main repository's ai-backend
try {
  const commonGitDir = execSync("git rev-parse --git-common-dir", {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "ignore"],
  }).trim();
  if (commonGitDir) {
    const mainRoot = resolve(join(commonGitDir, ".."));
    const mainAiDir = join(mainRoot, "ai-backend");
    if (mainAiDir !== aiDir && !searchDirs.includes(mainAiDir)) {
      searchDirs.push(mainAiDir);
    }
  }
} catch {
  // Ignore git errors if not a git repository
}

const isWin = process.platform === "win32";
let cmd = "python";
let args = ["-m", "uvicorn", "main:app", "--reload", "--port", "8000"];

for (const dir of searchDirs) {
  const venvUvicorn = isWin
    ? join(dir, ".venv", "Scripts", "uvicorn.exe")
    : join(dir, ".venv", "bin", "uvicorn");
  const venvPython = isWin
    ? join(dir, ".venv", "Scripts", "python.exe")
    : join(dir, ".venv", "bin", "python");

  if (existsSync(venvUvicorn)) {
    cmd = venvUvicorn;
    args = ["main:app", "--reload", "--port", "8000"];
    break;
  }
  if (existsSync(venvPython)) {
    cmd = venvPython;
    args = ["-m", "uvicorn", "main:app", "--reload", "--port", "8000"];
    break;
  }
}

console.log(`🐍 Starting AI Backend via: ${cmd} ${args.join(" ")} in ${aiDir}`);

const child = spawn(cmd, args, {
  cwd: aiDir,
  stdio: "inherit",
  env: {
    ...process.env,
    PYTHONUNBUFFERED: "1",
    PYTHONIOENCODING: "utf-8",
    PYTHONUTF8: "1",
  },
});

child.on("exit", (code) => {
  process.exit(code || 0);
});
