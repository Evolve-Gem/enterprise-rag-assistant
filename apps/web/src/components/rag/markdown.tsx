"use client";

import { Children, isValidElement, useCallback, useMemo, useRef, type ReactNode } from "react";
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
              "mx-0.5 inline-flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-[var(--radius-xs)] border px-1 align-[0.1em] font-mono text-[10px] font-semibold leading-none",
              "transition-[transform,background-color,border-color,color] duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
              "border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]",
              onCitation
                ? "cursor-pointer hover:-translate-y-px hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft-hover)] motion-reduce:hover:translate-y-0"
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
  /*
    The citation chips must survive a re-render, and that is the whole trick here.

    Previously the `components` map was written as an inline object literal with
    seven arrow functions. Every render produced *new function identities*, so
    react-markdown reconciled `p` / `li` / `td` as different component types and
    unmounted + remounted the entire decorated subtree. Every `[n]` chip was
    destroyed and rebuilt.

    That is not a performance nit — it broke focus restoration. Opening the
    drawer from a chip triggers a re-render of the answer, the chip the user
    clicked was unmounted, and `useFocusTrap` could not return focus to it
    (calling `focus()` on a detached node fails silently, so the user landed on
    `<body>` and lost their place in a long answer).

    Two changes fix it:
      1. `components` is memoised, so the renderer identities stay stable and
         React reconciles instead of remounting.
      2. The callback is read through a ref, so the memo does not need
         `onCitation` in its dependencies — keeping the map stable while still
         calling the latest handler (no stale closure).
  */
  const onCitationRef = useRef(onCitation);
  onCitationRef.current = onCitation;

  const dispatch = useCallback((index: number) => {
    onCitationRef.current?.(index);
  }, []);

  // `decorate` uses the presence of a handler to decide whether a chip is
  // interactive; that is a boolean, so it can live in the memo deps without
  // destabilising the map.
  const hasHandler = Boolean(onCitation);

  const components = useMemo(
    () => ({
      p: ({ children }: { children?: ReactNode }) => (
        <p>{decorate(children, hasHandler ? dispatch : undefined)}</p>
      ),
      li: ({ children }: { children?: ReactNode }) => (
        <li>{decorate(children, hasHandler ? dispatch : undefined)}</li>
      ),
      td: ({ children }: { children?: ReactNode }) => (
        <td>{decorate(children, hasHandler ? dispatch : undefined)}</td>
      ),
      th: ({ children }: { children?: ReactNode }) => (
        <th>{decorate(children, hasHandler ? dispatch : undefined)}</th>
      ),
      strong: ({ children }: { children?: ReactNode }) => (
        <strong>{decorate(children, hasHandler ? dispatch : undefined)}</strong>
      ),
      em: ({ children }: { children?: ReactNode }) => (
        <em>{decorate(children, hasHandler ? dispatch : undefined)}</em>
      ),
      blockquote: ({ children }: { children?: ReactNode }) => (
        <blockquote>{decorate(children, hasHandler ? dispatch : undefined)}</blockquote>
      ),
    }),
    [hasHandler, dispatch],
  );

  return (
    <div
      className={cn(
        "prose-copilot",
        // Answer Lead: when the answer opens with a paragraph, give it a touch
        // more size and full-strength ink so the eye lands before the detail.
        "[&>p:first-child]:text-[1.0625rem] [&>p:first-child]:leading-[1.74] [&>p:first-child]:text-[var(--color-ink)]",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
