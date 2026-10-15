import { spawn } from "node:child_process";
import { z } from "zod";
import chalk from "chalk";
import { ToolDefinition, ToolContext } from "./types.js";
import { getSystemShell, resolveWorkspacePath } from "../utils/os.js";

export const RunTerminalCommandSchema = z.object({
  command: z.string().describe("Terminal shell command to execute"),
  cwd: z.string().optional().describe("Working directory for the command (defaults to project root)"),
  timeout_ms: z.number().int().positive().optional().describe("Timeout in milliseconds (default: 60000)"),
});

export type RunTerminalCommandParams = z.infer<typeof RunTerminalCommandSchema>;

// Disallow dangerous system destructors
const BLOCKED_COMMANDS = [
  /rm\s+-rf\s+\/(\s|$)/,
  /format\s+[a-z]:/i,
  /:(){ :\|:& };:/, // fork bomb
  /del\s+\/[sfq]\s+c:\\/i,
];

export const runTerminalCommandTool: ToolDefinition<RunTerminalCommandParams, string> = {
  name: "run_terminal_command",
  description: "Executes terminal and shell commands directly from the environment (with user confirmation/sandbox controls).",
  parameters: RunTerminalCommandSchema,
  jsonSchema: {
    type: "object",
    properties: {
      command: { type: "string", description: "Terminal shell command to execute" },
      cwd: { type: "string", description: "Working directory for the command" },
      timeout_ms: { type: "integer", description: "Timeout in milliseconds (default: 60000)" },
    },
    required: ["command"],
  },
  requiresConfirmation: true,
  execute: async (params, context: ToolContext) => {
    // Safety check
    for (const pattern of BLOCKED_COMMANDS) {
      if (pattern.test(params.command)) {
        throw new Error(`Execution blocked: Command matches dangerous system pattern: ${params.command}`);
      }
    }

    // Human-in-the-loop confirmation
    if (context.onAskConfirmation) {
      const prompt = `Allow running terminal command?\n${chalk.yellow.bold(params.command)}`;
      const approved = await context.onAskConfirmation(prompt);
      if (!approved) {
        throw new Error(`Command execution rejected by user: ${params.command}`);
      }
    }

    const execCwd = params.cwd
      ? resolveWorkspacePath(context.workspaceRoot, params.cwd)
      : context.workspaceRoot;

    const shellInfo = getSystemShell();
    const timeout = params.timeout_ms ?? 60000;

    return new Promise<string>((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let isTimedOut = false;

      // Launch process with system shell
      const proc = spawn(shellInfo.shell, [...shellInfo.args, params.command], {
        cwd: execCwd,
        env: {
          ...process.env,
          // Force UTF-8 for console output
          PYTHONIOENCODING: "utf-8",
        },
      });

      const timer = setTimeout(() => {
        isTimedOut = true;
        proc.kill();
        reject(new Error(`Command timed out after ${timeout}ms: ${params.command}`));
      }, timeout);

      proc.stdout?.on("data", (chunk) => {
        stdout += chunk.toString("utf8");
      });

      proc.stderr?.on("data", (chunk) => {
        stderr += chunk.toString("utf8");
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to start terminal process: ${err.message}`));
      });

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (isTimedOut) return;

        // Truncate output if excessively large
        const maxChars = 20000;
        let outputText = stdout;
        if (outputText.length > maxChars) {
          outputText = outputText.slice(0, maxChars) + `\n... [Output truncated: ${stdout.length - maxChars} characters elided]`;
        }

        let result = `Command finished with exit code ${code}\n`;
        if (outputText.trim()) {
          result += `\nSTDOUT:\n${outputText.trim()}`;
        }
        if (stderr.trim()) {
          result += `\nSTDERR:\n${stderr.trim()}`;
        }
        if (!outputText.trim() && !stderr.trim()) {
          result += "(No output)";
        }

        resolve(result);
      });
    });
  },
};
