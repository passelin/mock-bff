import { createApp } from "./app.js";

const port = Number(process.env.PORT || 8787);
const appName = process.env.MOCK_APP_NAME || "local-app";
const rootDir = process.env.MOCK_ROOT_DIR || process.cwd();

const app = await createApp({ rootDir, appName });

await app.listen({ port, host: "0.0.0.0" });
console.log(`BFF Mock Server listening at http://0.0.0.0:${port}
    admin: http://0.0.0.0:${port}/admin`);
