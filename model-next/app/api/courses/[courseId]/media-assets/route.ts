import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export interface MediaAssetRow {
  id: string;
  course_id: string;
  session_id?: string | null;
  type: "image" | "video";
  file_url: string;
  label: string;
  source: string;
  created_at: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify course ownership
    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("created_by", user.id)
      .single();

    if (!course) {
      return NextResponse.json({ error: "Course not found or unauthorized" }, { status: 404 });
    }

    const { data: assets, error } = await supabase
      .from("media_assets")
      .select("*")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Resolve media proxy URLs for reliable streaming across all client views
    const resolvedAssets = (assets || []).map((asset) => {
      let relativePath = "";

      const match = asset.file_url?.match(/(?:course-files\/)?([^?]+(?:media_assets\/[^?]+|mediaassets\/[^?]+))/);
      if (match && match[1]) {
        relativePath = match[1];
      } else {
        const ext = asset.label?.includes(".jpg") || asset.label?.includes(".jpeg") ? "jpeg" : "png";
        relativePath = `${courseId}/media_assets/${asset.id}.${ext}`;
      }

      return {
        ...asset,
        file_url: `/api/media/${relativePath}`,
      };
    });

    return NextResponse.json({ assets: resolvedAssets });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch media assets";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
