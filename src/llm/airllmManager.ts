import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import chalk from "chalk";
import { checkPythonAndAirLLM } from "./localDetector.js";

let runningServerProcess: ChildProcess | null = null;

export interface AirLLMServerOptions {
  model: string;
  port?: number;
  compression?: "none" | "4bit" | "8bit";
  dummy?: boolean;
}

/**
 * Returns installation instructions for AirLLM
 */
export function getAirLLMInstallGuide(pythonAvailable: boolean): string {
  const steps: string[] = [];

  if (!pythonAvailable) {
    steps.push(
      "1. Install Python 3.10+ on your system (from https://www.python.org/ or via 'winget install Python.Python.3.11'). Ensure 'Add Python to PATH' is checked."
    );
  }

  steps.push("2. Install PyTorch with CUDA support (if you have an NVIDIA GPU):");
  steps.push("   pip install torch --index-url https://download.pytorch.org/whl/cu121");
  steps.push("3. Install AirLLM and dependencies:");
  steps.push("   pip install airllm transformers accelerate");
  steps.push("4. Launch a 70B model with layer-wise offloading on 4GB VRAM:");
  steps.push("   python scripts/airllm_server.py --model meta-llama/Meta-Llama-3-70B-Instruct --port 8001");

  return steps.join("\n");
}

/**
 * Starts the AirLLM sidecar server in the background
 */
export async function startAirLLMServer(
  workspaceRoot: string,
  options: AirLLMServerOptions
): Promise<{ success: boolean; url: string; error?: string }> {
  const port = options.port ?? 8001;
  const url = `http://127.0.0.1:${port}`;

  // Check if server is already running on this port
  try {
    const healthCheck = await fetch(`${url}/health`, { signal: AbortSignal.timeout(800) });
    if (healthCheck.ok) {
      return { success: true, url };
    }
  } catch {
    // Not running, proceed to launch
  }

  const pyInfo = checkPythonAndAirLLM();
  if (!pyInfo.pythonAvailable && !options.dummy) {
    return {
      success: false,
      url,
      error: `Python is not installed or not in PATH.\n\nSetup Guide:\n${getAirLLMInstallGuide(false)}`,
    };
  }

  const pythonExec = pyInfo.pythonPath || "python";
  const scriptPath = path.join(workspaceRoot, "scripts", "airllm_server.py");

  const args = [
    scriptPath,
    "--model",
    options.model,
    "--port",
    String(port),
    "--compression",
    options.compression || "4bit",
  ];

  if (options.dummy) {
    args.push("--dummy");
  }

  const proc = spawn(pythonExec, args, {
    cwd: workspaceRoot,
    stdio: "pipe",
    detached: false,
  });

  runningServerProcess = proc;

  proc.stderr?.on("data", (d) => {
    const str = d.toString("utf8");
    if (str.includes("Error") || str.includes("Exception")) {
      console.error(chalk.red(`[AirLLM Server Log] ${str.trim()}`));
    }
  });

  // Wait for server to become healthy (up to 15 seconds)
  const startTime = Date.now();
  while (Date.now() - startTime < 15000) {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(800) });
      if (res.ok) {
        return { success: true, url };
      }
    } catch {
      // still starting
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  return {
    success: false,
    url,
    error: `Timed out waiting for AirLLM server to start on ${url}.`,
  };
}

/**
 * Cleanly terminates the AirLLM sidecar process if running
 */
export function stopAirLLMServer(): void {
  if (runningServerProcess) {
    try {
      runningServerProcess.kill();
      runningServerProcess = null;
    } catch {
      // ignore
    }
  }
}
