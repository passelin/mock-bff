import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AppConfig,
  IndexEntry,
  MissLogEntry,
  StoredMock,
} from "./types.js";
import { safePathKey } from "./utils.js";

const DEFAULT_CONFIG: AppConfig = {
  appName: "app",
  openApiMode: "assist",
  aiEnabled: true,
  aiProvider: "openai",
  aiModel: "gpt-5.4-mini",
  aiStorePrompt: false,
  providerBaseUrls: {
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com",
    ollama: "http://127.0.0.1:11434",
  },
  aiPromptTemplate: `You are an HTTP server for a Single Page Application.
Read the incoming HTTP request and return the most realistic successful HTTP response for a production-style REST API.

Output requirements:
1. Return exactly one JSON object with these top-level keys:
 - \`status\`: number
 - \`contentType\`: string (mime-type)
 - \`body\`: JSON value or string (depending on content type)
2. Do not include prose, commentary, explanations, or markdown.
3. The response must always be a successful HTTP response (2xx only).

Content negotiation:
1. Inspect the \`Accept\` header to determine the response format.

2. Default behavior (critical):
 - If the \`Accept\` header resembles a typical browser request (e.g. includes multiple types like \`text/html\`, \`application/xhtml+xml\`, \`application/xml\`, \`image/*\`, \`*/*\`), treat it as NO explicit preference.
 - In these cases, ALWAYS return \`application/json\`.
 - If \`*/*\` is present, treat it as no preference and return JSON.

3. Explicit format selection:
 - Only return a non-JSON format (e.g. \`text/html\`) if:
 - The \`Accept\` header specifies a single clear mime type, OR
 - One mime type has a strictly higher q-value than all others and is not a wildcard.
 - Examples that should return HTML:
 - \`Accept: text/html\`
 - \`Accept: text/html;q=1.0, application/json;q=0.5\`

4. Ambiguous or browser-style headers:
 - If multiple types are listed without a clear single winner (even if ordered), IGNORE ordering and return JSON.

5. If the requested type is unsupported or unclear, default to \`application/json\`.

6. For non-JSON responses (only when explicitly required), return a realistic representation (e.g. full HTML document as a string).

7. Always set the \`Content-Type\` header accordingly.

Response behavior:
1. Follow standard REST conventions:
 - \`POST\` creates a resource and returns the created entity.
 - \`GET /collection\` returns an array.
 - \`GET /collection/:id\` returns a single entity.
 - \`PATCH\` partially updates fields and returns the updated entity.
 - \`PUT\` replaces the entity and returns the replaced entity.
 - \`DELETE\` returns \`204\` with \`body: null\` or a confirmation object.
2. Support nested resources such as \`/users/:id/comments/:commentId\`.
3. IDs must be unique and realistic.
4. Timestamps must be realistic ISO-8601 strings.
5. Prefer realistic defaults when information is missing.

Conflict resolution:
1. Always return a successful response (2xx). Never return 4xx or 5xx.
2. If format expectations conflict, prioritize:
 - Explicit \`Accept\` header rules (as defined above)
 - Otherwise default to JSON

Data modeling rules:
1. Use the provided schema and endpoint hints whenever relevant.
2. Preserve field names and types exactly as defined.
3. Populate optional fields only when realistic.
4. Keep generated values internally consistent.
5. IDs should be unique numbers (random).
6. Output VALID JSON ONLY. Do not add ellipsis or other non valid output.

ADDITIONAL CONTEXT:

{{context}}

SIMILAR EXAMPLES:
{{similar_examples_json}}

THE REQUEST:

Timestamp: {{datetime_iso}} 
Method: {{method}}
Path: {{path}}
Query params: {{query_json}}
Body: {{body_json}}
Headers: {{headers_json}}`,
  ignoredQueryParams: ["_", "cacheBust", "timestamp"],
  redactHeaders: ["authorization", "cookie", "set-cookie", "x-api-key"],
  redactBodyKeys: [
    "password",
    "token",
    "accessToken",
    "refreshToken",
    "secret",
    "apiKey",
  ],
  har: {
    onlyApiCalls: true,
    requireJsonResponse: true,
    pathAllowlist: [],
    pathDenylist: [],
    ignorePatterns: [],
    excludeExtensions: [
      ".js",
      ".css",
      ".map",
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".webp",
      ".svg",
      ".ico",
      ".woff",
      ".woff2",
      ".ttf",
      ".eot",
      ".pdf",
    ],
  },
};

export class MockStorage {
  constructor(private readonly rootDir: string) {}

  metaDir() {
    return path.join(this.rootDir, "_meta");
  }

