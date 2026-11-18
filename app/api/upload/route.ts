import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const courseId = formData.get("courseId") as string;

    if (!file || !courseId) {
      return Response.json({ error: "Missing file or courseId" }, { status: 400 });
    }

    // 1. Verify lecturer role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "lecturer") {
      return Response.json({ error: "Forbidden: Lecturer role required to upload materials." }, { status: 403 });
    }

    // 2. Verify course ownership
    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("created_by", user.id)
      .single();

    if (!course) {
      return Response.json({ error: "Course not found or unauthorized." }, { status: 404 });
    }

    const fileId = crypto.randomUUID();
    const fileName = `${fileId}_${file.name}`;
    const filePath = `${courseId}/${fileName}`;

    // 3. Upload to course-files storage bucket
    const { error: uploadError } = await supabase.storage
      .from("course-files")
      .upload(filePath, file, {
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      return Response.json({ error: uploadError.message }, { status: 500 });
    }

    // 4. Create signed URL valid for 24 hours for document processing
    const { data: signedData, error: signedError } = await supabase.storage
      .from("course-files")
      .createSignedUrl(filePath, 60 * 60 * 24);

    if (signedError || !signedData) {
      return Response.json({ error: signedError?.message || "Failed to generate signed URL" }, { status: 500 });
    }

    // 5. Store file metadata in course_files table
    const { data: fileData, error: insertError } = await supabase
      .from("course_files")
      .insert({
        course_id: courseId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      await supabase.storage.from("course-files").remove([filePath]);
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    // 6. Asynchronously trigger AI backend processing (chunks, vector embeddings, diagram extraction)
    const aiBackendUrl = process.env.AI_BACKEND_URL || "http://127.0.0.1:8000";

    fetch(`${aiBackendUrl}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileUrl: signedData.signedUrl,
        fileName: file.name,
        courseId,
      }),
    }).catch((e) => console.warn("Background vectorization trigger error:", e));

    fetch(`${aiBackendUrl}/extract-images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileUrl: signedData.signedUrl,
        fileName: file.name,
        courseId,
      }),
    }).catch((e) => console.warn("Background visual extraction trigger error:", e));

    return Response.json({
      success: true,
      file: fileData,
      fileUrl: signedData.signedUrl,
      isProcessingInBackground: true,
    });
  } catch (err: unknown) {
    console.error("Upload error:", err);
    return Response.json({ error: (err as Error)?.message || "Upload failed" }, { status: 500 });
  }
}
