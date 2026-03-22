"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MathProps {
  /** LaTeX expression */
  children: string;
  /** Display mode (block) or inline */
  display?: boolean;
  /** Additional CSS class */
  className?: string;
}

export function Math({ children, display = false, className }: MathProps) {
  const html = useMemo(
    () =>
      katex.renderToString(children, {
        displayMode: display,
        throwOnError: false,
      }),
    [children, display],
  );

  if (display) {
    return (
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        className={`overflow-x-auto overflow-y-hidden${className ? ` ${className}` : ""}`}
        role="math"
      />
    );
  }

  return (
    <span
      dangerouslySetInnerHTML={{ __html: html }}
      className={className}
      role="math"
    />
  );
}