  async ensureLayout(): Promise<void> {
    await mkdir(this.metaDir(), { recursive: true });
    await this.writeConfig(await this.readConfig());
    await this.writeIndex(await this.readIndex());
    const contextPath = path.join(this.metaDir(), "context.md");
    try {
      await readFile(contextPath, "utf8");
    } catch {
      await writeFile(contextPath, "", "utf8");
    }
  }

  async readConfig(): Promise<AppConfig> {
    const file = path.join(this.metaDir(), "app.config.json");
    try {
      const parsed = JSON.parse(
        await readFile(file, "utf8"),
      ) as Partial<AppConfig>;
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        har: {
          ...DEFAULT_CONFIG.har,
          ...(parsed.har ?? {}),
        },
        providerBaseUrls: {
          ...DEFAULT_CONFIG.providerBaseUrls,
          ...(parsed.providerBaseUrls ?? {}),
        },
      };
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  async writeConfig(config: AppConfig): Promise<void> {
    await mkdir(this.metaDir(), { recursive: true });
    await writeFile(
      path.join(this.metaDir(), "app.config.json"),
      JSON.stringify(config, null, 2),
      "utf8",
    );
  }

  async readIndex(): Promise<IndexEntry[]> {
    const file = path.join(this.metaDir(), "index.json");
    try {
      return JSON.parse(await readFile(file, "utf8")) as IndexEntry[];
    } catch {
      return [];
    }
  }

  async writeIndex(entries: IndexEntry[]): Promise<void> {
    await writeFile(
      path.join(this.metaDir(), "index.json"),
      JSON.stringify(entries, null, 2),
      "utf8",
    );
  }

  mockPath(method: string, apiPath: string, variantName: string): string {
    return path.join(
      this.rootDir,
      method.toUpperCase(),
      safePathKey(apiPath),
      "variants",
      `${variantName}.json`,
    );
  }

  defaultPath(method: string, apiPath: string): string {
    return path.join(
      this.rootDir,
      method.toUpperCase(),
      safePathKey(apiPath),
      "default.json",
    );
  }

  async saveVariant(
    method: string,
    apiPath: string,
    variantName: string,
    mock: StoredMock,
  ): Promise<string> {
    const filePath = this.mockPath(method, apiPath, variantName);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(mock, null, 2), "utf8");
    return filePath;
  }

  async saveDefault(
    method: string,
    apiPath: string,
    mock: StoredMock,
  ): Promise<string> {
    const filePath = this.defaultPath(method, apiPath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(mock, null, 2), "utf8");
    return filePath;
  }

  async readMock(filePath: string): Promise<StoredMock | undefined> {
    try {
      return JSON.parse(await readFile(filePath, "utf8")) as StoredMock;
    } catch {
      return undefined;
    }
  }

  async listVariants(method: string, apiPath: string): Promise<string[]> {
    const dir = path.join(
      this.rootDir,
      method.toUpperCase(),
      safePathKey(apiPath),
      "variants",
    );
    try {
      const files = await readdir(dir);
      return files
        .filter((f) => f.endsWith(".json"))
        .map((f) => path.join(dir, f));
    } catch {
      return [];
    }
  }

  async appendMiss(entry: MissLogEntry): Promise<void> {
    await mkdir(this.metaDir(), { recursive: true });
    await writeFile(
      path.join(this.metaDir(), "misses.log.jsonl"),
      `${JSON.stringify(entry)}\n`,
      { flag: "a" },
    );
  }

  async clearMisses(): Promise<void> {
    await mkdir(this.metaDir(), { recursive: true });
    await writeFile(path.join(this.metaDir(), "misses.log.jsonl"), "", "utf8");
  }

  async appendContext(text: string): Promise<void> {
    await writeFile(path.join(this.metaDir(), "context.md"), `${text}\n`, {
      flag: "a",
    });
  }

  async clearEndpoint(method: string, apiPath: string): Promise<void> {
    await rm(
      path.join(this.rootDir, method.toUpperCase(), safePathKey(apiPath)),
      { recursive: true, force: true },
    );
  }

  async clearVariant(
    method: string,
    apiPath: string,
    variantId: string,
  ): Promise<void> {
    await rm(this.mockPath(method, apiPath, variantId), { force: true });
  }

  async clearAllMocks(): Promise<void> {
    const entries = await readdir(this.rootDir, { withFileTypes: true }).catch(
      () => [],
    );
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "_meta") continue;
      await rm(path.join(this.rootDir, entry.name), {
        recursive: true,
        force: true,
      });
    }
    await this.writeIndex([]);
  }
}
