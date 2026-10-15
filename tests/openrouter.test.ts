import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchOpenRouterModels, CURATED_MODELS } from "../src/llm/modelHub.js";
import { LLMProvider } from "../src/llm/provider.js";
import { AgentConfig } from "../config.js";

test("CURATED_MODELS includes top OpenRouter models", () => {
  const openrouterModels = CURATED_MODELS.filter((m) => m.id.startsWith("openrouter/"));
  assert.ok(openrouterModels.length >= 4);

  const deepseekR1 = openrouterModels.find((m) => m.id.includes("deepseek-r1"));
  assert.ok(deepseekR1);
  assert.equal(deepseekR1.recommendedEngine, "cloud");

  const claude37 = openrouterModels.find((m) => m.id.includes("claude-3.7-sonnet"));
  assert.ok(claude37);
});

test("fetchOpenRouterModels queries OpenRouter live API", async () => {
  const models = await fetchOpenRouterModels("deepseek", 4);
  assert.ok(Array.isArray(models));
  if (models.length > 0) {
    assert.ok(models[0].id.startsWith("openrouter/"));
    assert.ok(models[0].name.length > 0);
    assert.ok(typeof models[0].contextLength === "number");
    assert.ok(typeof models[0].promptPrice === "string");
  }
});

test("LLMProvider validates missing OPENROUTER_API_KEY", async () => {
  const config: AgentConfig = {
    workspaceRoot: ".",
    dbPath: ".agent/agent.db",
    defaultModel: "openrouter/deepseek/deepseek-r1",
    openrouterApiKey: undefined,
    embeddingProvider: "none",
    embeddingModel: "text-embedding-3-small",
    autoApproveReadOnly: true,
  };

  const provider = new LLMProvider(config);
  await assert.rejects(
    async () => {
      await provider.chat([{ role: "user", content: "hello" }], []);
    },
    (err: any) => err.message.includes("OPENROUTER_API_KEY")
  );
});
