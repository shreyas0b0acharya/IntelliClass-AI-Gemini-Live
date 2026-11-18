import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string; fileId: string }> }
) {
  try {
    const { courseId, fileId } = await params;
    const supabase = await createClient();

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify course exists
    const { data: course } = await supabase
      .from("courses")
      .select("id, created_by")
      .eq("id", courseId)
      .single();

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // 3. Fetch file record
    const { data: fileRecord, error: fileFetchError } = await supabase
      .from("course_files")
      .select("*")
      .eq("id", fileId)
      .eq("course_id", courseId)
      .single();

    if (fileFetchError || !fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    let viewUrl: string | null = null;

    // Check if file_path is already an absolute URL
    if (fileRecord.file_path?.startsWith("http://") || fileRecord.file_path?.startsWith("https://")) {
      viewUrl = fileRecord.file_path;
    } else if (fileRecord.file_path) {
      // 4. Try generating signed URL valid for 2 hours
      const { data: signedData, error: signedError } = await supabase.storage
        .from("course-files")
        .createSignedUrl(fileRecord.file_path, 60 * 120);

      if (!signedError && signedData?.signedUrl) {
        viewUrl = signedData.signedUrl;
      } else {
        // Fallback A: Public URL
        const { data: pubData } = supabase.storage
          .from("course-files")
          .getPublicUrl(fileRecord.file_path);

        if (pubData?.publicUrl) {
          viewUrl = pubData.publicUrl;
        }

        // Fallback B: If missing from storage (e.g. auto-saved markdown notes), self-heal from document_chunks
        const { data: chunk } = await supabase
          .from("document_chunks")
          .select("content")
          .eq("course_id", courseId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (chunk?.content) {
          try {
            await supabase.storage
              .from("course-files")
              .upload(fileRecord.file_path, Buffer.from(chunk.content, "utf-8"), {
                contentType: "text/markdown; charset=utf-8",
                upsert: true,
              });

            const { data: reSigned } = await supabase.storage
              .from("course-files")
              .createSignedUrl(fileRecord.file_path, 60 * 120);

            if (reSigned?.signedUrl) {
              viewUrl = reSigned.signedUrl;
            }
          } catch {
            viewUrl = `data:text/markdown;charset=utf-8;base64,${Buffer.from(chunk.content).toString("base64")}`;
          }
        }
      }
    }

    if (!viewUrl) {
      const { data: pubData } = supabase.storage
        .from("course-files")
        .getPublicUrl(fileRecord.file_path || "");
      viewUrl = pubData?.publicUrl || "";
    }

    return NextResponse.json({
      file: fileRecord,
      viewUrl,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API GET /api/courses/[courseId]/files/[fileId] error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; fileId: string }> }
) {
  try {
    const { courseId, fileId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Verify lecturer role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "lecturer") {
      return NextResponse.json(
        { error: "Forbidden: Lecturer role required to delete files." },
        { status: 403 }
      );
    }

    // 2. Verify course ownership
    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("created_by", user.id)
      .single();

    if (!course) {
      return NextResponse.json({ error: "Course not found or unauthorized" }, { status: 404 });
    }

    // 3. Get file record to find file_path
    const { data: fileRecord, error: fileFetchError } = await supabase
      .from("course_files")
      .select("*")
      .eq("id", fileId)
      .eq("course_id", courseId)
      .single();

    if (fileFetchError || !fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // 4. Remove from storage
    if (fileRecord.file_path) {
      await supabase.storage.from("course-files").remove([fileRecord.file_path]);
    }

    // 5. Remove from course_files table
    const { error: dbDeleteError } = await supabase
      .from("course_files")
      .delete()
      .eq("id", fileId);

    if (dbDeleteError) {
      return NextResponse.json({ error: dbDeleteError.message }, { status: 500 });
    }

    // 6. Remove linked chunks for this file
    await supabase
      .from("document_chunks")
      .delete()
      .eq("course_id", courseId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API DELETE /api/courses/[courseId]/files/[fileId] error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
