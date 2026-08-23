#!/usr/bin/env node

import http from "node:http";
import process from "node:process";

const services = [
  { name: "Frontend & Studio", port: 3000, path: "/api/health" },
  { name: "AI RAG Backend", port: 8000, path: "/health" },
  { name: "HeadTTS Lip-Sync", port: 8882, path: "/health" },
];

function checkService({ name, port, path }) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: "127.0.0.1",
        port,
        path,
        timeout: 2500,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ name, port, ok: true, status: res.statusCode, body: data });
          } else {
            resolve({ name, port, ok: false, status: res.statusCode, error: `HTTP ${res.statusCode}` });
          }
        });
      }
    );

    req.on("error", (err) => {
      resolve({ name, port, ok: false, error: err.message });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ name, port, ok: false, error: "Connection timed out" });
    });
  });
}

async function run() {
  console.log("\n🏥 ==========================================");
  console.log("   IntelliClass AI — Health Check Monitor   ");
  console.log("==========================================\n");

  const results = await Promise.all(services.map(checkService));
  let allHealthy = true;

  results.forEach((r) => {
    if (r.ok) {
      console.log(`  🟢 [HEALTHY] ${r.name.padEnd(20)} http://localhost:${r.port} -> OK`);
    } else {
      allHealthy = false;
      console.log(`  🔴 [OFFLINE] ${r.name.padEnd(20)} http://localhost:${r.port} -> (${r.error})`);
    }
  });

  console.log("\n------------------------------------------");
  if (allHealthy) {
    console.log("✨ All services are active and responding properly!\n");
    process.exit(0);
  } else {
    console.log("⚠️  One or more services are not yet running.\n");
    process.exit(1);
  }
}

run();
