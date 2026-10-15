import { test } from "node:test";
import assert from "node:assert/strict";
import { filterSuggestions, SLASH_COMMANDS, ATTACHMENTS } from "../src/ui/commandCatalog.js";

test("Autocomplete: Typing '/' returns all available slash commands", () => {
  const suggestions = filterSuggestions("/");
  assert.equal(suggestions.length, SLASH_COMMANDS.length);
  assert.ok(suggestions.length >= 14);

  const names = suggestions.map((s) => s.name);
  assert.ok(names.includes("/mode"));
  assert.ok(names.includes("/compact"));
  assert.ok(names.includes("/connect"));
  assert.ok(names.includes("/models"));
  assert.ok(names.includes("/pull"));
  assert.ok(names.includes("/local"));
  assert.ok(names.includes("/model"));
  assert.ok(names.includes("/index"));
  assert.ok(names.includes("/status"));
  assert.ok(names.includes("/clear"));
  assert.ok(names.includes("/help"));
  assert.ok(names.includes("/exit"));
});

test("Autocomplete: Typing '/co' filters to /compact and /connect", () => {
  const suggestions = filterSuggestions("/co");
  const names = suggestions.map((s) => s.name);

  assert.ok(names.includes("/compact"));
  assert.ok(names.includes("/connect"));
  assert.ok(!names.includes("/help"));
  assert.ok(!names.includes("/status"));
});

test("Autocomplete: Typing '/m' filters to mode and model commands", () => {
  const suggestions = filterSuggestions("/m");
  const names = suggestions.map((s) => s.name);

  assert.ok(names.includes("/mode"));
  assert.ok(names.includes("/models"));
  assert.ok(names.includes("/model"));
  assert.ok(!names.includes("/status"));
});

test("Autocomplete: Typing '@' returns all 5 context attachment options", () => {
  const suggestions = filterSuggestions("Check @");
  assert.equal(suggestions.length, ATTACHMENTS.length);

  const names = suggestions.map((s) => s.name);
  assert.ok(names.includes("@file"));
  assert.ok(names.includes("@folder"));
  assert.ok(names.includes("@git"));
  assert.ok(names.includes("@web"));
  assert.ok(names.includes("@search"));
});

test("Autocomplete: Typing '@f' filters to @file and @folder", () => {
  const suggestions = filterSuggestions("Inspect @f");
  const names = suggestions.map((s) => s.name);

  assert.deepEqual(names.sort(), ["@file", "@folder"]);
});

test("Autocomplete: Normal prompt returns no suggestions", () => {
  const suggestions = filterSuggestions("How do I implement binary search?");
  assert.equal(suggestions.length, 0);
});

test("Autocomplete: Command argument requirements are accurately tagged", () => {
  const zeroArgCommands = ["/mode", "/compact", "/connect", "/clear", "/status", "/index", "/local", "/help", "/exit"];
  for (const cmdName of zeroArgCommands) {
    const cmd = SLASH_COMMANDS.find((c) => c.name === cmdName);
    assert.ok(cmd, `Command ${cmdName} should exist`);
    assert.equal(cmd?.requiresArgs, false, `${cmdName} should not require args`);
  }

  const argCommands = ["/model", "/pull", "/models search"];
  for (const cmdName of argCommands) {
    const cmd = SLASH_COMMANDS.find((c) => c.name === cmdName);
    assert.ok(cmd, `Command ${cmdName} should exist`);
    assert.equal(cmd?.requiresArgs, true, `${cmdName} should require args`);
  }
});

test("Autocomplete: Dynamic workspace file completion when workspaceRoot is provided", () => {
  const suggestions = filterSuggestions("Check @config", process.cwd());
  const names = suggestions.map((s) => s.name);
  assert.ok(names.some((n) => n.includes("config.ts")));
});

