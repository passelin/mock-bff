#!/usr/bin/env node
import path from "node:path";
import { startServer } from "./server.js";

function printHelp() {
  console.log(`mock-bff - UI mock server from HAR/OpenAPI

Usage:
  mock-bff [options]

Options:
  -p, --port <number>         Server port (default: 8787)
  -H, --host <host>           Server host (default: 0.0.0.0)
  -r, --root <path>           Project root directory (default: cwd)
      --mocks-dir <path>      Mocks directory (default: <root>/mocks)
  -a, --app-name <name>       App name label (default: local-app)
      --provider <name>       AI provider: openai|anthropic|ollama|none (default: openai)
      --model <id>            AI model id (provider-specific)
      --openai-base-url <url> OpenAI-compatible base URL override for OpenAI provider
      --anthropic-base-url <url> Anthropic base URL override
      --ollama-base-url <url> Ollama base URL (default: http://127.0.0.1:11434)
  -h, --help                  Show help

Environment:
  OPENAI_API_KEY              Required when --provider openai
  ANTHROPIC_API_KEY           Required when --provider anthropic
  OPENAI_BASE_URL             Optional OpenAI base URL override
  ANTHROPIC_BASE_URL          Optional Anthropic base URL override
  OLLAMA_BASE_URL             Optional Ollama base URL override (default http://127.0.0.1:11434)
  MOCK_MAX_UPLOAD_BYTES       Multipart upload limit bytes (default: 250MB)
`);
}

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = argv[i + 1];
    const eat = () => {
      i += 1;
      return next;
    };

    if (a === "-h" || a === "--help") out.help = true;
    else if (a === "-p" || a === "--port") out.port = eat();
    else if (a === "-H" || a === "--host") out.host = eat();
    else if (a === "-r" || a === "--root") out.root = eat();
    else if (a === "-a" || a === "--app-name") out.appName = eat();
    else if (a === "--provider") out.provider = eat();
    else if (a === "--model") out.model = eat();
    else if (a === "--openai-base-url") out.openaiBaseUrl = eat();
    else if (a === "--anthropic-base-url") out.anthropicBaseUrl = eat();
    else if (a === "--mocks-dir") out.mocksDir = eat();
    else if (a === "--ollama-base-url") out.ollamaBaseUrl = eat();
    else throw new Error(`Unknown option: ${a}`);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (args.provider) process.env.MOCK_AI_PROVIDER = String(args.provider);
  if (args.model) process.env.MOCK_AI_MODEL = String(args.model);
  if (args.openaiBaseUrl)
    process.env.OPENAI_BASE_URL = String(args.openaiBaseUrl);
  if (args.anthropicBaseUrl)
    process.env.ANTHROPIC_BASE_URL = String(args.anthropicBaseUrl);
  if (args.ollamaBaseUrl)
    process.env.OLLAMA_BASE_URL = String(args.ollamaBaseUrl);

  const rootDir = args.root ? path.resolve(String(args.root)) : process.cwd();
  const mocksDir = args.mocksDir ? path.resolve(String(args.mocksDir)) : undefined;

  const { host, port } = await startServer({
    host: args.host ? String(args.host) : undefined,
    port: args.port ? Number(args.port) : undefined,
    appName: args.appName ? String(args.appName) : undefined,
    rootDir,
    mocksDir,
  });

  console.log(`mock-bff running at http://${host}:${port}`);
  console.log(`admin ui: http://${host}:${port}/-/admin`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
