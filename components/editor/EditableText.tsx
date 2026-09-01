"use client";

// Editable rendering for one static string. Outside an activated writing
// session (development build + ?edit=1) this renders exactly the semantic
// element its caller asked for, with the base value, and nothing else. The
// interactive implementation loads lazily and only exists in development
// builds.

import {
  createElement,
  lazy,
  Suspense,
  useSyncExternalStore,
  type ComponentType,
  type ElementType,
  type ReactNode,
} from "react";
import {
  editorLiveText,
  editorStoreVersion,
  isEditorStoreActive,
  subscribeEditorStore,
} from "../../lib/editor/editor-store";

export type ActiveEditableTextProps = {
  path: string;
  value: string;
  as: ElementType;
  multiline?: boolean;
  [key: string]: unknown;
};

const ActiveEditableText: ComponentType<ActiveEditableTextProps> | null =
  import.meta.env.DEV
    ? lazy(() => import("./ActiveEditableText"))
    : null;

function serverVersion() {
  return 0;
}

export function useEditorActive(): boolean {
  useSyncExternalStore(subscribeEditorStore, editorStoreVersion, serverVersion);
  return isEditorStoreActive();
}

// Live value for a content path — the in-session override when writing mode
// is active, the base value otherwise. Useful for attribute strings (like a
// placeholder) that cannot host a caret.
export function useEditableContent(path: string, base: string): string {
  useSyncExternalStore(subscribeEditorStore, editorStoreVersion, serverVersion);
  return editorLiveText(path, base);
}

export type EditableTextProps = {
  path: string;
  value: string;
  as?: ElementType;
  multiline?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
};

export function EditableText({
  path,
  value,
  as = "span",
  multiline,
  ...rest
}: EditableTextProps) {
  const display = useEditableContent(path, value);
  const active = useEditorActive();
  if (import.meta.env.DEV && active && ActiveEditableText) {
    return (
      <Suspense fallback={createElement(as, rest, display)}>
        <ActiveEditableText
          as={as}
          multiline={multiline}
          path={path}
          value={value}
          {...rest}
        />
      </Suspense>
    );
  }
  return createElement(as, rest, display);
}
