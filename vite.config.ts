import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: [
        "**/.tools/**",
        "**/.claude/**",
        "**/installers/**",
        "**/src-tauri/target/**",
      ],
    },
  },
  clearScreen: false,
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: [
      ...configDefaults.exclude,
      "**/.tools/**",
      // Agent worktrees are full checkouts: never run their tests here.
      "**/.claude/**",
      "**/installers/**",
      "**/src-tauri/target/**",
    ],
  },
});
