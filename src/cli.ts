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
  -a, --app-name <name>       App name label (default: local-app)
      --provider <name>       AI provider: openai|anthropic|ollama|none (default: openai)
      --model <id>            AI model id (provider-specific)
      --ollama-base-url <url> Ollama base URL (default: http://127.0.0.1:11434/v1)
  -h, --help                  Show help

Environment:
  OPENAI_API_KEY              Required when --provider openai
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

  const rootDir = args.root ? path.resolve(String(args.root)) : process.cwd();

  const { host, port } = await startServer({
    host: args.host ? String(args.host) : undefined,
    port: args.port ? Number(args.port) : undefined,
    appName: args.appName ? String(args.appName) : undefined,
    rootDir,
  });

  console.log(`mock-bff running at http://${host}:${port}`);
  console.log(`admin ui: http://${host}:${port}/-/admin`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
