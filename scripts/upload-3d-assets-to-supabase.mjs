import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
const envLocalPath = path.resolve(__dirname, "../.env.local");
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
      supabaseUrl = trimmed.split("=")[1]?.trim();
    }
    if (trimmed.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
      serviceRoleKey = trimmed.split("=")[1]?.trim();
    }
  }
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Supabase URL or Service Role Key missing!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const BUCKET = "3d-assets";

const MIME_MAP = {
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".fbx": "application/octet-stream",
  ".hdr": "image/vnd.radiance",
};

async function uploadFile(localPath, storagePath) {
  const ext = path.extname(localPath).toLowerCase();
  const contentType = MIME_MAP[ext] || "application/octet-stream";
  const fileBuffer = fs.readFileSync(localPath);
  const sizeMb = (fileBuffer.length / (1024 * 1024)).toFixed(2);

  console.log(`Uploading ${storagePath} (${sizeMb} MB) [${contentType}]...`);
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, fileBuffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    console.error(`❌ Failed to upload ${storagePath}:`, error.message);
    return false;
  }

  const { data: pubData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  console.log(`✅ Uploaded ${storagePath} -> ${pubData.publicUrl}`);
  return true;
}

async function run() {
  console.log("🚀 Starting 3D Asset Upload to Supabase Storage Bucket:", BUCKET);

  const publicDir = path.resolve(__dirname, "../public");
  const filesToUpload = [
    // Models
    { local: "models/CLASSROOM.glb", target: "models/CLASSROOM.glb" },
    { local: "models/CLASSROOM-low.glb", target: "models/CLASSROOM-low.glb" },
    { local: "models/standing_chalkboard.glb", target: "models/standing_chalkboard.glb" },
    { local: "models/men-avatarsdk.glb", target: "models/men-avatarsdk.glb" },
    { local: "models/women-avatarsdk.glb", target: "models/women-avatarsdk.glb" },
    // Core Textures
    { local: "textures/Blackboard-Stage-Wall.png", target: "textures/Blackboard-Stage-Wall.png" },
    // Core Animations (Idle weight shift)
    { local: "animations/men-avatarsdk/weight shift.fbx", target: "animations/men-avatarsdk/weight shift.fbx" },
    { local: "animations/women-avatarsdk/weight shift.fbx", target: "animations/women-avatarsdk/weight shift.fbx" },
  ];

  let successCount = 0;
  for (const item of filesToUpload) {
    const fullLocal = path.join(publicDir, item.local);
    if (!fs.existsSync(fullLocal)) {
      console.warn(`⚠️ Warning: local file not found: ${fullLocal}`);
      continue;
    }
    const ok = await uploadFile(fullLocal, item.target);
    if (ok) successCount++;
  }

  console.log(`\n🎉 Finished uploading ${successCount}/${filesToUpload.length} core assets to Supabase Storage!`);
}

run().catch(console.error);
