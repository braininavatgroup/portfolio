export type KeyboardDirection = "next" | "previous";

export function nextKeyboardIndex(
  current: number,
  direction: KeyboardDirection,
  length: number,
) {
  if (length <= 0) return 0;
  const offset = direction === "next" ? 1 : -1;
  return (current + offset + length) % length;
}
