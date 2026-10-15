import { spawn } from "node:child_process";
import chalk from "chalk";

export interface CatalogModel {
  id: string;
  name: string;
  size: string;
  minVram: string;
  recommendedEngine: "ollama" | "airllm" | "cloud";
  category: "fast-local" | "heavyweight-airllm" | "cloud";
  description: string;
  contextWindow: string;
  pullCommand: string;
}

export interface OnlineModelResult {
  id: string;
  downloads: number;
  likes: number;
  lastModified?: string;
  engine: "airllm" | "ollama";
}

/**
 * Curated list of the world's best coding models for personal coding agents
 */
export const CURATED_MODELS: CatalogModel[] = [
  // Tier 1: Fast Local Models (Ollama)
  {
    id: "qwen2.5-coder:7b",
    name: "Qwen 2.5 Coder 7B",
    size: "4.7 GB",
    minVram: "6 GB - 8 GB",
    recommendedEngine: "ollama",
    category: "fast-local",
    description: "Highest scoring 7B coding model worldwide. High speed (30-60 tok/s), great at autocomplete, refactoring, and tool calling.",
    contextWindow: "32k",
    pullCommand: "ollama pull qwen2.5-coder:7b",
  },
  {
    id: "qwen2.5-coder:14b",
    name: "Qwen 2.5 Coder 14B",
    size: "9.0 GB",
    minVram: "10 GB - 12 GB",
    recommendedEngine: "ollama",
    category: "fast-local",
    description: "Exceptional balance of speed and complex logic. Solves hard bugs and multi-file architecture questions easily.",
    contextWindow: "32k",
    pullCommand: "ollama pull qwen2.5-coder:14b",
  },
  {
    id: "deepseek-coder-v2:16b",
    name: "DeepSeek Coder V2 16B (MoE)",
    size: "8.9 GB",
    minVram: "10 GB - 12 GB",
    recommendedEngine: "ollama",
    category: "fast-local",
    description: "Mixture of Experts model trained on 338+ programming languages with excellent code completion syntax.",
    contextWindow: "64k",
    pullCommand: "ollama pull deepseek-coder-v2:16b",
  },
  {
    id: "codellama:7b",
    name: "Code Llama 7B",
    size: "3.8 GB",
    minVram: "6 GB",
    recommendedEngine: "ollama",
    category: "fast-local",
    description: "Meta's classic code-specialized model. Very lightweight and quick to download.",
    contextWindow: "16k",
    pullCommand: "ollama pull codellama:7b",
  },

  // Tier 2: Heavyweight Local Models (AirLLM Layer-Wise Engine for 4GB-8GB GPUs)
  {
    id: "Qwen/Qwen2.5-Coder-32B-Instruct",
    name: "Qwen 2.5 Coder 32B Instruct",
    size: "~20 GB (4-bit)",
    minVram: "4 GB - 8 GB (with AirLLM)",
    recommendedEngine: "airllm",
    category: "heavyweight-airllm",
    description: "Near GPT-4 coding intelligence. AirLLM streams layers dynamically to run on modest 4GB/8GB GPUs without OOM crashes.",
    contextWindow: "32k",
    pullCommand: "python scripts/airllm_server.py --model Qwen/Qwen2.5-Coder-32B-Instruct --port 8001",
  },
  {
    id: "meta-llama/Meta-Llama-3-70B-Instruct",
    name: "Llama 3 70B Instruct",
    size: "~40 GB (4-bit)",
    minVram: "4 GB - 8 GB (with AirLLM)",
    recommendedEngine: "airllm",
    category: "heavyweight-airllm",
    description: "Massive 70B parameter frontier open-weights model. Capable of multi-step autonomous planning on 4GB VRAM.",
    contextWindow: "8k - 32k",
    pullCommand: "python scripts/airllm_server.py --model meta-llama/Meta-Llama-3-70B-Instruct --port 8001",
  },
  {
    id: "deepseek-ai/deepseek-coder-33b-instruct",
    name: "DeepSeek Coder 33B Instruct",
    size: "~20 GB (4-bit)",
    minVram: "4 GB - 8 GB (with AirLLM)",
    recommendedEngine: "airllm",
    category: "heavyweight-airllm",
    description: "Project-level code reasoning and full repository analysis using AirLLM layer offloading.",
    contextWindow: "16k",
    pullCommand: "python scripts/airllm_server.py --model deepseek-ai/deepseek-coder-33b-instruct --port 8001",
  },
  {
    id: "mistralai/Mixtral-8x7B-Instruct-v0.1",
    name: "Mixtral 8x7B Instruct",
    size: "~28 GB (4-bit)",
    minVram: "4 GB - 8 GB (with AirLLM)",
    recommendedEngine: "airllm",
    category: "heavyweight-airllm",
    description: "High-throughput 46.7B MoE model offering top instruction following and coding proficiency.",
    contextWindow: "32k",
    pullCommand: "python scripts/airllm_server.py --model mistralai/Mixtral-8x7B-Instruct-v0.1 --port 8001",
  },

  // Tier 3: Frontier Cloud Models
  {
    id: "claude-3-7-sonnet-latest",
    name: "Claude 3.7 Sonnet (Anthropic)",
    size: "Cloud API",
    minVram: "0 GB (Cloud)",
    recommendedEngine: "cloud",
    category: "cloud",
    description: "State-of-the-art coding agent intelligence with hybrid fast/thinking reasoning modes.",
    contextWindow: "200k",
    pullCommand: "Set ANTHROPIC_API_KEY in .env",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o (OpenAI)",
    size: "Cloud API",
    minVram: "0 GB (Cloud)",
    recommendedEngine: "cloud",
    category: "cloud",
    description: "Flagship multimodal OpenAI model with fast tool calling and high reasoning speed.",
    contextWindow: "128k",
    pullCommand: "Set OPENAI_API_KEY in .env",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro (Google)",
    size: "Cloud API",
    minVram: "0 GB (Cloud)",
    recommendedEngine: "cloud",
    category: "cloud",
    description: "Massive context window (1M+ tokens) capable of ingesting entire enterprise codebases in a single prompt.",
    contextWindow: "1M+",
    pullCommand: "Set GEMINI_API_KEY in .env",
  },

  // Tier 4: OpenRouter Unified Gateway
  {
    id: "openrouter/deepseek/deepseek-r1",
    name: "DeepSeek R1 (via OpenRouter)",
    size: "OpenRouter API",
    minVram: "0 GB (Cloud Gateway)",
    recommendedEngine: "cloud",
    category: "cloud",
    description: "Top-tier open reasoning model matching OpenAI o1 on coding and mathematics at a fraction of the cost.",
    contextWindow: "128k",
    pullCommand: "Set OPENROUTER_API_KEY in .env, run /model openrouter/deepseek/deepseek-r1",
  },
  {
    id: "openrouter/anthropic/claude-3.7-sonnet",
    name: "Claude 3.7 Sonnet (via OpenRouter)",
    size: "OpenRouter API",
    minVram: "0 GB (Cloud Gateway)",
    recommendedEngine: "cloud",
    category: "cloud",
    description: "Anthropic flagship model available through OpenRouter without a direct Anthropic account.",
    contextWindow: "200k",
    pullCommand: "Set OPENROUTER_API_KEY in .env, run /model openrouter/anthropic/claude-3.7-sonnet",
  },
  {
    id: "openrouter/qwen/qwen-2.5-coder-32b-instruct",
    name: "Qwen 2.5 Coder 32B (via OpenRouter)",
    size: "OpenRouter API",
    minVram: "0 GB (Cloud Gateway)",
    recommendedEngine: "cloud",
    category: "cloud",
    description: "Ultra-low cost high-intelligence coding model hosted in the cloud.",
    contextWindow: "32k",
    pullCommand: "Set OPENROUTER_API_KEY in .env, run /model openrouter/qwen/qwen-2.5-coder-32b-instruct",
  },
  {
    id: "openrouter/meta-llama/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B (via OpenRouter)",
    size: "OpenRouter API",
    minVram: "0 GB (Cloud Gateway)",
    recommendedEngine: "cloud",
    category: "cloud",
    description: "Meta's latest 70B model with GPT-4-class coding capability via OpenRouter.",
    contextWindow: "128k",
    pullCommand: "Set OPENROUTER_API_KEY in .env, run /model openrouter/meta-llama/llama-3.3-70b-instruct",
  },
];

