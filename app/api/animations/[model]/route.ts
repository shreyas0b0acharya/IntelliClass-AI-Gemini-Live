import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
    _request: Request,
    {
        params,
    }: {
        params: Promise<{ model: string }>;
    }
) {
    const { model } = await params;

    const animationsRoot = path.join(
        process.cwd(),
        "public",
        "animations"
    );

    const fallbackModel = "men-avatarsdk";

    // Prevent path traversal
    const safeModel = path.basename(model);

    let targetModelFolder = safeModel;
    let targetDir = path.join(
        animationsRoot,
        targetModelFolder
    );

    // Fallback to men-avatarsdk if requested model doesn't exist
    if (!fs.existsSync(targetDir)) {
        targetModelFolder = fallbackModel;
        targetDir = path.join(
            animationsRoot,
            targetModelFolder
        );
    }

    if (!fs.existsSync(targetDir)) {
        return NextResponse.json(
            { error: "Animation folder not found" },
            { status: 404 }
        );
    }

    const files = fs.readdirSync(targetDir);

    const animations: {
        name: string;
        path: string;
    }[] = [];

    for (const file of files) {
        if (!file.toLowerCase().endsWith(".fbx")) {
            continue;
        }

        // Ignore the base model FBX and known corrupted FBX files
        const lowerName = file.toLowerCase();
        if (
            lowerName === `${targetModelFolder.toLowerCase()}.fbx` ||
            lowerName.includes("hard head nod")
        ) {
            continue;
        }

        animations.push({
            name: file.replace(/\.fbx$/i, ""),
            path: `/animations/${targetModelFolder}/${file}`,
        });
    }

    // Sort animations with 'weight shift' at the top, then alphabetically
    animations.sort((a, b) => {
        const aIsWeight = a.name.toLowerCase().includes("weight shift");
        const bIsWeight = b.name.toLowerCase().includes("weight shift");
        if (aIsWeight && !bIsWeight) return -1;
        if (!aIsWeight && bIsWeight) return 1;
        return a.name.localeCompare(b.name);
    });

    return NextResponse.json(animations);
}