import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const rootDir = path.resolve(import.meta.dirname, "..");

function tryExtensions(basePath) {
  const exts = [".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.js"];
  for (const ext of exts) {
    const candidate = basePath + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const subpath = specifier.slice(2);
    const fullPath = path.join(rootDir, subpath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return nextResolve(pathToFileURL(fullPath).href, context);
    }
    const resolved = tryExtensions(fullPath);
    if (resolved) {
      return nextResolve(pathToFileURL(resolved).href, context);
    }
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    if (context.parentURL && context.parentURL.startsWith("file:")) {
      const parentDir = path.dirname(new URL(context.parentURL).pathname.replace(/^\/([A-Z]:)/, "$1"));
      const target = path.resolve(parentDir, specifier);
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        const resolved = tryExtensions(target);
        if (resolved) {
          return nextResolve(pathToFileURL(resolved).href, context);
        }
      }
    }
  }
  return nextResolve(specifier, context);
}