/**
 * Searches the live Hugging Face Model Hub API for trending/popular coding models
 */
export async function searchOnlineModels(
  query: string = "coder",
  limit: number = 8
): Promise<OnlineModelResult[]> {
  const url = `https://huggingface.co/api/models?search=${encodeURIComponent(
    query
  )}&limit=${limit * 2}&sort=downloads&direction=-1`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "perCodingAgent/1.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];

    const data = ((await res.json()) as any[]) || [];
    return data
      .filter((m) => m.id && !m.id.includes("gguf") && !m.id.includes("onnx"))
      .slice(0, limit)
      .map((m) => ({
        id: m.id,
        downloads: m.downloads || 0,
        likes: m.likes || 0,
        lastModified: m.lastModified,
        engine: m.id.toLowerCase().includes("70b") || m.id.toLowerCase().includes("32b") ? "airllm" : "ollama",
      }));
  } catch {
    return [];
  }
}

/**
 * Pulls/downloads an Ollama model using Ollama's HTTP streaming pull API
 */
export async function pullOllamaModel(
  modelName: string,
  onProgress?: (status: string, percent?: number) => void
): Promise<{ success: boolean; message: string }> {
  const cleanName = modelName.replace(/^ollama\//, "");

  try {
    const res = await fetch("http://localhost:11434/api/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: cleanName, stream: true }),
    });

    if (!res.ok) {
      // Fallback: try spawnSync ollama pull if HTTP endpoint failed
      return pullOllamaCli(cleanName, onProgress);
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder("utf8");
    if (!reader) throw new Error("Ollama stream not readable");

    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          const status = chunk.status || "Downloading...";
          let percent: number | undefined;
          if (chunk.total && chunk.completed) {
            percent = Math.round((chunk.completed / chunk.total) * 100);
          }
          onProgress?.(status, percent);
        } catch {
          // ignore malformed JSON
        }
      }
    }

    return { success: true, message: `Successfully downloaded ${cleanName} to Ollama!` };
  } catch (err: any) {
    return pullOllamaCli(cleanName, onProgress);
  }
}

