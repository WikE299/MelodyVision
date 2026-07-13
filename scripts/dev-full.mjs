import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const serviceDir = join(root, "services", "audio-analysis");
const isWindows = process.platform === "win32";
const python = join(serviceDir, ".venv", isWindows ? "Scripts/python.exe" : "bin/python");

if (!existsSync(python)) {
  console.error("Audio analysis environment is missing. Create services/audio-analysis/.venv with Python 3.12, then install requirements.txt.");
  process.exit(1);
}

const children = [
  spawn(python, ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001"], {
    cwd: serviceDir,
    stdio: "inherit",
  }),
  spawn(isWindows ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: root,
    stdio: "inherit",
  }),
];

function stop(exitCode = 0) {
  children.forEach((child) => child.kill());
  process.exit(exitCode);
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
children.forEach((child) => child.on("exit", (code) => stop(code || 0)));
