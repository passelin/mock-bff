import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppConfig, IndexEntry, MissLogEntry, StoredMock } from "./types.js";
import { safePathKey } from "./utils.js";

const DEFAULT_CONFIG: AppConfig = {
  appName: "app",
  openApiMode: "assist",
  aiEnabled: true,
  aiProvider: "openai",
  aiModel: "gpt-5.4-mini",
  aiStorePrompt: false,
  ignoredQueryParams: ["_", "cacheBust", "timestamp"],
  redactHeaders: ["authorization", "cookie", "set-cookie", "x-api-key"],
  redactBodyKeys: ["password", "token", "accessToken", "refreshToken", "secret", "apiKey"],
  har: {
    onlyApiCalls: true,
    requireJsonResponse: true,
    pathAllowlist: [],
    pathDenylist: [],
    excludeExtensions: [
      ".js", ".css", ".map", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".pdf",
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
      await writeFile(contextPath, "# Mock Context\n\n", "utf8");
    }
  }

  async readConfig(): Promise<AppConfig> {
    const file = path.join(this.metaDir(), "app.config.json");
    try {
      return { ...DEFAULT_CONFIG, ...(JSON.parse(await readFile(file, "utf8")) as AppConfig) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  async writeConfig(config: AppConfig): Promise<void> {
    await mkdir(this.metaDir(), { recursive: true });
    await writeFile(path.join(this.metaDir(), "app.config.json"), JSON.stringify(config, null, 2), "utf8");
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
    await writeFile(path.join(this.metaDir(), "index.json"), JSON.stringify(entries, null, 2), "utf8");
  }

  mockPath(method: string, apiPath: string, variantName: string): string {
    return path.join(this.rootDir, method.toUpperCase(), safePathKey(apiPath), "variants", `${variantName}.json`);
  }

  defaultPath(method: string, apiPath: string): string {
    return path.join(this.rootDir, method.toUpperCase(), safePathKey(apiPath), "default.json");
  }

  async saveVariant(method: string, apiPath: string, variantName: string, mock: StoredMock): Promise<string> {
    const filePath = this.mockPath(method, apiPath, variantName);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(mock, null, 2), "utf8");
    return filePath;
  }

  async saveDefault(method: string, apiPath: string, mock: StoredMock): Promise<string> {
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
    const dir = path.join(this.rootDir, method.toUpperCase(), safePathKey(apiPath), "variants");
    try {
      const files = await readdir(dir);
      return files.filter((f) => f.endsWith(".json")).map((f) => path.join(dir, f));
    } catch {
      return [];
    }
  }

  async appendMiss(entry: MissLogEntry): Promise<void> {
    await mkdir(this.metaDir(), { recursive: true });
    await writeFile(path.join(this.metaDir(), "misses.log.jsonl"), `${JSON.stringify(entry)}\n`, { flag: "a" });
  }

  async appendContext(text: string): Promise<void> {
    await writeFile(path.join(this.metaDir(), "context.md"), `${text}\n`, { flag: "a" });
  }

  async clearEndpoint(method: string, apiPath: string): Promise<void> {
    await rm(path.join(this.rootDir, method.toUpperCase(), safePathKey(apiPath)), { recursive: true, force: true });
  }

  async clearVariant(method: string, apiPath: string, variantId: string): Promise<void> {
    await rm(this.mockPath(method, apiPath, variantId), { force: true });
  }

  async clearAllMocks(): Promise<void> {
    const entries = await readdir(this.rootDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "_meta") continue;
      await rm(path.join(this.rootDir, entry.name), { recursive: true, force: true });
    }
    await this.writeIndex([]);
  }
}
