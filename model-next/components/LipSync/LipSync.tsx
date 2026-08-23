"use client";

import { useLipSync } from "./useLipSync";
import type { LipSyncProps } from "./lipSync.types";

export default function LipSync(
    props: LipSyncProps
) {
    useLipSync(props);

    return null;
}