import chalk from "chalk";
import { confirm } from "@clack/prompts";
import { PrereqStatus } from "../utils/prereqs.js";
import { AgentConfig } from "../config.js";
import { PlatformType, ShellInfo } from "../utils/os.js";
import { LocalRuntimeStatus } from "../llm/localDetector.js";
import { CatalogModel, OnlineModelResult, OpenRouterModelInfo } from "../llm/modelHub.js";

export function printBanner(
  config: AgentConfig,
  platform: PlatformType,
  shell: ShellInfo,
  prereqs: PrereqStatus
): void {
  console.log();
  console.log(chalk.bold.hex("#7928CA")("┌────────────────────────────────────────────────────────┐"));
  console.log(
    chalk.bold.hex("#7928CA")("│") +
      chalk.bold.hex("#00DFD8")("  Cadmus - Terminal AI Coding Agent                     ") +
      chalk.bold.hex("#7928CA")("│")
  );
  console.log(
    chalk.bold.hex("#7928CA")("│") +
      chalk.dim("  Terminal-native AI pair programmer with SQLite search ") +
      chalk.bold.hex("#7928CA")("│")
  );
  console.log(chalk.bold.hex("#7928CA")("└────────────────────────────────────────────────────────┘"));
  console.log();

  console.log(
    `${chalk.cyan("• OS:")} ${platform} (${shell.shell})  ${chalk.cyan("• Ripgrep:")} ${
      prereqs.ripgrep.available
        ? chalk.green(`available (${prereqs.ripgrep.source})`)
        : chalk.red("missing")
    }  ${chalk.cyan("• Git:")} ${
      prereqs.git.available ? chalk.green("ready") : chalk.yellow("not found")
    }`
  );
  console.log(
    `${chalk.cyan("• Model:")} ${chalk.bold(config.defaultModel)}  ${chalk.cyan("• Workspace:")} ${chalk.dim(
      config.workspaceRoot
    )}`
  );
  console.log();
  console.log(
    chalk.cyan("Type ") +
    chalk.bold.yellow("/") +
    chalk.cyan(" for interactive command popover • Type ") +
    chalk.bold.yellow("@") +
    chalk.cyan(" to attach context • Press ") +
    chalk.bold.white("Tab") +
    chalk.cyan(" to autocomplete\n")
  );
}

export function printHelp(): void {
  console.log(chalk.bold("\nOpenCode Leader Key Shortcuts (Ctrl+X):"));
  console.log(`  ${chalk.yellow("Ctrl+X n")}  - Start fresh new session (/clear)`);
  console.log(`  ${chalk.yellow("Ctrl+X l")}  - Open session switcher dialog (/sessions)`);
  console.log(`  ${chalk.yellow("Ctrl+X m")}  - Open model selector modal (/models)`);
  console.log(`  ${chalk.yellow("Ctrl+X c")}  - Compact conversation history (/compact)`);
  console.log(`  ${chalk.yellow("Ctrl+X u")}  - Undo last turn and rollback file modifications (/undo)`);
  console.log(`  ${chalk.yellow("Ctrl+X d")}  - Toggle verbose tool execution details (/details)`);
  console.log(`  ${chalk.yellow("Ctrl+X t")}  - Switch interface color theme (/theme)`);
  console.log(`  ${chalk.yellow("Ctrl+X h")}  - Open this help overview (/help)`);
  console.log(`  ${chalk.yellow("Ctrl+X q")}  - Exit the agent (/exit)`);
  console.log(`  ${chalk.yellow("Ctrl+P")}    - Global fuzzy Command Palette modal\n`);

  console.log(chalk.bold("Available Slash Commands:"));
  console.log(`  ${chalk.cyan("/mode")} [plan|build] - Toggle between BUILD (read/write) & PLAN (safe read-only)`);
  console.log(`  ${chalk.cyan("/theme")}             - Open color theme picker (tokyonight, catppuccin, nord...)`);
  console.log(`  ${chalk.cyan("/sessions")}          - Switch or manage conversation sessions`);
  console.log(`  ${chalk.cyan("/undo")}              - Revert file changes from the most recent turn`);
  console.log(`  ${chalk.cyan("/details")}           - Toggle verbose tool execution disclosure`);
  console.log(`  ${chalk.cyan("/compact")}           - Compact conversation history into concise summary`);
  console.log(`  ${chalk.cyan("/connect")}           - Open interactive API key manager dialog`);
  console.log(`  ${chalk.cyan("/models")}            - Browse curated models (Ollama, AirLLM, Cloud)`);
  console.log(`  ${chalk.cyan("/models openrouter")}  - Browse OpenRouter cloud models`);
  console.log(`  ${chalk.cyan("/models search <q>")} - Search live Hugging Face models`);
  console.log(`  ${chalk.cyan("/pull <model>")}     - 1-click download/pull a model directly`);
  console.log(`  ${chalk.cyan("/local")}            - Detect running local LLMs and AirLLM`);
  console.log(`  ${chalk.cyan("/model <name>")}     - Switch active model (e.g. /model ollama/qwen2.5-coder:7b)`);
  console.log(`  ${chalk.cyan("/index")}            - Scan and index workspace into SQLite for hybrid search`);
  console.log(`  ${chalk.cyan("/status")}           - Show OS, shell, ripgrep, and database status`);
  console.log(`  ${chalk.cyan("/clear")}            - Start a fresh conversation session`);
  console.log(`  ${chalk.cyan("/help")}             - Show this help overview`);
  console.log(`  ${chalk.cyan("/exit")}             - Exit the agent\n`);

  console.log(chalk.bold("OpenCode Shortcuts & Context Attachments:"));
  console.log(`  ${chalk.yellow("!<cmd>")}           - Instant shell execution without LLM (e.g. !git status)`);
  console.log(`  ${chalk.yellow("@<file>")}          - Live workspace file fuzzy autocomplete`);
  console.log(`  ${chalk.yellow("@file <path>#1-20")}- Attach specific file or line window`);
  console.log(`  ${chalk.yellow("@folder <dir>")}    - Attach directory tree and structure`);
  console.log(`  ${chalk.yellow("@git")}             - Attach branch, status, and git diff`);
  console.log(`  ${chalk.yellow("@web <url>")}       - Fetch web docs and convert to markdown`);
  console.log(`  ${chalk.yellow("@search <query>")}  - Hybrid SQLite search top code snippets\n`);

  console.log(chalk.bold("7 Core Agent Tools:"));
  console.log(`  • ${chalk.green("read_file")}            - Read specific files with line ranges`);
  console.log(`  • ${chalk.green("edit_file")}            - Apply targeted search-and-replace updates`);
  console.log(`  • ${chalk.green("list_dir")}             - Explore folder hierarchies`);
  console.log(`  • ${chalk.green("file_search")}          - Fast file name & glob matching`);
  console.log(`  • ${chalk.green("codebase_search")}      - Conceptual semantic search in SQLite`);
  console.log(`  • ${chalk.green("grep_search")}          - Blazing fast regex search via ripgrep`);
  console.log(`  • ${chalk.green("run_terminal_command")} - Execute terminal shell commands safely\n`);
}

