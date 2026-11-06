import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next, made depth-agnostic (`**/` prefix)
    // so they also match copies of the repo under .claude/worktrees/*/.next.
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/next-env.d.ts",
    ".claude/worktrees/**",
  ]),
  // ADR-0026: booking status is owned by the lifecycle module. Writing `status`
  // in a bookingRequest `.set({...})` anywhere else bypasses the transition
  // table, its preconditions and the transactional emails.
  {
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.mts"],
    ignores: ["src/lib/booking/lifecycle.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'CallExpression[callee.property.name="set"][callee.object.callee.property.name="update"][callee.object.arguments.0.name="bookingRequest"] > ObjectExpression.arguments > Property[key.name="status"]',
          message:
            "Don't write bookingRequest.status directly — go through applyTransition() in src/lib/booking/lifecycle.ts (ADR-0026).",
        },
      ],
    },
  },
]);

export default eslintConfig;
