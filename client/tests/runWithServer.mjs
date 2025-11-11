import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const currentFilePath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFilePath), "..", "..");

const SERVER_PORT = process.env.TEST_SERVER_PORT || "4100";
const serverOrigin = `http://127.0.0.1:${SERVER_PORT}`;
const apiBaseUrl = `${serverOrigin}/api`;

const serverProcess = spawn(process.execPath, ["src/index.js"], {
  cwd: path.join(repoRoot, "server"),
  env: { ...process.env, PORT: SERVER_PORT },
  stdio: "inherit",
});

await waitForServerReady();

const cliArgs = process.argv.slice(2);

const jestArgs = [
  "--experimental-vm-modules",
  path.join(repoRoot, "node_modules", "jest", "bin", "jest.js"),
  "--runInBand",
  ...cliArgs,
];

const jestEnv = {
  ...process.env,
  TEST_BASE_URL: apiBaseUrl,
};

const jestProcess = spawn(process.execPath, jestArgs, {
  cwd: path.join(repoRoot, "client"),
  env: jestEnv,
  stdio: "inherit",
});

const jestExitCode = await new Promise((resolve) =>
  jestProcess.on("exit", (code) => resolve(code ?? 1))
);

serverProcess.kill();
await new Promise((resolve) => serverProcess.on("exit", resolve));

process.exit(jestExitCode);

async function waitForServerReady() {
  const maxAttempts = 60;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (serverProcess.exitCode !== null) {
      throw new Error(
        "Server process exited before the health check succeeded."
      );
    }

    try {
      const res = await fetch(`${apiBaseUrl}/health`);
      if (res.ok) return;
    } catch {
      // Retry after a short delay if the server is not up yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Timed out waiting for the backend server to become ready.");
}
