import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createApp } from "../src/app.js";

const HAR_SAMPLE = JSON.stringify({
  log: {
    entries: [
      {
        request: {
          method: "GET",
          url: "https://example.local/api/orders?page=1",
          queryString: [{ name: "page", value: "1" }],
        },
        response: {
          status: 200,
          headers: [{ name: "content-type", value: "application/json" }],
          content: { text: JSON.stringify({ items: [{ id: 1 }] }) },
        },
      },
    ],
  },
});

const OPENAPI_STRICT = JSON.stringify({
  openapi: "3.0.0",
  paths: {
    "/api/unknown": {
      post: {
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["mustExist"],
                  properties: {
                    mustExist: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});

const cleanup: string[] = [];

afterEach(async () => {
  for (const dir of cleanup.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

async function makeApp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mock-bff-"));
  cleanup.push(dir);
  const app = await createApp({ rootDir: dir, appName: "demo" });
  return { app, dir };
}

function multipartPayload(filename: string, content: string, boundary = "abc") {
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload:
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--\r\n`,
  };
}

describe("mock bff", () => {
  it("imports HAR and serves exact match", async () => {
    const { app } = await makeApp();

    const ingest = await app.inject({ method: "POST", url: "/admin/har", ...multipartPayload("sample.har", HAR_SAMPLE) });
    expect(ingest.statusCode).toBe(200);
    expect(ingest.json().imported).toBe(1);

    const replay = await app.inject({ method: "GET", url: "/mock/api/orders?page=1" });
    expect(replay.statusCode).toBe(200);
    expect(replay.headers["x-mock-match"]).toBe("exact");
    expect(replay.json()).toEqual({ items: [{ id: 1 }] });

    await app.close();
  });

  it("ignores configured query params when matching variants", async () => {
    const { app } = await makeApp();
    await app.inject({ method: "POST", url: "/admin/har", ...multipartPayload("sample.har", HAR_SAMPLE) });

    const replay = await app.inject({ method: "GET", url: "/mock/api/orders?page=1&_=" + Date.now() });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({ items: [{ id: 1 }] });

    await app.close();
  });

  it("uses AI fallback on miss and then replays same response", async () => {
    const { app } = await makeApp();

    const first = await app.inject({ method: "POST", url: "/mock/api/unknown", payload: { term: "abc" } });
    expect(first.statusCode).toBe(200);
    expect(first.headers["x-mock-match"]).toBe("generated");
    expect(first.headers["x-mock-source"]).toMatch(/^ai/);

    const second = await app.inject({ method: "POST", url: "/mock/api/unknown", payload: { term: "abc" } });
    expect(second.statusCode).toBe(200);
    expect(second.headers["x-mock-match"]).toBe("exact");
    expect(second.json()).toEqual(first.json());

    await app.close();
  });

  it("returns 404 when AI is disabled and no match exists", async () => {
    const { app } = await makeApp();
    await app.inject({ method: "PATCH", url: "/admin/config", payload: { aiEnabled: false } });

    const miss = await app.inject({ method: "GET", url: "/mock/api/not-found" });
    expect(miss.statusCode).toBe(404);
    expect(miss.json()).toEqual({ error: "No mock found" });

    await app.close();
  });

  it("enforces strict openapi mode for generated responses", async () => {
    const { app } = await makeApp();
    await app.inject({ method: "POST", url: "/admin/openapi", ...multipartPayload("openapi.json", OPENAPI_STRICT, "xyz") });
    await app.inject({ method: "PATCH", url: "/admin/config", payload: { openApiMode: "strict", aiEnabled: true } });

    const miss = await app.inject({ method: "POST", url: "/mock/api/unknown", payload: { x: 1 } });
    expect(miss.statusCode).toBe(502);
    expect(miss.headers["x-mock-match"]).toBe("generated-invalid");
    expect(miss.json().error).toContain("violates OpenAPI");

    await app.close();
  });

  it("returns endpoint diagnostics", async () => {
    const { app } = await makeApp();
    await app.inject({ method: "POST", url: "/admin/har", ...multipartPayload("sample.har", HAR_SAMPLE) });

    const diag = await app.inject({ method: "GET", url: "/admin/diagnostics?method=GET&path=/api/orders" });
    expect(diag.statusCode).toBe(200);
    expect(diag.json().indexed).toBe(true);
    expect(diag.json().hasDefault).toBe(true);

    await app.close();
  });

  it("stores request logs in memory with bounded retrieval", async () => {
    const { app } = await makeApp();
    await app.inject({ method: "POST", url: "/admin/har", ...multipartPayload("sample.har", HAR_SAMPLE) });

    await app.inject({ method: "GET", url: "/mock/api/orders?page=1" });
    await app.inject({ method: "GET", url: "/mock/api/not-found" });

    const logs = await app.inject({ method: "GET", url: "/admin/requests?limit=2" });
    expect(logs.statusCode).toBe(200);
    expect(logs.json().rows.length).toBe(2);
    expect(logs.json().rows[0]).toHaveProperty("method");
    expect(logs.json().rows[0]).toHaveProperty("match");

    await app.close();
  });

  it("lists and edits variants via admin API", async () => {
    const { app } = await makeApp();
    await app.inject({ method: "POST", url: "/admin/har", ...multipartPayload("sample.har", HAR_SAMPLE) });

    const list = await app.inject({ method: "GET", url: "/admin/variants?method=GET&path=/api/orders" });
    expect(list.statusCode).toBe(200);
    expect(list.json().variants.length).toBeGreaterThan(0);

    const id = list.json().variants[0].id;
    const one = await app.inject({ method: "GET", url: "/admin/variant?method=GET&path=/api/orders&id=" + encodeURIComponent(id) });
    expect(one.statusCode).toBe(200);

    const updated = { ...one.json().mock, response: { ...one.json().mock.response, body: { items: [{ id: 999 }] } } };
    const save = await app.inject({
      method: "PUT",
      url: "/admin/variant",
      payload: { method: "GET", path: "/api/orders", id, mock: updated },
    });
    expect(save.statusCode).toBe(200);

    const replay = await app.inject({ method: "GET", url: "/mock/api/orders?page=1" });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({ items: [{ id: 999 }] });

    await app.close();
  });
});
