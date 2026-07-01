import IntlMessageFormat from "intl-messageformat";
import {
  cloneElement,
  createElement,
  isValidElement,
  type ReactNode,
} from "react";
import { resolvePath } from "./resolve";

// Pure formatting layer — no request-scoped or server-only imports, so it is safe
// to use from both Server and Client Components. It wraps `intl-messageformat`
// (the same ICU engine next-intl uses) and resolves messages from a plain
// dictionary object keyed by dotted paths (e.g. namespace "sections.hero" + key
// "description" -> messages.sections.hero.description).

type Dictionary = Record<string, unknown>;
type Values = Record<string, unknown>;

// Shape IntlMessageFormat.format() accepts: ICU primitives, rich-text element
// values, and tag-rendering callbacks.
type FormatValues<T = void> = Record<
  string,
  string | number | boolean | Date | null | undefined | T | ((chunks: T) => T)
>;

// Built-in rich-text tags so call sites can write t.rich("key", { price }) without
// re-declaring `<strong>` renderers each time. Callers can still override or add tags.
const DEFAULT_TAGS: Record<string, (chunks: ReactNode) => ReactNode> = {
  strong: (chunks) => createElement("strong", null, keyChildren(chunks)),
  b: (chunks) => createElement("b", null, keyChildren(chunks)),
  em: (chunks) => createElement("em", null, keyChildren(chunks)),
};

// IntlMessageFormat returns string | element | (string | element)[] for rich text.
// React warns about array children without keys, so assign stable keys to elements.
function keyChildren(node: ReactNode | ReactNode[]): ReactNode {
  if (Array.isArray(node)) {
    return node.map((child, i) =>
      isValidElement(child) ? cloneElement(child, { key: i }) : child,
    );
  }
  return node;
}

export type Translator = {
  (key: string, values?: Values): string;
  rich: (key: string, values?: Values) => ReactNode;
};

export function createTranslator(
  locale: string,
  messages: Dictionary,
  namespace?: string,
): Translator {
  const base = namespace ? resolvePath(messages, namespace) : messages;

  function getMessage(key: string): string {
    const msg = resolvePath(base, key);
    // Fall back to the fully-qualified key so missing translations are visible
    // rather than throwing.
    return typeof msg === "string"
      ? msg
      : namespace
        ? `${namespace}.${key}`
        : key;
  }

  const t = ((key: string, values?: Values): string => {
    const result = new IntlMessageFormat(getMessage(key), locale).format(
      values as Record<
        string,
        string | number | boolean | Date | null | undefined
      >,
    );
    return typeof result === "string" ? result : String(result);
  }) as Translator;

  t.rich = (key: string, values?: Values): ReactNode => {
    const result = new IntlMessageFormat(
      getMessage(key),
      locale,
    ).format<ReactNode>({
      ...DEFAULT_TAGS,
      ...values,
    } as FormatValues<ReactNode>);
    return keyChildren(result);
  };

  return t;
}
