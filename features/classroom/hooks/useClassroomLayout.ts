"use client";

import { useState, useEffect } from "react";

export interface ClassroomLayoutFacts {
  width: number;
  height: number;
  isCompact: boolean;
  isLandscape: boolean;
  isShortLandscape: boolean;
}

export function useClassroomLayout(): ClassroomLayoutFacts {
  const [layout, setLayout] = useState<ClassroomLayoutFacts>(() => {
    if (typeof window === "undefined") {
      return {
        width: 1280,
        height: 800,
        isCompact: false,
        isLandscape: true,
        isShortLandscape: false,
      };
    }

    const w = window.innerWidth;
    const h = window.innerHeight;
    const isLandscape = w > h;

    return {
      width: w,
      height: h,
      isCompact: w < 1024 || h <= 600,
      isLandscape,
      isShortLandscape: isLandscape && h <= 500,
    };
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isLandscape = w > h;

      setLayout({
        width: w,
        height: h,
        isCompact: w < 1024 || h <= 600,
        isLandscape,
        isShortLandscape: isLandscape && h <= 500,
      });
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    // Initial check
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  return layout;
}