/**
 * Fallback CLI pull using `ollama pull <model>`
 */
function pullOllamaCli(
  modelName: string,
  onProgress?: (status: string) => void
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    onProgress?.(`Starting 'ollama pull ${modelName}' via shell...`);
    const proc = spawn("ollama", ["pull", modelName], { stdio: "inherit" });

    proc.on("error", (err) => {
      resolve({
        success: false,
        message: `Failed to execute 'ollama pull': ${err.message}. Is Ollama installed and in PATH?`,
      });
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true, message: `Successfully pulled ${modelName} via Ollama CLI!` });
      } else {
        resolve({ success: false, message: `Ollama pull exited with code ${code}.` });
      }
    });
  });
}

export interface OpenRouterModelInfo {
  id: string;
  name: string;
  contextLength: number;
  promptPrice: string;
  completionPrice: string;
}

/**
 * Searches the live OpenRouter models registry API
 */
export async function fetchOpenRouterModels(
  searchQuery?: string,
  limit: number = 8
): Promise<OpenRouterModelInfo[]> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "User-Agent": "perCodingAgent/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const json: any = await res.json();
    const data: any[] = json.data || [];

    let filtered = data;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = data.filter(
        (m) =>
          m.id.toLowerCase().includes(q) ||
          (m.name && m.name.toLowerCase().includes(q))
      );
    } else {
      filtered = data.filter(
        (m) =>
          m.id.includes("coder") ||
          m.id.includes("claude") ||
          m.id.includes("deepseek") ||
          m.id.includes("qwen")
      );
    }

    return filtered.slice(0, limit).map((m) => {
      const pPrice = m.pricing?.prompt ? `$${(parseFloat(m.pricing.prompt) * 1_000_000).toFixed(2)}/M` : "Free";
      const cPrice = m.pricing?.completion ? `$${(parseFloat(m.pricing.completion) * 1_000_000).toFixed(2)}/M` : "Free";
      return {
        id: `openrouter/${m.id}`,
        name: m.name || m.id,
        contextLength: m.context_length || 0,
        promptPrice: pPrice,
        completionPrice: cPrice,
      };
    });
  } catch {
    return [];
  }
}

