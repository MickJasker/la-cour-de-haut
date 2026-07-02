import "server-only";
import type { SerializedEditorState } from "lexical";
import { $getRoot, $insertNodes } from "lexical";
import { createHeadlessEditor } from "@lexical/headless";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { EDITOR_NODES } from "./nodes";

/**
 * Admin-only conversion between a serialized Lexical EditorState and HTML, so
 * rich POI detail can be machine-translated as `text/html` and stored back as
 * EditorState JSON. Confined to the server (translation action); never reaches
 * the public render path. See ADR-0015.
 *
 * Both directions need a DOM (Lexical's HTML export builds elements; the import
 * parses them). In tests we run under jsdom and use the ambient DOM; in the
 * Node server runtime we lazily spin up happy-dom and restore globals after, so
 * no DOM leaks into the long-lived process.
 */
async function withDom<T>(fn: () => T): Promise<T> {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.document !== "undefined" && typeof g.DOMParser !== "undefined") {
    return fn();
  }

  const { Window } = await import("happy-dom");
  const win = new Window();
  const prev = {
    document: g.document,
    window: g.window,
    DOMParser: g.DOMParser,
  };
  g.document = win.document;
  g.window = win;
  g.DOMParser = win.DOMParser;
  try {
    return fn();
  } finally {
    g.document = prev.document;
    g.window = prev.window;
    g.DOMParser = prev.DOMParser;
  }
}

function newEditor() {
  return createHeadlessEditor({
    nodes: EDITOR_NODES,
    onError: (error) => {
      throw error;
    },
  });
}

export function editorStateToHtml(
  state: SerializedEditorState,
): Promise<string> {
  return withDom(() => {
    const editor = newEditor();
    editor.setEditorState(editor.parseEditorState(state));
    let html = "";
    editor.read(() => {
      html = $generateHtmlFromNodes(editor, null);
    });
    return html;
  });
}

export function htmlToEditorState(
  html: string,
): Promise<SerializedEditorState> {
  return withDom(() => {
    const editor = newEditor();
    editor.update(
      () => {
        const dom = new DOMParser().parseFromString(html, "text/html");
        const nodes = $generateNodesFromDOM(editor, dom);
        const root = $getRoot();
        root.clear();
        root.select();
        $insertNodes(nodes);
      },
      { discrete: true },
    );
    return editor.getEditorState().toJSON();
  });
}
