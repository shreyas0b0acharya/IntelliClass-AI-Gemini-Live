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

    // 1. Upload to course-files storage bucket
    const { error: uploadError } = await supabase.storage
      .from("course-files")
      .upload(filePath, file, {
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      return Response.json({ error: uploadError.message }, { status: 500 });
    }

    // 2. Create signed URL for document processing
    const { data: signedData, error: signedError } = await supabase.storage
      .from("course-files")
      .createSignedUrl(filePath, 60 * 10);

    if (signedError || !signedData) {
      return Response.json({ error: signedError?.message || "Failed to generate signed URL" }, { status: 500 });
    }

    // 3. Store file metadata in course_files table
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

    // 4. Immediately extract chunks and generate vector embeddings via AI Backend
    const aiBackendUrl = process.env.AI_BACKEND_URL || "http://127.0.0.1:8000";
    let processResult: { status?: string; totalChunks?: number; error?: string; message?: string } | null = null;

    try {
      const processRes = await fetch(`${aiBackendUrl}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: signedData.signedUrl,
          fileName: file.name,
          courseId,
        }),
      });

      if (!processRes.ok) {
        const errText = await processRes.text();
        throw new Error(`AI Vectorizer returned HTTP ${processRes.status}: ${errText}`);
      }

      processResult = await processRes.json();
      if (processResult?.error || (processResult?.totalChunks !== undefined && processResult.totalChunks === 0)) {
        throw new Error(
          processResult.error ||
            processResult.message ||
            "No readable text chunks could be extracted from this PDF."
        );
      }
    } catch (procErr: any) {
      console.error("Document vectorization error during upload:", procErr);
      // Rollback database and storage records on processing/vectorization failure
      await supabase.from("course_files").delete().eq("id", fileData.id);
      await supabase.storage.from("course-files").remove([filePath]);

      return Response.json(
        {
          error: `Document Processing Failed: ${procErr.message || "Unable to extract chunks or vectorize this PDF."}`,
        },
        { status: 422 }
      );
    }

    // 5. Extract visual diagrams from PDF and persist to media_assets & storage
    let extractedImageCount = 0;
    try {
      const imgRes = await fetch(`${aiBackendUrl}/extract-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: signedData.signedUrl,
          fileName: file.name,
          courseId,
        }),
      });

      if (imgRes.ok) {
        const imgData = await imgRes.json();
        const images: Array<{
          id: string;
          page: number;
          img_index: number;
          ext: string;
          contentType: string;
          base64: string;
          label: string;
        }> = imgData.images || [];

        for (const img of images) {
          try {
            const buffer = Buffer.from(img.base64, "base64");
            const storagePath = `${courseId}/media_assets/${img.id}.${img.ext}`;

            // Upload directly with authenticated user context
            await supabase.storage.from("course-files").upload(storagePath, buffer, {
              contentType: img.contentType || "image/png",
              upsert: true,
            });

            // Generate signed URL valid for 7 days
            const { data: signedData } = await supabase.storage
              .from("course-files")
              .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

            const { data: pubData } = supabase.storage
              .from("course-files")
              .getPublicUrl(storagePath);

            const fileUrl = signedData?.signedUrl || pubData?.publicUrl || storagePath;

            await supabase.from("media_assets").insert({
              id: img.id,
              course_id: courseId,
              type: "image",
              file_url: fileUrl,
              label: img.label,
              source: "pdf_extracted",
            });

            extractedImageCount++;
          } catch (uploadErr) {
            console.warn(`Failed to persist extracted diagram ${img.id}:`, uploadErr);
          }
        }
      }
    } catch (imgErr) {
      console.warn("Visual diagram extraction error:", imgErr);
    }

    return Response.json({
      success: true,
      file: fileData,
      fileUrl: signedData.signedUrl,
      totalChunks: processResult?.totalChunks,
      extractedImages: extractedImageCount,
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return Response.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}
