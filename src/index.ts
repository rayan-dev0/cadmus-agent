#!/usr/bin/env node
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import ora from "ora";
import { loadConfig } from "./config.js";
import { getPlatform, getSystemShell } from "./utils/os.js";
import { checkPrerequisites } from "./utils/prereqs.js";
import { printBanner, printHelp, printLocalStatus, printModelCatalog, printOnlineSearchResults, printOpenRouterResults, promptConfirmation } from "./ui/terminal.js";
import { AgentOrchestrator } from "./agent/orchestrator.js";
import { indexWorkspace } from "./db/indexer.js";
import { closeDb, getDb } from "./db/database.js";
import { detectLocalRuntimes, recommendEngineForModel, isLargeModel } from "./llm/localDetector.js";
import { CURATED_MODELS, searchOnlineModels, fetchOpenRouterModels, pullOllamaModel } from "./llm/modelHub.js";
import path from "node:path";
import { resolveGitContext } from "./attachments/gitResolver.js";
import { formatStatusBar } from "./ui/statusBar.js";
import { formatHeaderBar } from "./ui/headerBar.js";
import { formatSessionTabs } from "./ui/sessionTabs.js";
import { showToast } from "./ui/toast.js";
import { renderTerminalMarkdown } from "./ui/markdown.js";
import { runConnectDialog } from "./ui/connectDialog.js";
import { promptDiffApproval } from "./ui/diffDialog.js";
import { promptWithAutocomplete } from "./ui/autocompletePrompt.js";
import { loadThemePreference } from "./ui/themes.js";
import { runThemeDialog } from "./ui/themeDialog.js";
import { runSessionsDialog } from "./ui/sessionsModal.js";
import { runOpenCodeBubbleTUI } from "./ui/bubble/app.js";

