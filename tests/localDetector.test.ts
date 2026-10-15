import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isLargeModel,
  recommendEngineForModel,
  detectLocalRuntimes,
  checkPythonAndAirLLM,
} from "../src/llm/localDetector.js";
import { getAirLLMInstallGuide } from "../src/llm/airllmManager.js";

test("isLargeModel identifies 30B+ and 70B+ parameter models", () => {
  // Small models
  assert.equal(isLargeModel("llama3:8b"), false);
  assert.equal(isLargeModel("qwen2.5-coder:7b"), false);
  assert.equal(isLargeModel("deepseek-coder:6.7b"), false);
  assert.equal(isLargeModel("mistral:7b"), false);

  // Large models that need layer-wise swapping (AirLLM) on consumer GPUs
  assert.equal(isLargeModel("llama3:70b"), true);
  assert.equal(isLargeModel("qwen2.5-coder:32b"), true);
  assert.equal(isLargeModel("deepseek-coder:33b"), true);
  assert.equal(isLargeModel("mixtral:8x7b"), true);
  assert.equal(isLargeModel("llama3.1:405b"), true);
});

test("recommendEngineForModel suggests AirLLM for 70B models and Ollama for smaller models", () => {
  const rec70b = recommendEngineForModel("Meta-Llama-3-70B-Instruct");
  assert.equal(rec70b.recommendedEngine, "airllm");
  assert.equal(rec70b.isLargeModel, true);
  assert.ok(rec70b.reason.includes("AirLLM"));

  const rec7b = recommendEngineForModel("qwen2.5-coder:7b");
  assert.equal(rec7b.recommendedEngine, "ollama");
  assert.equal(rec7b.isLargeModel, false);
  assert.ok(rec7b.reason.includes("Ollama"));
});

test("detectLocalRuntimes executes gracefully without throwing when endpoints offline", async () => {
  const status = await detectLocalRuntimes();
  assert.ok(typeof status.ollama.running === "boolean");
  assert.ok(typeof status.lmStudio.running === "boolean");
  assert.ok(typeof status.airllm.serverRunning === "boolean");
  assert.ok(Array.isArray(status.airllm.recommendedModels));
  assert.ok(status.airllm.recommendedModels.length > 0);
});

test("checkPythonAndAirLLM inspects python availability", () => {
  const info = checkPythonAndAirLLM();
  assert.ok(typeof info.pythonAvailable === "boolean");
  assert.ok(typeof info.airllmInstalled === "boolean");
});

test("getAirLLMInstallGuide provides actionable pip instructions", () => {
  const guide = getAirLLMInstallGuide(false);
  assert.ok(guide.includes("pip install airllm"));
  assert.ok(guide.includes("python scripts/airllm_server.py"));
});
