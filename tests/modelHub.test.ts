import { test } from "node:test";
import assert from "node:assert/strict";
import { CURATED_MODELS, searchOnlineModels, pullOllamaModel } from "../src/llm/modelHub.js";

test("CURATED_MODELS contains all 3 tiers with required metadata", () => {
  assert.ok(CURATED_MODELS.length >= 8);

  const categories = new Set(CURATED_MODELS.map((m) => m.category));
  assert.ok(categories.has("fast-local"));
  assert.ok(categories.has("heavyweight-airllm"));
  assert.ok(categories.has("cloud"));

  for (const m of CURATED_MODELS) {
    assert.ok(m.id.length > 0);
    assert.ok(m.name.length > 0);
    assert.ok(m.size.length > 0);
    assert.ok(m.minVram.length > 0);
    assert.ok(m.pullCommand.length > 0);
  }
});

test("searchOnlineModels queries Hugging Face API cleanly", async () => {
  const results = await searchOnlineModels("qwen coder", 3);
  assert.ok(Array.isArray(results));
  if (results.length > 0) {
    assert.ok(results[0].id.length > 0);
    assert.ok(typeof results[0].downloads === "number");
    assert.ok(["airllm", "ollama"].includes(results[0].engine));
  }
});

test("pullOllamaModel handles offline gracefully", async () => {
  const res = await pullOllamaModel("dummy-test-model:latest");
  assert.ok(typeof res.success === "boolean");
  assert.ok(typeof res.message === "string");
});
