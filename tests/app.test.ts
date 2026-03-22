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
          content: { text: JSON.stringify({ items: [{ id: 1 }] }), mimeType: "application/json" },
        },
      },
      {
        request: {
          method: "GET",
          url: "https://example.local/assets/app.js",
        },
        response: {
          status: 200,
          headers: [{ name: "content-type", value: "application/javascript" }],
          content: { text: "console.log('x')", mimeType: "application/javascript" },
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

    const ingest = await app.inject({ method: "POST", url: "/-/api/har", ...multipartPayload("sample.har", HAR_SAMPLE) });
    expect(ingest.statusCode).toBe(200);
    expect(ingest.json().imported).toBe(1);

    const replay = await app.inject({ method: "GET", url: "/api/orders?page=1" });
    expect(replay.statusCode).toBe(200);
    expect(replay.headers["x-mock-match"]).toBe("exact");
    expect(replay.json()).toEqual({ items: [{ id: 1 }] });

    await app.close();
  });

  it("filters non-api/static asset entries during HAR import", async () => {
    const { app } = await makeApp();

    const ingest = await app.inject({ method: "POST", url: "/-/api/har", ...multipartPayload("sample.har", HAR_SAMPLE) });
    expect(ingest.statusCode).toBe(200);
    expect(ingest.json().imported).toBe(1);

    const endpoints = await app.inject({ method: "GET", url: "/-/api/endpoints" });
    expect(endpoints.statusCode).toBe(200);
    expect(endpoints.json().length).toBe(1);
    expect(endpoints.json()[0].path).toBe("/api/orders");

    await app.close();
  });

  it("ignores configured query params when matching variants", async () => {
    const { app } = await makeApp();
    await app.inject({ method: "POST", url: "/-/api/har", ...multipartPayload("sample.har", HAR_SAMPLE) });

    const replay = await app.inject({ method: "GET", url: "/api/orders?page=1&_=" + Date.now() });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({ items: [{ id: 1 }] });

    await app.close();
  });

  it("uses AI fallback on miss and then replays same response", async () => {
    const { app } = await makeApp();

    const first = await app.inject({ method: "POST", url: "/api/unknown", payload: { term: "abc" } });
    expect(first.statusCode).toBe(200);
    expect(first.headers["x-mock-match"]).toBe("generated");
    expect(first.headers["x-mock-source"]).toMatch(/^ai/);

    const second = await app.inject({ method: "POST", url: "/api/unknown", payload: { term: "abc" } });
    expect(second.statusCode).toBe(200);
    expect(second.headers["x-mock-match"]).toBe("exact");
    expect(second.json()).toEqual(first.json());

    await app.close();
  });

  it("returns 404 when AI is disabled and no match exists", async () => {
    const { app } = await makeApp();
    await app.inject({ method: "PATCH", url: "/-/api/config", payload: { aiEnabled: false } });

    const miss = await app.inject({ method: "GET", url: "/api/not-found" });
    expect(miss.statusCode).toBe(404);
    expect(miss.json()).toEqual({ error: "No mock found" });

    await app.close();
  });

  it("enforces strict openapi mode for generated responses", async () => {
    const { app } = await makeApp();
    await app.inject({ method: "POST", url: "/-/api/openapi", ...multipartPayload("openapi.json", OPENAPI_STRICT, "xyz") });
    await app.inject({ method: "PATCH", url: "/-/api/config", payload: { openApiMode: "strict", aiEnabled: true } });

    const miss = await app.inject({ method: "POST", url: "/api/unknown", payload: { x: 1 } });
    expect(miss.statusCode).toBe(502);
    expect(miss.headers["x-mock-match"]).toBe("generated-invalid");
    expect(miss.json().error).toContain("violates OpenAPI");

    await app.close();
  });

  it("returns endpoint diagnostics", async () => {
    const { app } = await makeApp();
    await app.inject({ method: "POST", url: "/-/api/har", ...multipartPayload("sample.har", HAR_SAMPLE) });

    const diag = await app.inject({ method: "GET", url: "/-/api/diagnostics?method=GET&path=/api/orders" });
    expect(diag.statusCode).toBe(200);
    expect(diag.json().indexed).toBe(true);
    expect(diag.json().hasDefault).toBe(true);

    await app.close();
  });

  it("stores request logs in memory with bounded retrieval", async () => {
    const { app } = await makeApp();
    await app.inject({ method: "POST", url: "/-/api/har", ...multipartPayload("sample.har", HAR_SAMPLE) });

    await app.inject({ method: "GET", url: "/api/orders?page=1" });
    await app.inject({ method: "GET", url: "/api/not-found" });

    const logs = await app.inject({ method: "GET", url: "/-/api/requests?limit=2" });
    expect(logs.statusCode).toBe(200);
    expect(logs.json().rows.length).toBe(2);
    expect(logs.json().rows[0]).toHaveProperty("method");
    expect(logs.json().rows[0]).toHaveProperty("match");

    await app.close();
  });

  it("lists and edits variants via admin API", async () => {
    const { app } = await makeApp();
    await app.inject({ method: "POST", url: "/-/api/har", ...multipartPayload("sample.har", HAR_SAMPLE) });

    const list = await app.inject({ method: "GET", url: "/-/api/variants?method=GET&path=/api/orders" });
    expect(list.statusCode).toBe(200);
    expect(list.json().variants.length).toBeGreaterThan(0);

    const id = list.json().variants[0].id;
    const one = await app.inject({ method: "GET", url: "/-/api/variant?method=GET&path=/api/orders&id=" + encodeURIComponent(id) });
    expect(one.statusCode).toBe(200);

    const updated = { ...one.json().mock, response: { ...one.json().mock.response, body: { items: [{ id: 999 }] } } };
    const save = await app.inject({
      method: "PUT",
      url: "/-/api/variant",
      payload: { method: "GET", path: "/api/orders", id, mock: updated },
    });
    expect(save.statusCode).toBe(200);

    const replay = await app.inject({ method: "GET", url: "/api/orders?page=1" });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({ items: [{ id: 999 }] });

    await app.close();
  });

  it("returns 404 for non-api style asset requests", async () => {
    const { app } = await makeApp();

    const res = await app.inject({ method: "GET", url: "/favicon.ico" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain("Non-API request");

    await app.close();
  });

  it("ignores legacy /admin/* paths and does not add misses", async () => {
    const { app } = await makeApp();

    const res = await app.inject({ method: "GET", url: "/admin/requests" });
    expect(res.statusCode).toBe(404);

    const misses = await app.inject({ method: "GET", url: "/-/api/misses" });
    expect(misses.statusCode).toBe(200);
    expect(Array.isArray(misses.json())).toBe(true);
    expect(misses.json().length).toBe(0);

    await app.close();
  });

  it("fallback generation infers meaningful entity for id-based GET", async () => {
    const { app } = await makeApp();

    const res = await app.inject({ method: "GET", url: "/api/users/1234" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-mock-source"]).toMatch(/^ai/);
    expect(res.json()).toHaveProperty("id");
    expect(String(res.json().id)).toMatch(/1234|\d+/);

    await app.close();
  });

  it("uses similar request response shape for fallback generation", async () => {
    const { app } = await makeApp();

    await app.inject({ method: "PATCH", url: "/-/api/config", payload: { aiProvider: "none", aiEnabled: true } });

    const mock = {
      requestSignature: { method: "GET", path: "/api/users/1234", queryHash: "manual", bodyHash: "manual" },
      requestSnapshot: { query: {}, body: {} },
      response: { status: 200, headers: { "content-type": "application/json" }, body: { id: "1234", fullName: "Avery Chen", role: "admin" } },
      meta: { source: "manual", createdAt: new Date().toISOString() },
    };

    await app.inject({ method: "PUT", url: "/-/api/variant", payload: { method: "GET", path: "/api/users/1234", id: "manual_user_1234", mock } });

    const res = await app.inject({ method: "GET", url: "/api/users/1111" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("fullName");
    expect(res.json()).toHaveProperty("role");

    await app.close();
  });

  it("deletes individual variant via admin API", async () => {
    const { app } = await makeApp();

    const mock = {
      requestSignature: { method: "GET", path: "/api/tmp/1", queryHash: "manual", bodyHash: "manual" },
      requestSnapshot: { query: {}, body: {} },
      response: { status: 200, headers: { "content-type": "application/json" }, body: { ok: true } },
      meta: { source: "manual", createdAt: new Date().toISOString() },
    };

    await app.inject({ method: "PUT", url: "/-/api/variant", payload: { method: "GET", path: "/api/tmp/1", id: "v1", mock } });

    const del = await app.inject({ method: "DELETE", url: "/-/api/variant?method=GET&path=/api/tmp/1&id=v1" });
    expect(del.statusCode).toBe(200);

    const one = await app.inject({ method: "GET", url: "/-/api/variant?method=GET&path=/api/tmp/1&id=v1" });
    expect(one.statusCode).toBe(404);

    await app.close();
  });

  it("creates brand new endpoint/variant via admin variant API", async () => {
    const { app } = await makeApp();

    const mock = {
      requestSignature: { method: "GET", path: "/new/root/path", queryHash: "manual", bodyHash: "manual" },
      requestSnapshot: { query: {}, body: {} },
      response: { status: 200, headers: { "content-type": "application/json" }, body: { hello: "world" } },
      meta: { source: "manual", createdAt: new Date().toISOString() },
    };

    const create = await app.inject({
      method: "PUT",
      url: "/-/api/variant",
      payload: { method: "GET", path: "/new/root/path", id: "manual_v1", mock },
    });
    expect(create.statusCode).toBe(200);

    const endpoints = await app.inject({ method: "GET", url: "/-/api/endpoints" });
    expect(endpoints.statusCode).toBe(200);
    expect(endpoints.json().find((e: any) => e.path === "/new/root/path")).toBeTruthy();

    const replay = await app.inject({ method: "GET", url: "/new/root/path" });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({ hello: "world" });

    await app.close();
  });

  it("clears individual endpoint and all endpoints", async () => {
    const { app } = await makeApp();
    await app.inject({ method: "POST", url: "/-/api/har", ...multipartPayload("sample.har", HAR_SAMPLE) });

    const before = await app.inject({ method: "GET", url: "/-/api/endpoints" });
    expect(before.statusCode).toBe(200);
    expect(before.json().length).toBeGreaterThan(0);

    const clearOne = await app.inject({ method: "DELETE", url: "/-/api/endpoint?method=GET&path=/api/orders" });
    expect(clearOne.statusCode).toBe(200);

    const afterOne = await app.inject({ method: "GET", url: "/-/api/endpoints" });
    expect(afterOne.statusCode).toBe(200);
    expect(afterOne.json().find((e: any) => e.path === "/api/orders")).toBeUndefined();

    await app.inject({ method: "POST", url: "/-/api/har", ...multipartPayload("sample.har", HAR_SAMPLE, "def") });
    const clearAll = await app.inject({ method: "DELETE", url: "/-/api/endpoints" });
    expect(clearAll.statusCode).toBe(200);

    const afterAll = await app.inject({ method: "GET", url: "/-/api/endpoints" });
    expect(afterAll.statusCode).toBe(200);
    expect(afterAll.json()).toEqual([]);

    await app.close();
  });
});
