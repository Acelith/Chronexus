#!/usr/bin/env node
// Coordinator of the multi-device sharing scenario (docs/QA.md, "Sharing across devices").
// A small key/value board that the app instances (one per role, each behind its own Vite
// dev server) use to hand each other invitation codes and to wait for each other's steps.
// It also runs the two operator actions the scenario needs on the test deployment:
// issuing a server invitation and stopping/starting the HTTPS proxy (offline test).
//
//   CHRONEXUS_SYNC_COMPOSE=/path/to/compose-wrapper node scripts/qa/sync/board.mjs
//
// The wrapper runs `docker compose ...` for the test deployment with the arguments it gets.
// Reports land in CHRONEXUS_SYNC_REPORTS (default .tools/sync). Synthetic data only.
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const compose = process.env.CHRONEXUS_SYNC_COMPOSE;
if (!compose) throw Error("Set CHRONEXUS_SYNC_COMPOSE to the compose wrapper.");
const reports = resolve(process.env.CHRONEXUS_SYNC_REPORTS ?? ".tools/sync");
const port = Number(process.env.CHRONEXUS_SYNC_BOARD_PORT ?? 7700);
mkdirSync(reports, { recursive: true });

const board = new Map();
const waiters = new Map();

function run(args) {
  return new Promise((done, fail) =>
    execFile(compose, args, { timeout: 60_000 }, (error, stdout, stderr) =>
      error ? fail(Error(stderr || error.message)) : done(stdout.trim()),
    ),
  );
}
const ops = {
  "server-invite": () =>
    run(["exec", "-T", "server", "chronexus-server", "invite"]).then(
      (out) =>
        out.split(/\s+/).find((word) => /^[A-Za-z0-9_-]{16,}$/.test(word)) ??
        out,
    ),
  "proxy-stop": () => run(["stop", "proxy"]),
  "proxy-start": () => run(["start", "proxy"]),
};

function body(req) {
  return new Promise((done) => {
    let text = "";
    req.on("data", (chunk) => (text += chunk));
    req.on("end", () => done(text));
  });
}
function send(res, status, value) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(value === undefined ? "" : JSON.stringify(value));
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://board");
  const [, area, name] = url.pathname.split("/");
  try {
    if (area === "board" && req.method === "PUT") {
      const value = JSON.parse(await body(req));
      board.set(name, value);
      console.log(`board ${name} =`, JSON.stringify(value).slice(0, 120));
      for (const wake of waiters.get(name) ?? []) wake(value);
      waiters.delete(name);
      return send(res, 204);
    }
    if (area === "board" && req.method === "GET") {
      if (board.has(name)) return send(res, 200, board.get(name));
      const wait = Math.min(Number(url.searchParams.get("wait") ?? 0), 25_000);
      if (!wait) return send(res, 204);
      const value = await new Promise((done) => {
        const list = waiters.get(name) ?? [];
        list.push(done);
        waiters.set(name, list);
        setTimeout(() => done(undefined), wait);
      });
      return value === undefined ? send(res, 204) : send(res, 200, value);
    }
    if (area === "op" && req.method === "POST" && ops[name]) {
      const result = await ops[name]();
      console.log(`op ${name} done`);
      return send(res, 200, { result });
    }
    if (
      area === "report" &&
      req.method === "POST" &&
      /^[a-z0-9-]+$/.test(name)
    ) {
      writeFileSync(join(reports, `${name}.json`), await body(req));
      return send(res, 204);
    }
    send(res, 404, { error: "not found" });
  } catch (error) {
    console.error(`${req.method} ${url.pathname}:`, error.message);
    send(res, 500, { error: error.message });
  }
}).listen(port, "0.0.0.0", () =>
  console.log(`sync board on :${port}, reports in ${reports}`),
);
