// Minimal next/link stand-in for vitest; vinext provides the real module in
// the app build, where this stub is never used.
import { type AnchorHTMLAttributes, type ReactNode } from "react";

export default function Link({
  href,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children?: ReactNode;
}) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
