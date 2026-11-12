import type { AnchorHTMLAttributes, ReactNode } from "react";
import { navigate } from "./router";
type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode; prefetch?: boolean; replace?: boolean };
export default function Link({ href, onClick, prefetch: _p, replace, ...rest }: Props) {
  return (
    <a {...rest} href={href} onClick={(e) => {
      onClick?.(e);
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || href.startsWith("http")) return;
      e.preventDefault(); navigate(href, replace);
    }} />
  );
}
