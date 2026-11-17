"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Idiomatic React 18/19 SSR/CSR hydration guard using useSyncExternalStore.
 * Returns `false` on the server (SSR), and `true` on the client (CSR).
 * Avoids calling setState() in useEffect(), preventing cascading renders and React warnings.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
