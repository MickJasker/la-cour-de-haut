"use client";

import React, { useRef, useState } from "react";
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $setSelection,
  ElementNode,
  FORMAT_TEXT_COMMAND,
} from "lexical";
import type { BaseSelection, SerializedEditorState } from "lexical";
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
import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { $findMatchingParent } from "@lexical/utils";
import {
  ALLOWED_HEADINGS,
  EDITOR_NODES,
  EDITOR_THEME,
} from "@/lib/lexical/nodes";
import type { AllowedHeading } from "@/lib/lexical/nodes";
import { isSafeHref } from "@/lib/safe-url";
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

const btnCls = "rounded border px-2 py-1 hover:bg-muted";

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function Toolbar(): React.ReactElement {
  const [editor] = useLexicalComposerContext();
  // null = link editor hidden; a string = visible with that draft URL.
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  // Focusing the URL input moves focus out of the editor, which drops the text
  // selection the link should apply to — so snapshot it when the editor opens.
  const savedSelection = useRef<BaseSelection | null>(null);

  function openLinkEditor() {
    let existing = "https://";
    editor.getEditorState().read(() => {
      const sel = $getSelection();
      savedSelection.current = sel ? sel.clone() : null;
      if ($isRangeSelection(sel)) {
        const node = sel.getNodes()[0];
        const link = node ? $findMatchingParent(node, $isLinkNode) : null;
        if (link && $isLinkNode(link)) existing = link.getURL();
      }
    });
    setLinkDraft(existing);
  }

  function toggleLink(url: string | null) {
    // Write-time guard: never store an unsafe scheme (defense-in-depth; the
    // public renderer also strips them). null = remove the link.
    if (url !== null && !isSafeHref(url)) return;
    // Restore the snapshotted selection first so the command targets the
    // originally-selected text, then toggle the link.
    const saved = savedSelection.current;
    if (saved) {
      editor.update(() => $setSelection(saved.clone()), { discrete: true });
    }
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    setLinkDraft(null);
  }

  function applyLink() {
    const url = (linkDraft ?? "").trim();
    toggleLink(url.length > 0 ? url : null);
  }

  const linkInvalid =
    linkDraft !== null &&
    linkDraft.trim().length > 0 &&
    !isSafeHref(linkDraft.trim());

  return (
    <div className="border-b">
      <div className="flex flex-wrap items-center gap-1 p-1">
        <button
          type="button"
          title="Vet"
          className={btnCls}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          title="Cursief"
          className={btnCls}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
        >
          <Italic size={14} />
        </button>

        <span className="mx-1 h-4 w-px bg-border" aria-hidden />

        {ALLOWED_HEADINGS.map((tag) => (
          <button
            key={tag}
            type="button"
            title={`Kop ${tag.slice(1)}`}
            className={btnCls}
            onClick={() =>
              editor.update(() =>
                $applyBlockType(() => $createHeadingNode(tag)),
              )
            }
          >
            {HEADING_ICONS[tag]}
          </button>
        ))}

        <button
          type="button"
          title="Paragraaf"
          className={`${btnCls} text-xs font-medium`}
          onClick={() =>
            editor.update(() => $applyBlockType(() => $createParagraphNode()))
          }
        >
          P
        </button>

        <span className="mx-1 h-4 w-px bg-border" aria-hidden />

        <button
          type="button"
          title="Opsomming"
          className={btnCls}
          onClick={() =>
            editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
          }
        >
          <List size={14} />
        </button>
        <button
          type="button"
          title="Genummerde lijst"
          className={btnCls}
          onClick={() =>
            editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
          }
        >
          <ListOrdered size={14} />
        </button>

        <span className="mx-1 h-4 w-px bg-border" aria-hidden />

        <button
          type="button"
          title="Link"
          className={btnCls}
          aria-expanded={linkDraft !== null}
          onClick={openLinkEditor}
        >
          <Link size={14} />
        </button>
      </div>

      {linkDraft !== null && (
        <div className="border-t p-1">
          <div className="flex items-center gap-1">
            {/* Select text first, then set its URL here. */}
            <input
              autoFocus
              type="url"
              inputMode="url"
              value={linkDraft}
              onChange={(e) => setLinkDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setLinkDraft(null);
                }
              }}
              placeholder="https://voorbeeld.nl"
              aria-label="Link-URL"
              aria-invalid={linkInvalid}
              className="flex-1 rounded border px-2 py-1 text-sm"
            />
            <button
              type="button"
              disabled={linkInvalid}
              className={`${btnCls} text-sm disabled:opacity-50`}
              onClick={applyLink}
            >
              Toepassen
            </button>
            <button
              type="button"
              className={`${btnCls} text-sm`}
              onClick={() => toggleLink(null)}
            >
              Verwijderen
            </button>
          </div>
          {linkInvalid && (
            <p className="mt-1 text-xs text-destructive">
              Alleen http(s)- en mailto-links zijn toegestaan.
            </p>
          )}
        </div>
      )}
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
      <div className="rounded border focus-within:ring-2 focus-within:ring-ring">
        <Toolbar />
        {/* Own positioning context so the placeholder anchors to the editable
            area (below the toolbar), not the whole widget. */}
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                ariaLabel={ariaLabel}
                className="min-h-[200px] px-3 py-2 outline-none"
                aria-placeholder="Begin met schrijven…"
                placeholder={
                  <div className="pointer-events-none absolute left-3 top-2 text-muted-foreground">
                    Begin met schrijven…
                  </div>
                }
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin validateUrl={isSafeHref} />
        <OnChangePlugin
          onChange={(editorState) => onChange(editorState.toJSON())}
        />
      </div>
    </LexicalComposer>
  );
}
