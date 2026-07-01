// Pure, dependency-free message resolution shared by the ICU translator
// (`translate.ts`) and the plain client translator (`use-messages.tsx`). Kept in
// its own module with no imports so the plain path never transitively pulls in
// `intl-messageformat`.
type Dictionary = Record<string, unknown>;

export function resolvePath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// Resolves a dotted message key, falling back to the fully-qualified key so
// missing translations are visible rather than throwing. Matches the fallback
// behaviour of `createTranslator` in `translate.ts`.
export function resolveMessage(
  messages: Dictionary,
  namespace: string | undefined,
  key: string,
): string {
  const base = namespace ? resolvePath(messages, namespace) : messages;
  const msg = resolvePath(base, key);
  return typeof msg === "string"
    ? msg
    : namespace
      ? `${namespace}.${key}`
      : key;
}
