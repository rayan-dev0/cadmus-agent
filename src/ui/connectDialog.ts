import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { select, text } from "@clack/prompts";
import { AgentConfig } from "../config.js";
import { showToast } from "./toast.js";

function maskKey(key?: string): string {
  if (!key) return chalk.red("(not configured)");
  if (key.length <= 8) return chalk.green("••••••••");
  return chalk.green(`${key.slice(0, 4)}••••${key.slice(-4)}`);
}

/**
 * Updates or adds a key in .env file
 */
function updateEnvFile(workspaceRoot: string, keyName: string, value: string): void {
  const envPath = path.join(workspaceRoot, ".env");
  let content = "";
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf8");
  }

  const regex = new RegExp(`^${keyName}=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `${keyName}=${value}`);
  } else {
    content = content ? `${content.trim()}\n${keyName}=${value}\n` : `${keyName}=${value}\n`;
  }

  fs.writeFileSync(envPath, content, "utf8");
}

/**
 * Interactive /connect dialog to manage LLM API keys
 */
export async function runConnectDialog(config: AgentConfig): Promise<void> {
  console.log(chalk.bold("\n========================================================"));
  console.log(chalk.bold.cyan("  API Key & Provider Connection Manager (/connect)"));
  console.log(chalk.bold("========================================================\n"));

  while (true) {
    const choice = await select({
      message: "Select a provider to configure:",
      options: [
        {
          value: "OPENROUTER_API_KEY",
          label: `OpenRouter (${maskKey(config.openrouterApiKey)})`,
          hint: "Gateway for DeepSeek R1, Claude, Llama 3.3, Qwen",
        },
        {
          value: "ANTHROPIC_API_KEY",
          label: `Anthropic Claude (${maskKey(config.anthropicApiKey)})`,
          hint: "Direct Claude 3.5 & 3.7 Sonnet access",
        },
        {
          value: "OPENAI_API_KEY",
          label: `OpenAI (${maskKey(config.openaiApiKey)})`,
          hint: "Direct GPT-4o and o3-mini access",
        },
        {
          value: "GEMINI_API_KEY",
          label: `Google Gemini (${maskKey(config.geminiApiKey)})`,
          hint: "Direct Gemini 2.0 / 2.5 Flash & Pro access",
        },
        {
          value: "done",
          label: chalk.dim("← Done / Return to chat"),
        },
      ],
    });

    if (choice === "done" || typeof choice === "symbol") {
      break;
    }

    const keyName = choice as string;
    const newKey = await text({
      message: `Enter API Key for ${keyName}:`,
      placeholder: "Paste key here or leave blank to cancel",
    });

    if (typeof newKey === "string" && newKey.trim()) {
      const val = newKey.trim();
      updateEnvFile(config.workspaceRoot, keyName, val);

      // Update runtime config
      if (keyName === "OPENROUTER_API_KEY") config.openrouterApiKey = val;
      if (keyName === "ANTHROPIC_API_KEY") config.anthropicApiKey = val;
      if (keyName === "OPENAI_API_KEY") config.openaiApiKey = val;
      if (keyName === "GEMINI_API_KEY") config.geminiApiKey = val;

      showToast("success", "API Key Saved", `${keyName} successfully updated in .env`);
    }
  }
}
