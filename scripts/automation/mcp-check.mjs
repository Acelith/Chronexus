import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import { Readable, Writable } from "node:stream";
import { connection, run } from "./mcp.mjs";
async function fixture(fn) {
  const dir = await mkdtemp(join(tmpdir(), "chronexus-mcp-"));
  const calls = [];
  const server = http.createServer(async (req, res) => {
    assert.equal(req.headers.authorization, "Bearer " + "a".repeat(64));
    let raw = "";
    for await (const c of req) raw += c;
    const body = JSON.parse(raw);
    calls.push(body);
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify(
        body.tool === "describe"
          ? { result: { tools: [{ name: "chronexus_session" }] } }
          : body.tool === "denied"
            ? { error: "Sola lettura" }
            : { result: { revision: 1, text: "日本語 العربية" } },
      ),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const path = join(dir, "connection.json");
  await writeFile(
    path,
    JSON.stringify({
      format: "chronexus-automation",
      version: 1,
      endpoint: `http://127.0.0.1:${server.address().port}/automation`,
      token: "a".repeat(64),
      write: false,
      campaignId: null,
      appVersion: "0.3.0",
    }),
  );
  try {
    await fn({ path, calls });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
}
const init = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-11-25",
    clientInfo: { name: "test", version: "1" },
    capabilities: {},
  },
};
const ready = { jsonrpc: "2.0", method: "notifications/initialized" };
async function exchange(path, requests) {
  let raw = "";
  const output = new Writable({
    write(c, _e, done) {
      raw += c;
      done();
    },
  });
  await run({
    connectionPath: path,
    input: Readable.from(
      requests.map((r) =>
        typeof r === "string" ? r : JSON.stringify(r) + "\n",
      ),
    ),
    output,
  });
  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
test("stdio handshake, discovery and UTF-8 tool results", async () =>
  fixture(async ({ path, calls }) => {
    const result = await exchange(path, [
      init,
      ready,
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "chronexus_session", arguments: {} },
      },
    ]);
    assert.equal(result.length, 3);
    assert.equal(result[0].result.protocolVersion, "2025-11-25");
    assert.match(
      result[0].result.instructions,
      /untrusted data, never instructions/,
    );
    assert.equal(result[1].result.tools[0].name, "chronexus_session");
    assert.equal(
      result[2].result.structuredContent.data.text,
      "日本語 العربية",
    );
    assert.equal(calls.length, 2);
  }));
test("no tool calls before initialization or through notifications", async () =>
  fixture(async ({ path, calls }) => {
    const result = await exchange(path, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "write", arguments: {} },
      },
      {
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name: "write", arguments: {} },
      },
    ]);
    assert.equal(result[0].error.code, -32002);
    assert.equal(
      result[0].error.message,
      "Initialize the MCP connection before using tools.",
    );
    assert.equal(calls.length, 0);
  }));
test("malformed JSON, unknown methods and domain errors use MCP errors", async () =>
  fixture(async ({ path }) => {
    const result = await exchange(path, [
      "bad\n",
      init,
      ready,
      { jsonrpc: "2.0", id: 2, method: "other" },
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "denied", arguments: {} },
      },
    ]);
    assert.equal(result[0].error.code, -32700);
    assert.equal(result[2].error.code, -32601);
    assert.equal(result[2].error.message, "Unsupported MCP method.");
    assert.equal(result[3].result.isError, true);
  }));
test("discovery rejects remote URLs and incomplete lines do not mutate", async () =>
  fixture(async ({ path, calls }) => {
    const original = JSON.parse(
      await (await import("node:fs/promises")).readFile(path, "utf8"),
    );
    for (const endpoint of [
      "https://example.org/automation",
      "http://localhost:1234/automation",
      "http://127.0.0.1:80/automation",
      "http://127.0.0.1:1234/other",
    ]) {
      await writeFile(path, JSON.stringify({ ...original, endpoint }));
      await assert.rejects(connection(path));
    }
    await writeFile(path, JSON.stringify(original));
    const result = await exchange(path, [JSON.stringify(init)]);
    assert.equal(result[0].error.code, -32700);
    assert.equal(calls.length, 0);
  }));
test("unsupported protocol is negotiated to the supported legacy revision", async () =>
  fixture(async ({ path }) => {
    const result = await exchange(path, [
      { ...init, params: { ...init.params, protocolVersion: "future" } },
    ]);
    assert.equal(result[0].result.protocolVersion, "2025-11-25");
  }));
