#!/usr/bin/env node

import { execFile } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { spawn } from "node:child_process";

const execFileAsync = promisify(execFile);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const runtimeDirectory = join(projectRoot, "data", "runtime");
const pidPath = join(runtimeDirectory, "dev-full.pid");
const logPath = join(runtimeDirectory, "dev-full.log");
const audioPort = 8001;
const webPortCandidates = Array.from({ length: 11 }, (_, index) => 3000 + index);
const managedPorts = [...webPortCandidates, audioPort];

mkdirSync(runtimeDirectory, { recursive: true });

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function processExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function commandOutput(command, args) {
  try {
    const { stdout } = await execFileAsync(command, args, { encoding: "utf8" });
    return stdout.trim();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 1) {
      return "";
    }
    throw error;
  }
}

async function processWorkingDirectory(pid) {
  const output = await commandOutput("/usr/sbin/lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"]);
  const pathLine = output.split("\n").find((line) => line.startsWith("n"));
  return pathLine ? pathLine.slice(1) : "";
}

function belongsToProject(workingDirectory) {
  if (!workingDirectory || !isAbsolute(workingDirectory)) return false;
  const pathFromRoot = relative(projectRoot, workingDirectory);
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
}

async function listenersForPort(port) {
  const output = await commandOutput("/usr/sbin/lsof", [
    "-nP",
    `-iTCP:${port}`,
    "-sTCP:LISTEN",
    "-t",
  ]);
  return [
    ...new Set(
      output
        .split("\n")
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((pid) => Number.isInteger(pid) && pid > 0)
    ),
  ];
}

async function projectListeners() {
  const listeners = [];
  for (const port of managedPorts) {
    for (const pid of await listenersForPort(port)) {
      const workingDirectory = await processWorkingDirectory(pid);
      listeners.push({ pid, port, workingDirectory, managed: belongsToProject(workingDirectory) });
    }
  }
  return listeners;
}

function readManagedPid() {
  try {
    const pid = Number.parseInt(readFileSync(pidPath, "utf8").trim(), 10);
    return Number.isInteger(pid) ? pid : null;
  } catch {
    return null;
  }
}

function signalManagedGroup(pid, signal) {
  if (!processExists(pid)) return;
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // The process may have exited between the checks.
    }
  }
}

async function stopExistingService() {
  const managedPid = readManagedPid();
  if (managedPid) signalManagedGroup(managedPid, "SIGTERM");

  let listeners = await projectListeners();
  for (const listener of listeners.filter((item) => item.managed)) {
    try {
      process.kill(listener.pid, "SIGTERM");
    } catch {
      // The parent process can shut down both listeners after the first signal.
    }
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(250);
    listeners = await projectListeners();
    if (!listeners.some((item) => item.managed)) break;
  }

  for (const listener of listeners.filter((item) => item.managed)) {
    try {
      process.kill(listener.pid, "SIGKILL");
    } catch {
      // The process has already exited.
    }
  }

  const occupiedAudioPort = (await projectListeners()).filter(
    (item) => item.port === audioPort && !item.managed
  );
  if (occupiedAudioPort.length > 0) {
    const summary = occupiedAudioPort
      .map((item) => `${item.port} (PID ${item.pid}, cwd ${item.workingDirectory || "unknown"})`)
      .join(", ");
    throw new Error(`Audio analysis port is already used by another application: ${summary}`);
  }
}

async function chooseWebPort() {
  for (const port of webPortCandidates) {
    if ((await listenersForPort(port)).length === 0) return port;
  }
  throw new Error(`No free web port is available (${webPortCandidates.join(", ")})`);
}

function logTail() {
  try {
    return readFileSync(logPath, "utf8").split("\n").slice(-18).join("\n").trim();
  } catch {
    return "No service log was created.";
  }
}

async function waitUntilReady(childPid, webPort) {
  const deadline = Date.now() + 90_000;
  let lastStatus = "waiting";
  while (Date.now() < deadline) {
    if (!processExists(childPid)) {
      throw new Error(`The service exited before becoming ready.\n${logTail()}`);
    }
    try {
      const audioResponse = await fetch(`http://127.0.0.1:${audioPort}/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (!audioResponse.ok) throw new Error(`Audio analysis returned HTTP ${audioResponse.status}`);
      const response = await fetch(`http://127.0.0.1:${webPort}/api/readiness`, {
        signal: AbortSignal.timeout(5_000),
      });
      const result = await response.json();
      lastStatus = JSON.stringify(result);
      if (response.ok && result.status === "ready") return;
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error);
    }
    await sleep(1_000);
  }
  throw new Error(`The service did not become ready within 90 seconds (${lastStatus}).\n${logTail()}`);
}

async function main() {
  await stopExistingService();
  const webPort = await chooseWebPort();

  const logDescriptor = openSync(logPath, "a");
  const child = spawn(process.execPath, [join(projectRoot, "scripts", "dev-full.mjs")], {
    cwd: projectRoot,
    detached: true,
    env: {
      ...process.env,
      PORT: String(webPort),
      AUDIO_ANALYSIS_PORT: String(audioPort),
      AUDIO_ANALYSIS_URL: `http://127.0.0.1:${audioPort}`,
    },
    stdio: ["ignore", logDescriptor, logDescriptor],
  });
  child.unref();
  closeSync(logDescriptor);
  writeFileSync(pidPath, `${child.pid}\n`, "utf8");

  await waitUntilReady(child.pid, webPort);
  const baseUrl = `http://localhost:${webPort}`;
  console.log(`${baseUrl}/?study=1\n${baseUrl}/research\nLog: ${logPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
