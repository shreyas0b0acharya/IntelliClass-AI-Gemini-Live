#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const rootDir = resolve(process.cwd());
const aiDir = join(rootDir, "ai-backend");

// Check for venv uvicorn executable
const isWin = process.platform === "win32";
const venvUvicornWin = join(aiDir, ".venv", "Scripts", "uvicorn.exe");
const venvUvicornPosix = join(aiDir, ".venv", "bin", "uvicorn");
const venvPythonWin = join(aiDir, ".venv", "Scripts", "python.exe");
const venvPythonPosix = join(aiDir, ".venv", "bin", "python");

let cmd = "python";
let args = ["-m", "uvicorn", "main:app", "--reload", "--port", "8000"];

if (isWin && existsSync(venvUvicornWin)) {
  cmd = venvUvicornWin;
  args = ["main:app", "--reload", "--port", "8000"];
} else if (!isWin && existsSync(venvUvicornPosix)) {
  cmd = venvUvicornPosix;
  args = ["main:app", "--reload", "--port", "8000"];
} else if (isWin && existsSync(venvPythonWin)) {
  cmd = venvPythonWin;
  args = ["-m", "uvicorn", "main:app", "--reload", "--port", "8000"];
} else if (!isWin && existsSync(venvPythonPosix)) {
  cmd = venvPythonPosix;
  args = ["-m", "uvicorn", "main:app", "--reload", "--port", "8000"];
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
