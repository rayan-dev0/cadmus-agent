import { spawnSync } from "node:child_process";

export interface LocalModel {
  name: string;
  sizeBytes?: number;
  parameterSize?: string; // e.g. "7B", "70B"
  modifiedAt?: string;
  source: "ollama" | "lmstudio" | "airllm" | "custom";
}

export interface LocalRuntimeStatus {
  ollama: {
    running: boolean;
    url: string;
    models: LocalModel[];
  };
  lmStudio: {
    running: boolean;
    url: string;
    models: LocalModel[];
  };
  airllm: {
    serverRunning: boolean;
    url: string;
    pythonAvailable: boolean;
    pythonPath?: string;
    airllmInstalled: boolean;
    recommendedModels: string[];
  };
}

export interface EngineRecommendation {
  recommendedEngine: "ollama" | "lmstudio" | "airllm";
  reason: string;
  isLargeModel: boolean;
}

/**
 * Probes an HTTP endpoint with a short timeout
 */
async function probeEndpoint(url: string, timeoutMs: number = 600): Promise<{ ok: boolean; data?: any }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
    });
    clearTimeout(timer);

    if (res.ok) {
      try {
        const data = await res.json();
        return { ok: true, data };
      } catch {
        return { ok: true };
      }
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

/**
 * Checks if Python and airllm package are installed
 */
export function checkPythonAndAirLLM(): { pythonAvailable: boolean; pythonPath?: string; airllmInstalled: boolean } {
  const candidates = ["python", "python3", "py"];
  let pythonPath: string | undefined;

  for (const cmd of candidates) {
    try {
      const res = spawnSync(cmd, ["--version"], { encoding: "utf8", stdio: "pipe" });
      if (res.status === 0 && res.stdout.toLowerCase().includes("python")) {
        pythonPath = cmd;
        break;
      }
    } catch {
      // not found
    }
  }

  if (!pythonPath) {
    return { pythonAvailable: false, airllmInstalled: false };
  }

  // Check if airllm package is importable
  try {
    const checkRes = spawnSync(pythonPath, ["-c", "import airllm; print('AIRLLM_OK')"], {
      encoding: "utf8",
      stdio: "pipe",
    });
    const airllmInstalled = checkRes.status === 0 && checkRes.stdout.includes("AIRLLM_OK");
    return {
      pythonAvailable: true,
      pythonPath,
      airllmInstalled,
    };
  } catch {
    return {
      pythonAvailable: true,
      pythonPath,
      airllmInstalled: false,
    };
  }
}

/**
 * Detects all active local LLM runtimes (Ollama, LM Studio, AirLLM server)
 */
export async function detectLocalRuntimes(): Promise<LocalRuntimeStatus> {
  const [ollamaProbe, lmStudioProbe, airllmProbe] = await Promise.all([
    probeEndpoint("http://localhost:11434/api/tags"),
    probeEndpoint("http://localhost:1234/v1/models"),
    probeEndpoint("http://localhost:8001/health"),
  ]);

  // Parse Ollama models
  const ollamaModels: LocalModel[] = [];
  if (ollamaProbe.ok && ollamaProbe.data?.models) {
    for (const m of ollamaProbe.data.models) {
      const match = m.name.match(/:(\d+b)/i);
      ollamaModels.push({
        name: m.name,
        sizeBytes: m.size,
        parameterSize: match ? match[1].toUpperCase() : undefined,
        modifiedAt: m.modified_at,
        source: "ollama",
      });
    }
  }

  // Parse LM Studio models
  const lmStudioModels: LocalModel[] = [];
  if (lmStudioProbe.ok && Array.isArray(lmStudioProbe.data?.data)) {
    for (const m of lmStudioProbe.data.data) {
      lmStudioModels.push({
        name: m.id,
        source: "lmstudio",
      });
    }
  }

  const pyInfo = checkPythonAndAirLLM();

  return {
    ollama: {
      running: ollamaProbe.ok,
      url: "http://localhost:11434",
      models: ollamaModels,
    },
    lmStudio: {
      running: lmStudioProbe.ok,
      url: "http://localhost:1234",
      models: lmStudioModels,
    },
    airllm: {
      serverRunning: airllmProbe.ok,
      url: "http://localhost:8001",
      pythonAvailable: pyInfo.pythonAvailable,
      pythonPath: pyInfo.pythonPath,
      airllmInstalled: pyInfo.airllmInstalled,
      recommendedModels: [
        "meta-llama/Meta-Llama-3-70B-Instruct",
        "Qwen/Qwen2.5-Coder-32B-Instruct",
        "deepseek-ai/deepseek-coder-33b-instruct",
        "mistralai/Mixtral-8x7B-Instruct-v0.1",
      ],
    },
  };
}

/**
 * Determines whether a model is a large model (>=30B parameters)
 */
export function isLargeModel(modelName: string): boolean {
  const lower = modelName.toLowerCase();
  // Check for 30B, 32B, 33B, 34B, 70B, 72B, 405B, 8x7B
  return (
    /3[0-4]b/.test(lower) ||
    /7[0-2]b/.test(lower) ||
    /405b/.test(lower) ||
    /8x7b/.test(lower) ||
    /8x22b/.test(lower)
  );
}

/**
 * Analyzes model name and recommends AirLLM vs standard Ollama/LM Studio
 */
export function recommendEngineForModel(modelName: string): EngineRecommendation {
  const isLarge = isLargeModel(modelName);

  if (isLarge) {
    return {
      recommendedEngine: "airllm",
      reason: `Model "${modelName}" is a large 30B-70B+ model. Standard Ollama/LM Studio will likely crash with CUDA Out-Of-Memory (OOM) on consumer GPUs (<48GB VRAM). AirLLM enables layer-wise VRAM swapping to run it smoothly on single 4GB/8GB GPUs.`,
      isLargeModel: true,
    };
  }

  return {
    recommendedEngine: "ollama",
    reason: `Model "${modelName}" is <=14B parameters. Standard Ollama or LM Studio is recommended for maximum generation speed (15-50+ tokens/sec) within 8GB-12GB VRAM.`,
    isLargeModel: false,
  };
}
