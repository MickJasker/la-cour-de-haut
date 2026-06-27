import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    // Next.js ships its own copy of server-only; expose an empty stub for tests.
    alias: {
      "server-only": new URL("src/__mocks__/server-only.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: [".claude/**", "node_modules/**"],
  },
});
