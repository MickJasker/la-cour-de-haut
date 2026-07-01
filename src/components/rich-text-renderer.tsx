import type { SerializedEditorState } from "lexical";
import React from "react";
import { isSafeHref } from "@/lib/safe-url";

// ---------------------------------------------------------------------------
// Tailwind class constants — no import from Lexical theme
// ---------------------------------------------------------------------------
const CLS = {
  container: "max-w-prose leading-relaxed",
  p: "mb-3 leading-relaxed",
  h2: "text-xl font-semibold mt-5 mb-2",
  h3: "text-lg font-semibold mt-4 mb-2",
  ul: "list-disc pl-6 mb-3",
  ol: "list-decimal pl-6 mb-3",
  li: "mb-1",
  a: "underline underline-offset-2",
} as const;

// ---------------------------------------------------------------------------
// Serialized node shapes (structural — no Lexical runtime)
// ---------------------------------------------------------------------------

interface SerializedBase {
  type: string;
  version: number;
}

interface SerializedText extends SerializedBase {
  type: "text";
  text: string;
  format: number;
}

interface SerializedParagraph extends SerializedBase {
  type: "paragraph";
  children: SerializedNode[];
}

interface SerializedHeading extends SerializedBase {
  type: "heading";
  tag: string;
  children: SerializedNode[];
}

interface SerializedList extends SerializedBase {
  type: "list";
  listType: "bullet" | "number" | "check" | string;
  children: SerializedNode[];
}

interface SerializedListItem extends SerializedBase {
  type: "listitem";
  children: SerializedNode[];
}

interface SerializedLink extends SerializedBase {
  type: "link";
  url: string;
  children: SerializedNode[];
}

type SerializedNode =
  | SerializedText
  | SerializedParagraph
  | SerializedHeading
  | SerializedList
  | SerializedListItem
  | SerializedLink
  | (SerializedBase & { [key: string]: unknown });

// ---------------------------------------------------------------------------
// Node renderers
// ---------------------------------------------------------------------------

function renderText(node: SerializedText, key: number): React.ReactNode {
  const { text, format } = node;
  // Lexical text-format bitmask: bold=1, italic=2, underline=8. The editor's
  // default keybindings allow Cmd+U (underline) even without a toolbar button,
  // so the read path must honor it or that content would silently vanish.
  const bold = (format & 1) !== 0;
  const italic = (format & 2) !== 0;
  const underline = (format & 8) !== 0;

  let content: React.ReactNode = text;
  if (underline) content = <u key={`u-${key}`}>{content}</u>;
  if (italic) content = <em key={`em-${key}`}>{content}</em>;
  if (bold) content = <strong key={`strong-${key}`}>{content}</strong>;
  return content;
}

function renderChildren(children: SerializedNode[]): React.ReactNode {
  return children.map((child, idx) => renderNode(child, idx));
}

function renderNode(node: SerializedNode, key: number): React.ReactNode {
  switch (node.type) {
    case "text":
      return renderText(node as SerializedText, key);

    case "linebreak":
      // Shift+Enter in the editor inserts a LineBreakNode.
      return <br key={key} />;

    case "paragraph":
      return (
        <p key={key} className={CLS.p}>
          {renderChildren((node as SerializedParagraph).children)}
        </p>
      );

    case "heading": {
      const h = node as SerializedHeading;
      const allowed = ["h2", "h3"];
      const Tag = (allowed.includes(h.tag) ? h.tag : "h3") as "h2" | "h3";
      const cls = Tag === "h2" ? CLS.h2 : CLS.h3;
      return (
        <Tag key={key} className={cls}>
          {renderChildren(h.children)}
        </Tag>
      );
    }

    case "list": {
      const l = node as SerializedList;
      const Tag = l.listType === "number" ? "ol" : "ul";
      const cls = Tag === "ol" ? CLS.ol : CLS.ul;
      return (
        <Tag key={key} className={cls}>
          {renderChildren(l.children)}
        </Tag>
      );
    }

    case "listitem": {
      const li = node as SerializedListItem;
      return (
        <li key={key} className={CLS.li}>
          {renderChildren(li.children)}
        </li>
      );
    }

    case "link": {
      const lk = node as SerializedLink;
      const childContent = renderChildren(lk.children);
      if (!isSafeHref(lk.url)) {
        // Unsafe scheme — render children with no anchor wrapper
        return <React.Fragment key={key}>{childContent}</React.Fragment>;
      }
      const isMailto =
        new URL(lk.url, "https://x.invalid").protocol === "mailto:";
      if (isMailto) {
        return (
          <a key={key} href={lk.url} className={CLS.a}>
            {childContent}
          </a>
        );
      }
      return (
        <a
          key={key}
          href={lk.url}
          className={CLS.a}
          target="_blank"
          rel="noopener noreferrer"
        >
          {childContent}
        </a>
      );
    }

    default:
      // Unknown node type — skip
      return null;
  }
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export function RichTextRenderer({
  state,
  className,
}: {
  state: SerializedEditorState;
  /** Overrides the default container class (`max-w-prose leading-relaxed`).
   * Font styling on the container inherits down to every paragraph/heading. */
  className?: string;
}): React.ReactElement {
  const children = (state?.root?.children ?? []) as SerializedNode[];
  const nodes = children.map((child, idx) => renderNode(child, idx));
  return <div className={className ?? CLS.container}>{nodes}</div>;
}
