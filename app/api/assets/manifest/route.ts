import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get("tier"); // "high" | "medium" | "low"
    const gender = searchParams.get("gender"); // "men" | "women"

    const manifestPath = path.join(process.cwd(), "public", "asset-manifest.json");

    if (!fs.existsSync(manifestPath)) {
      return NextResponse.json(
        { error: "Asset manifest not found" },
        { status: 404 }
      );
    }

    const fileContent = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(fileContent);

    // Optional filtering if query parameters provided
    if (tier || gender) {
      manifest.assets = manifest.assets.filter((asset: { modelGender?: string }) => {
        if (gender && asset.modelGender && asset.modelGender !== gender) {
          return false;
        }
        return true;
      });
    }

    return NextResponse.json(manifest, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("[API] Error reading asset manifest:", error);
    return NextResponse.json(
      { error: "Failed to generate asset manifest" },
      { status: 500 }
    );
  }
}
