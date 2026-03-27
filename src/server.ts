import "dotenv/config";
import { createApp } from "./app.js";

export interface ServerStartOptions {
  port?: number;
  host?: string;
  appName?: string;
  rootDir?: string;
  mocksDir?: string;
}

export async function startServer(opts: ServerStartOptions = {}) {
  const port = opts.port ?? Number(process.env.PORT || 8787);
  const host = opts.host ?? process.env.HOST ?? "0.0.0.0";
  const appName = opts.appName ?? process.env.MOCK_APP_NAME ?? "local-app";
  const rootDir = opts.rootDir ?? process.env.MOCK_ROOT_DIR ?? process.cwd();
  const mocksDir = opts.mocksDir ?? process.env.MOCK_MOCKS_DIR;

  const app = await createApp({ rootDir, appName, mocksDir });
  await app.listen({ port, host });

  return { app, port, host };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { port, host } = await startServer();
  console.log(`BFF Mock Server listening at http://${host}:${port}`);
  console.log(`admin: http://${host}:${port}/-/admin`);
}