/**
 * Interactive terminal confirmation prompt for file changes and terminal commands
 */
export async function promptConfirmation(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return true;
  }
  try {
    console.log();
    const answer = await confirm({
      message: question,
      initialValue: true,
    });

    return Boolean(answer);
  } catch {
    return false;
  }
}

export function printLocalStatus(status: LocalRuntimeStatus): void {
  console.log(chalk.bold("\nLocal LLM Runtimes & AirLLM Status:"));
  
  // Ollama
  const ollamaStatus = status.ollama.running
    ? chalk.green(`Running (${status.ollama.url})`)
    : chalk.dim("Not detected");
  console.log(`\n  ${chalk.cyan.bold("1. Ollama:")} ${ollamaStatus}`);
  if (status.ollama.running) {
    if (status.ollama.models.length > 0) {
      status.ollama.models.forEach((m) => {
        const sizeTag = m.parameterSize ? chalk.yellow(`[${m.parameterSize}]`) : "";
        console.log(`     • ${m.name} ${sizeTag}`);
      });
    } else {
      console.log(chalk.dim("     (No models pulled. Run 'ollama pull <model>')"));
    }
  }

  // LM Studio
  const lmStudioStatus = status.lmStudio.running
    ? chalk.green(`Running (${status.lmStudio.url})`)
    : chalk.dim("Not detected");
  console.log(`\n  ${chalk.cyan.bold("2. LM Studio:")} ${lmStudioStatus}`);
  if (status.lmStudio.running && status.lmStudio.models.length > 0) {
    status.lmStudio.models.forEach((m) => {
      console.log(`     • ${m.name}`);
    });
  }

  // AirLLM
  const airllmServer = status.airllm.serverRunning
    ? chalk.green(`Server Active on ${status.airllm.url}`)
    : chalk.dim("Server inactive");
  console.log(`\n  ${chalk.cyan.bold("3. AirLLM (Layer-Wise 70B Engine for 4GB VRAM):")} ${airllmServer}`);
  console.log(`     • Python: ${status.airllm.pythonAvailable ? chalk.green(status.airllm.pythonPath) : chalk.red("Not found")}`);
  console.log(`     • 'airllm' package: ${status.airllm.airllmInstalled ? chalk.green("Installed") : chalk.yellow("Not installed (run 'pip install airllm')")}`);
  
  console.log(chalk.bold("\n  Recommended Large Models with AirLLM:"));
  status.airllm.recommendedModels.forEach((m) => {
    console.log(`     • ${chalk.green(m)} ${chalk.dim("(Runs on 4GB-8GB VRAM without OOM crashes)")}`);
  });
  
  console.log(chalk.dim("\n  To start AirLLM bridge:"));
  console.log(chalk.dim("  python scripts/airllm_server.py --model meta-llama/Meta-Llama-3-70B-Instruct --port 8001\n"));
}

