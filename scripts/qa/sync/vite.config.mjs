// Multi-device sharing scenario (docs/QA.md). Serves sync-flows.html at "/" on the debug
// dev URL, so an unmodified debug build runs one role of the scenario through Tauri IPC.
// /board, /op and /report are forwarded to the coordinator (board.mjs).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const role = process.env.CHRONEXUS_SYNC_ROLE;
const server = process.env.CHRONEXUS_SYNC_SERVER;
const board = process.env.CHRONEXUS_SYNC_BOARD ?? "http://127.0.0.1:7700";
if (!["owner", "player", "owner2"].includes(role ?? ""))
  throw Error("Set CHRONEXUS_SYNC_ROLE to owner, player or owner2.");
if (!server?.startsWith("https://"))
  throw Error("Set CHRONEXUS_SYNC_SERVER to the HTTPS test deployment.");

export default defineConfig({
  root: new URL("../../..", import.meta.url).pathname,
  // Several roles may share one checkout (Linux containers on one volume).
  cacheDir: `node_modules/.vite-sync-${role}`,
  plugins: [
    react(),
    {
      name: "chronexus-sync-flows",
      configureServer(vite) {
        vite.middlewares.use((req, _res, next) => {
          if (req.url === "/" || req.url === "/index.html")
            req.url = "/scripts/qa/sync/sync-flows.html";
          next();
        });
      },
    },
  ],
  define: {
    __SYNC_ROLE__: JSON.stringify(role),
    __SYNC_SERVER__: JSON.stringify(server),
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    proxy: { "/board": board, "/op": board, "/report": board },
  },
  clearScreen: false,
});
