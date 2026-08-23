"use client";

import { createContext, useContext, RefObject } from "react";
import { BehaviorStore } from "./behaviorTypes";

export const AvatarBehaviorContext = createContext<RefObject<BehaviorStore> | null>(null);

export function useAvatarBehavior(): RefObject<BehaviorStore> {
    const ctx = useContext(AvatarBehaviorContext);
    if (!ctx) {
        throw new Error("useAvatarBehavior must be used within an AvatarBehaviorController / Provider");
    }
    return ctx;
}
