import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: pathSegments } = await params;
        if (!pathSegments || pathSegments.length === 0) {
            return new NextResponse("File not found", { status: 404 });
        }

        const joinedPath = pathSegments.join("/");

        // 1. Check local generated folder (for HeadTTS audio/json)
        const safeSegments = pathSegments.map((s) => path.basename(s));
        const localFilePath = path.join(
            process.cwd(),
            "public",
            "generated",
            ...safeSegments
        );

        try {
            const data = await fs.readFile(localFilePath);
            const fileName = safeSegments[safeSegments.length - 1];
            const ext = path.extname(fileName).toLowerCase();

            let contentType = "application/octet-stream";
            if (ext === ".wav") contentType = "audio/wav";
            else if (ext === ".mp3") contentType = "audio/mpeg";
            else if (ext === ".json") contentType = "application/json";
            else if (ext === ".png") contentType = "image/png";
            else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
            else if (ext === ".webp") contentType = "image/webp";

            return new NextResponse(data, {
                status: 200,
                headers: {
                    "Content-Type": contentType,
                    "Cache-Control": "public, max-age=86400, immutable",
                },
            });
        } catch {
            // Not in local disk, proceed to Supabase Storage
        }

        // 2. Stream from Supabase Storage 'course-files' bucket via Admin Client
        const admin = createAdminClient();
        const candidatePaths = [
            joinedPath,
            joinedPath.replace("/mediaassets/", "/media_assets/"),
            joinedPath.replace("/media_assets/", "/mediaassets/"),
        ];

        for (const storagePath of candidatePaths) {
            try {
                const { data: blob, error: downloadError } = await admin.storage
                    .from("course-files")
                    .download(storagePath);

                if (!downloadError && blob) {
                    const arrayBuffer = await blob.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    const ext = path.extname(storagePath).toLowerCase();

                    let contentType = blob.type || "application/octet-stream";
                    if (ext === ".png") contentType = "image/png";
                    else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
                    else if (ext === ".webp") contentType = "image/webp";
                    else if (ext === ".pdf") contentType = "application/pdf";

                    return new NextResponse(buffer, {
                        status: 200,
                        headers: {
                            "Content-Type": contentType,
                            "Cache-Control": "public, max-age=86400, immutable",
                        },
                    });
                }
            } catch (err) {
                console.warn(`Storage download attempt failed for ${storagePath}:`, err);
            }
        }

        return new NextResponse("File not found in storage", { status: 404 });
    } catch (err: any) {
        console.error("Media proxy error:", err);
        return new NextResponse("Internal server error", { status: 500 });
    }
}
