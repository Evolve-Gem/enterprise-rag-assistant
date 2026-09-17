"use client";

import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

const CITATION_PATTERN = /\[(\d{1,3})\]/g;

/**
 * Turn inline `[n]` markers into clickable citation chips.
 *
 * The backend numbers the retrieved context `[1..n]`; the answer uses those
 * numbers. Walking the rendered React children (rather than regex-replacing the
 * raw markdown) means citations inside **bold** spans, list items and table
 * cells all become interactive, and no markup is ever injected as HTML.
 */
function decorate(children: ReactNode, onCitation?: (index: number) => void): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") {
      const parts: ReactNode[] = [];
      let cursor = 0;
      let match: RegExpExecArray | null;
      CITATION_PATTERN.lastIndex = 0;

      while ((match = CITATION_PATTERN.exec(child)) !== null) {
        if (match.index > cursor) parts.push(child.slice(cursor, match.index));
        const index = Number(match[1]);
        parts.push(
          <button
            key={`cite-${match.index}-${index}`}
            type="button"
            onClick={() => onCitation?.(index)}
            disabled={!onCitation}
            title={`查看第 ${index} 条引用来源`}
            className={cn(
              "mx-0.5 inline-flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-[var(--radius-xs)] border px-1 align-[0.1em] font-mono text-[10px] font-semibold leading-none transition-colors duration-150",
              "border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]",
              onCitation
                ? "cursor-pointer hover:bg-[var(--color-accent-soft-hover)]"
                : "cursor-default opacity-80",
            )}
          >
            {index}
          </button>,
        );
        cursor = match.index + match[0].length;
      }

      if (cursor < child.length) parts.push(child.slice(cursor));
      return parts.length ? parts : child;
    }

    if (isValidElement<{ children?: ReactNode }>(child) && child.props.children) {
      return {
        ...child,
        props: {
          ...child.props,
          children: decorate(child.props.children, onCitation),
        },
      };
    }

    return child;
  });
}

/** Renders markdown with citation-aware text nodes. */
export function Markdown({
  content,
  onCitation,
  className,
}: {
  content: string;
  onCitation?: (index: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("prose-copilot", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{decorate(children, onCitation)}</p>,
          li: ({ children }) => <li>{decorate(children, onCitation)}</li>,
          td: ({ children }) => <td>{decorate(children, onCitation)}</td>,
          th: ({ children }) => <th>{decorate(children, onCitation)}</th>,
          strong: ({ children }) => <strong>{decorate(children, onCitation)}</strong>,
          em: ({ children }) => <em>{decorate(children, onCitation)}</em>,
          blockquote: ({ children }) => <blockquote>{decorate(children, onCitation)}</blockquote>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
