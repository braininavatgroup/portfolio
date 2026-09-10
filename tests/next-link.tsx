import type { ComponentProps } from "react";

type TestLinkProps = Omit<ComponentProps<"a">, "href"> & { href: string };

export default function TestLink({ children, href, ...props }: TestLinkProps) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
