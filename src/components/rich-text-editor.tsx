"use client";

import React from "react";
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  ElementNode,
  FORMAT_TEXT_COMMAND,
} from "lexical";
import type { SerializedEditorState } from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { $createHeadingNode } from "@lexical/rich-text";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list";
import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  ALLOWED_HEADINGS,
  EDITOR_NODES,
  EDITOR_THEME,
} from "@/lib/lexical/nodes";
import type { AllowedHeading } from "@/lib/lexical/nodes";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Replace every top-level block element touched by the current selection with a
 * new node produced by `createNode`. Used for heading / paragraph toggles.
 * Must be called inside `editor.update(...)`.
 */
function $applyBlockType(createNode: () => ElementNode): void {
  const sel = $getSelection();
  if (!$isRangeSelection(sel)) return;
  const seen = new Set<string>();
  for (const node of sel.getNodes()) {
    const top = node.getTopLevelElement();
    if (top === null || !$isElementNode(top) || seen.has(top.getKey())) {
      continue;
    }
    seen.add(top.getKey());
    top.replace(createNode(), /* includeChildren */ true);
  }
}

// Icon map keyed by heading tag so ALLOWED_HEADINGS drives the toolbar.
const HEADING_ICONS: Record<AllowedHeading, React.ReactElement> = {
  h2: <Heading2 size={14} />,
  h3: <Heading3 size={14} />,
};

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function Toolbar(): React.ReactElement {
  const [editor] = useLexicalComposerContext();

  return (
    <div className="flex flex-wrap items-center gap-1 border-b p-1">
      {/* Inline formats */}
      <button
        type="button"
        title="Bold"
        className="rounded border px-2 py-1 hover:bg-muted"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
      >
        <Bold size={14} />
      </button>
      <button
        type="button"
        title="Italic"
        className="rounded border px-2 py-1 hover:bg-muted"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
      >
        <Italic size={14} />
      </button>

      <span className="mx-1 h-4 w-px bg-border" aria-hidden />

      {/* Block types: headings */}
      {ALLOWED_HEADINGS.map((tag) => (
        <button
          key={tag}
          type="button"
          title={`Heading ${tag.slice(1)}`}
          className="rounded border px-2 py-1 hover:bg-muted"
          onClick={() =>
            editor.update(() => $applyBlockType(() => $createHeadingNode(tag)))
          }
        >
          {HEADING_ICONS[tag]}
        </button>
      ))}

      {/* Paragraph (clear heading) */}
      <button
        type="button"
        title="Paragraph"
        className="rounded border px-2 py-1 text-xs font-medium hover:bg-muted"
        onClick={() =>
          editor.update(() => $applyBlockType(() => $createParagraphNode()))
        }
      >
        P
      </button>

      <span className="mx-1 h-4 w-px bg-border" aria-hidden />

      {/* Lists */}
      <button
        type="button"
        title="Bullet list"
        className="rounded border px-2 py-1 hover:bg-muted"
        onClick={() =>
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
        }
      >
        <List size={14} />
      </button>
      <button
        type="button"
        title="Numbered list"
        className="rounded border px-2 py-1 hover:bg-muted"
        onClick={() =>
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
        }
      >
        <ListOrdered size={14} />
      </button>

      <span className="mx-1 h-4 w-px bg-border" aria-hidden />

      {/* Link (toggle with placeholder href; owner edits the text) */}
      <button
        type="button"
        title="Link"
        className="rounded border px-2 py-1 hover:bg-muted"
        onClick={() => editor.dispatchCommand(TOGGLE_LINK_COMMAND, "https://")}
      >
        <Link size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export function RichTextEditor({
  initialValue,
  onChange,
  ariaLabel,
}: {
  initialValue: SerializedEditorState;
  onChange: (state: SerializedEditorState) => void;
  ariaLabel?: string;
}): React.ReactElement {
  const initialConfig = {
    namespace: "poi-detail",
    nodes: EDITOR_NODES,
    theme: EDITOR_THEME,
    editorState: JSON.stringify(initialValue),
    onError: (e: Error) => {
      throw e;
    },
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative rounded border focus-within:ring-2 focus-within:ring-ring">
        <Toolbar />
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              ariaLabel={ariaLabel}
              className="min-h-[200px] px-3 py-2 outline-none"
              placeholder={
                <div className="pointer-events-none absolute left-0 top-0 px-3 py-2 text-muted-foreground">
                  Begin met schrijven…
                </div>
              }
              aria-placeholder="Begin met schrijven…"
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <OnChangePlugin
          onChange={(editorState) => onChange(editorState.toJSON())}
        />
      </div>
    </LexicalComposer>
  );
}