async function main() {
  const config = loadConfig(process.cwd());
  loadThemePreference(config.workspaceRoot);
  let showDetails = false;
  const platform = getPlatform();
  const shell = getSystemShell();
  const prereqs = checkPrerequisites();

  // Print startup banner
  printBanner(config, platform, shell, prereqs);

  // Initialize SQLite database
  const db = getDb(config.dbPath);

  // Initialize Agent Orchestrator with confirmation & diff dialogs
  const orchestrator = new AgentOrchestrator(config, promptConfirmation, promptDiffApproval);

  // Helper to handle slash commands uniformly across CLI args and interactive REPL
  async function handleSlashCommand(rawCmd: string): Promise<"continue" | "exit"> {
    const cmd = rawCmd.toLowerCase();

    if (cmd === "/exit" || cmd === "/quit") {
      console.log(chalk.dim("Goodbye!"));
      return "exit";
    }

    if (cmd === "/help") {
      printHelp();
      return "continue";
    }

    if (cmd === "/mode" || cmd.startsWith("/mode")) {
      const parts = rawCmd.split(/\s+/);
      if (parts[1]?.toLowerCase() === "plan") {
        orchestrator.setMode("PLAN");
      } else if (parts[1]?.toLowerCase() === "build") {
        orchestrator.setMode("BUILD");
      } else {
        orchestrator.toggleMode();
      }
      showToast(
        "info",
        `Mode Switched to [${orchestrator.mode}]`,
        orchestrator.mode === "PLAN"
          ? "Read-only exploration: file edits and terminal commands are restricted."
          : "Full builder permissions: code modifications and terminal commands enabled."
      );
      return "continue";
    }

    if (cmd === "/compact") {
      const spin = ora("Compacting conversation history...").start();
      try {
        const res = await orchestrator.compactHistory();
        spin.succeed(chalk.green(`✓ Conversation compacted (${res.originalCount} → ${res.newCount} messages)`));
        showToast("success", "History Compacted", res.summary);
      } catch (err: any) {
        spin.fail(chalk.red(`Failed to compact: ${err.message}`));
      }
      return "continue";
    }

    if (cmd === "/connect") {
      await runConnectDialog(config);
      return "continue";
    }

    if (cmd === "/theme") {
      await runThemeDialog(config.workspaceRoot);
      return "continue";
    }

    if (cmd === "/sessions") {
      const res = await runSessionsDialog(config.dbPath, orchestrator.sessionId);
      if (res.action === "new") {
        orchestrator.clearHistory();
        showToast("success", "New Session", "Started fresh session");
      } else if (res.action === "switch" && res.sessionId) {
        orchestrator.sessionId = res.sessionId;
      }
      return "continue";
    }

    if (cmd === "/undo") {
      const undoRes = orchestrator.undoTurn();
      if (undoRes.success) {
        showToast("success", "Turn Undone", undoRes.message);
      } else {
        showToast("warning", "Nothing to Undo", undoRes.message);
      }
      return "continue";
    }

    if (cmd === "/details") {
      showDetails = !showDetails;
      showToast(
        "info",
        "Tool Execution Details",
        showDetails ? "Expanded verbose tool view enabled" : "Compact tool view enabled"
      );
      return "continue";
    }

    if (cmd === "/models" || cmd.startsWith("/models")) {
      const parts = rawCmd.split(/\s+/);
      if (parts[1] === "openrouter") {
        const query = parts.slice(2).join(" ");
        const spin = ora(`Fetching models from OpenRouter API...`).start();
        const results = await fetchOpenRouterModels(query, 8);
        spin.stop();
        printOpenRouterResults(query, results);
        return "continue";
      }

      if (parts[1] === "search" && parts[2]) {
        const query = parts.slice(2).join(" ");
        const spin = ora(`Searching Hugging Face models for "${query}"...`).start();
        const results = await searchOnlineModels(query, 6);
        spin.stop();
        printOnlineSearchResults(query, results);
        return "continue";
      }

      // Browse curated catalog
      const localStatus = await detectLocalRuntimes();
      const installedNames = localStatus.ollama.models.map((m) => m.name);
      printModelCatalog(CURATED_MODELS, installedNames);
      return "continue";
    }

    if (cmd.startsWith("/pull")) {
      const parts = rawCmd.split(/\s+/);
      if (parts.length < 2) {
        console.log(chalk.yellow("Usage: /pull <model-name> (e.g. /pull qwen2.5-coder:7b or /pull deepseek-coder-v2:16b)"));
        return "continue";
      }
      const modelToPull = parts[1];
      const isAirLLM = modelToPull.includes("/") || isLargeModel(modelToPull);

      if (isAirLLM) {
        console.log(chalk.bold.magenta(`\n[AirLLM Model Detected: ${modelToPull}]`));
        console.log("AirLLM streams and caches Hugging Face model weights dynamically layer-by-layer.");
        console.log(`To launch this model with AirLLM (runs on 4GB-8GB VRAM without OOM crashes):`);
        console.log(chalk.cyan(`  python scripts/airllm_server.py --model ${modelToPull} --port 8001\n`));
        console.log(`Then switch agent to use it: ${chalk.green(`/model airllm/${modelToPull}`)}\n`);
        return "continue";
      }

      // Ollama pull
      const pullSpin = ora(`Initiating download for ${modelToPull}...`).start();
      const pullRes = await pullOllamaModel(modelToPull, (status, percent) => {
        if (percent !== undefined) {
          pullSpin.text = `Downloading ${modelToPull}: ${percent}% (${status})`;
        } else {
          pullSpin.text = `${modelToPull}: ${status}`;
        }
      });

      if (pullRes.success) {
        pullSpin.succeed(chalk.green(`✓ ${pullRes.message}`));
        config.defaultModel = `ollama/${modelToPull}`;
        console.log(chalk.green(`✓ Switched active model to: ${chalk.bold(config.defaultModel)}\n`));
      } else {
        pullSpin.fail(chalk.red(`✗ ${pullRes.message}`));
      }
      return "continue";
    }

    if (cmd === "/local") {
      const spin = ora("Scanning for local LLMs (Ollama, LM Studio, AirLLM)...").start();
      const localStatus = await detectLocalRuntimes();
      spin.stop();
      printLocalStatus(localStatus);
      return "continue";
    }

    if (cmd.startsWith("/model")) {
      const parts = rawCmd.split(/\s+/);
      if (parts.length < 2) {
        console.log(`Current model: ${chalk.bold.cyan(config.defaultModel)}`);
        console.log(chalk.dim("Usage: /model <model-name> (e.g. /model ollama/llama3:8b or /model airllm/Meta-Llama-3-70B)"));
        return "continue";
      }
      const newModel = parts[1];
      config.defaultModel = newModel;
      const rec = recommendEngineForModel(newModel);
      console.log(chalk.green(`✓ Switched model to: ${chalk.bold(newModel)}`));
      if (rec.isLargeModel && !newModel.includes("airllm")) {
        console.log(chalk.yellow(`\n[Performance Note] ${rec.reason}`));
        console.log(chalk.dim(`Switch to AirLLM replacement: /model airllm/${newModel}`));
      }
      return "continue";
    }

    if (cmd === "/clear") {
      orchestrator.clearHistory();
      console.log(chalk.green("✓ Conversation session reset."));
      return "continue";
    }

    if (cmd === "/status") {
      const chunkRow: any = db.prepare("SELECT COUNT(*) as count FROM code_chunks").get();
      const fileRow: any = db.prepare("SELECT COUNT(*) as count FROM file_cache").get();
      console.log(chalk.bold("\nSystem & Database Status:"));
      console.log(`  • OS: ${platform} (${process.arch})`);
      console.log(`  • Shell: ${shell.shell}`);
      console.log(`  • Ripgrep: ${prereqs.ripgrep.path} (${prereqs.ripgrep.source})`);
      console.log(`  • Database: ${config.dbPath}`);
      console.log(`  • Indexed Files: ${fileRow?.count || 0}`);
      console.log(`  • Code Chunks in SQLite: ${chunkRow?.count || 0}\n`);
      return "continue";
    }

    if (cmd === "/index") {
      const spin = ora("Indexing repository into SQLite...").start();
      try {
        const stats = await indexWorkspace(config.workspaceRoot, config.dbPath);
        spin.succeed(
          chalk.green(
            `✓ Indexed ${stats.indexedFiles} new/modified files (${stats.totalChunks} total chunks, ${stats.skippedFiles} cached) in ${stats.durationMs}ms`
          )
        );
      } catch (err: any) {
        spin.fail(chalk.red(`Failed to index: ${err.message}`));
      }
      return "continue";
    }

    console.log(chalk.yellow(`Unknown command: ${rawCmd}. Type /help for available commands.`));
    return "continue";
  }

  // Check if a prompt was passed via CLI arguments: e.g. per-agent "check auth.ts" or per-agent "/help"
  const cliArgs = process.argv.slice(2).join(" ").trim();
  if (cliArgs) {
    if (cliArgs.startsWith("/")) {
      await handleSlashCommand(cliArgs);
      closeDb();
      process.exit(0);
    }

    console.log(chalk.bold(`\n> ${cliArgs}\n`));
    try {
      const reply = await orchestrator.runTurn(cliArgs);
      if (reply) {
        console.log("\n" + renderTerminalMarkdown(reply));
      }
      console.log("\n");
    } catch (err: any) {
      console.error(chalk.red(`\nError: ${err.message}\n`));
    }
    closeDb();
    process.exit(0);
  }

  // Interactive OpenCode Bubble Tea TUI
  if (!process.stdin.isTTY) {
    const rl = readline.createInterface({ input, output });
    try {
      while (true) {
        const line = await rl.question("cadmus > ");
        if (!line.trim()) break;
        const reply = await orchestrator.runTurn(line);
        console.log(reply);
      }
    } finally {
      rl.close();
      closeDb();
    }
    return;
  }

  try {
    const gitContext = resolveGitContext(config.workspaceRoot);
    const chunkRow: any = db.prepare("SELECT COUNT(*) as count FROM code_chunks").get();
    const workspaceName = path.basename(config.workspaceRoot);

    await runOpenCodeBubbleTUI(config, orchestrator, {
      workspaceName,
      gitBranch: gitContext.branch,
      gitDirty: gitContext.status !== "(clean working tree)",
      totalChunks: chunkRow?.count || 0,
    });
  } finally {
    closeDb();
  }
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
