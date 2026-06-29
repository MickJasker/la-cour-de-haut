import { HeadingNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { LinkNode } from "@lexical/link";
import type { Klass, LexicalNode } from "lexical";

/**
 * The single source of truth for the POI rich-text feature set. Registered by
 * the admin editor AND the headless editor in the translation bridge so that
 * HTML import/export round-trips faithfully. The public renderer mirrors this
 * set by hand (it must not import Lexical). Built-in Root/Paragraph/Text nodes
 * are always available and need not be listed. See ADR-0015.
 *
 * Minimal prose set: headings (h2/h3), bullet/numbered lists, links, plus the
 * built-in paragraph + bold/italic text formats. No images/embeds/custom nodes.
 */
export const EDITOR_NODES: ReadonlyArray<Klass<LexicalNode>> = [
  HeadingNode,
  ListNode,
  ListItemNode,
  LinkNode,
];

/** Headings the editor is allowed to produce; anything else clamps to h3. */
export const ALLOWED_HEADINGS = ["h2", "h3"] as const;
export type AllowedHeading = (typeof ALLOWED_HEADINGS)[number];

/** Class map applied inside the admin editor only (does not affect public render). */
export const EDITOR_THEME = {
  paragraph: "mb-3 leading-relaxed",
  heading: {
    h2: "text-xl font-semibold mt-5 mb-2",
    h3: "text-lg font-semibold mt-4 mb-2",
  },
  list: {
    ul: "list-disc pl-6 mb-3",
    ol: "list-decimal pl-6 mb-3",
    listitem: "mb-1",
  },
  link: "text-primary underline underline-offset-2",
  text: {
    bold: "font-semibold",
    italic: "italic",
  },
};
