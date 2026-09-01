"use client";

// Mounts the local writing mode. In production builds this is a pure
// pass-through; in development it lazily loads the editor gate, which
// activates only when the URL carries ?edit=1.

import { lazy, Suspense, type ComponentType, type ReactNode } from "react";

const DevEditorGate: ComponentType | null = import.meta.env.DEV
  ? lazy(() => import("./DevEditorGate"))
  : null;

export function ContentEditorProvider({ children }: { children: ReactNode }) {
  if (!import.meta.env.DEV || !DevEditorGate) return <>{children}</>;
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <DevEditorGate />
      </Suspense>
    </>
  );
}