export function printModelCatalog(catalog: CatalogModel[], installedOllamaModels: string[]): void {
  console.log(chalk.bold("\n========================================================"));
  console.log(chalk.bold.cyan("  Curated Coding Models Catalog"));
  console.log(chalk.bold("========================================================\n"));

  // 1. Fast Local Models
  console.log(chalk.bold.hex("#00DFD8")("⚡ Fast Local Models (Run in Ollama - High Speed)"));
  catalog
    .filter((m) => m.category === "fast-local")
    .forEach((m) => {
      const isInstalled = installedOllamaModels.some((name) => name.includes(m.id));
      const statusBadge = isInstalled
        ? chalk.bgGreen.black(" INSTALLED ")
        : chalk.bgCyan.black(` PULL: /pull ${m.id} `);
      console.log(`\n  ${chalk.bold.white(m.name)}  ${statusBadge}`);
      console.log(`  ${chalk.dim("ID:")} ${chalk.cyan(m.id)}  ${chalk.dim("Size:")} ${m.size}  ${chalk.dim("VRAM:")} ${m.minVram}  ${chalk.dim("Context:")} ${m.contextWindow}`);
      console.log(`  ${chalk.dim(m.description)}`);
    });

  // 2. Heavyweight Models (AirLLM)
  console.log(chalk.bold.hex("#7928CA")("\n\n🧠 Heavyweight Local Models (Run in AirLLM on 4GB-8GB VRAM)"));
  catalog
    .filter((m) => m.category === "heavyweight-airllm")
    .forEach((m) => {
      console.log(`\n  ${chalk.bold.white(m.name)}  ${chalk.bgMagenta.black(" AIRLLM 4GB VRAM ")}`);
      console.log(`  ${chalk.dim("ID:")} ${chalk.cyan(m.id)}  ${chalk.dim("Size:")} ${m.size}  ${chalk.dim("VRAM:")} ${chalk.green(m.minVram)}  ${chalk.dim("Context:")} ${m.contextWindow}`);
      console.log(`  ${chalk.dim(m.description)}`);
      console.log(`  ${chalk.dim("Run:")} ${chalk.dim(m.pullCommand)}`);
    });

  // 3. Frontier Cloud Models
  console.log(chalk.bold.yellow("\n\n☁️ Frontier Cloud Models"));
  catalog
    .filter((m) => m.category === "cloud")
    .forEach((m) => {
      console.log(`\n  ${chalk.bold.white(m.name)}`);
      console.log(`  ${chalk.dim("Model ID:")} ${chalk.cyan(m.id)}  ${chalk.dim("Context:")} ${m.contextWindow}`);
      console.log(`  ${chalk.dim(m.description)}`);
    });

  console.log(chalk.bold("\nQuick Actions:"));
  console.log(`  • 1-Click Pull:   ${chalk.cyan("/pull <model_id>")} (e.g. /pull qwen2.5-coder:7b)`);
  console.log(`  • Search Online:  ${chalk.cyan("/models search <query>")} (searches Hugging Face)`);
  console.log(`  • Switch Model:   ${chalk.cyan("/model <model_id>")}\n`);
}

export function printOnlineSearchResults(query: string, results: OnlineModelResult[]): void {
  console.log(chalk.bold(`\nLive Hugging Face Search Results for "${query}":\n`));
  if (results.length === 0) {
    console.log(chalk.yellow("  No models found matching that query."));
    return;
  }

  results.forEach((r, idx) => {
    const engineBadge = r.engine === "airllm"
      ? chalk.bgMagenta.black(" AIRLLM (70B/32B) ")
      : chalk.bgBlue.black(" OLLAMA / GGUF ");
    console.log(`  ${idx + 1}. ${chalk.bold.white(r.id)}  ${engineBadge}`);
    console.log(`     ${chalk.dim("Downloads:")} ${r.downloads.toLocaleString()}  ${chalk.dim("Likes:")} ${r.likes}`);
    if (r.engine === "airllm") {
      console.log(`     ${chalk.dim("Run with AirLLM:")} python scripts/airllm_server.py --model ${r.id} --port 8001`);
    } else {
      console.log(`     ${chalk.dim("Pull with Ollama:")} /pull ${r.id}`);
    }
    console.log();
  });
}

export function printOpenRouterResults(query: string, results: OpenRouterModelInfo[]): void {
  console.log(chalk.bold(`\nLive OpenRouter Models for "${query || "all"}":\n`));
  if (results.length === 0) {
    console.log(chalk.yellow("  No models found on OpenRouter matching that query."));
    return;
  }

  results.forEach((r, idx) => {
    console.log(`  ${idx + 1}. ${chalk.bold.white(r.name)}  ${chalk.bgCyan.black(" OPENROUTER ")}`);
    console.log(`     ${chalk.dim("ID:")} ${chalk.green(r.id)}  ${chalk.dim("Context:")} ${(r.contextLength / 1000).toFixed(0)}k`);
    console.log(`     ${chalk.dim("Prompt Price:")} ${r.promptPrice}  ${chalk.dim("Completion Price:")} ${r.completionPrice}`);
    console.log(`     ${chalk.dim("To use:")} /model ${r.id}`);
    console.log();
  });
}



