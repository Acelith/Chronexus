// Cross-platform desktop QA without CDP (macOS WKWebView, Linux WebKitGTK).
// Serves ipc-flows.html at "/" on the dev URL, so an unmodified debug build
// runs the real commands through Tauri IPC, then writes the report locally.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { writeFileSync } from "node:fs";

const report = process.env.CHRONEXUS_IPC_REPORT;
if (!report)
  throw Error("Set CHRONEXUS_IPC_REPORT to an absolute report path.");

export default defineConfig({
  root: new URL("../../..", import.meta.url).pathname,
  plugins: [
    react(),
    {
      name: "chronexus-ipc-flows",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/" || req.url === "/index.html")
            req.url = "/scripts/qa/ipc/ipc-flows.html";
          if (req.url === "/report" && req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", () => {
              writeFileSync(report, body);
              res.end("ok");
              console.log("IPC report written:", report);
            });
            return;
          }
          next();
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port: 1420, strictPort: true },
  clearScreen: false,
});
