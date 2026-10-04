export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { fileUrl, fileName, courseId } = await req.json();

    if (!fileUrl || !fileName || !courseId) {
      return NextResponse.json(
        { error: "Missing required parameters (fileUrl, fileName, courseId)" },
        { status: 400 }
      );
    }

    const aiBackendUrl = process.env.AI_BACKEND_URL || "http://127.0.0.1:8000";

    const response = await fetch(`${aiBackendUrl}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileUrl, fileName, courseId }),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(text || "AI Backend processing failed");
    }

    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Processing API route error:", error);
    return NextResponse.json(
      { error: (error as Error)?.message || "Processing failed" },
      { status: 500 }
    );
  }
}
