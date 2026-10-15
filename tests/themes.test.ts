import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { THEMES, getTheme, setTheme, getCurrentTheme, loadThemePreference } from "../src/ui/themes.js";

const TEST_DIR = path.resolve("./.test-themes-sandbox");

test.before(() => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
});

test.after(() => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

test("Themes: All 8 OpenCode themes are registered with complete color palettes", () => {
  const expectedThemes = [
    "tokyonight",
    "catppuccin",
    "nord",
    "gruvbox",
    "everforest",
    "one-dark",
    "matrix",
    "system",
  ];

  for (const name of expectedThemes) {
    const theme = THEMES[name];
    assert.ok(theme, `Theme ${name} should be registered`);
    assert.ok(theme.primary, `Theme ${name} should have primary color`);
    assert.ok(theme.secondary, `Theme ${name} should have secondary color`);
    assert.ok(theme.border, `Theme ${name} should have border color`);
    assert.ok(theme.success, `Theme ${name} should have success color`);
    assert.ok(theme.error, `Theme ${name} should have error color`);
  }
});

test("Themes: Switch and persist theme preference to .agent/tui.json", () => {
  const active = setTheme("catppuccin", TEST_DIR);
  assert.equal(active.name, "catppuccin");
  assert.equal(getCurrentTheme().name, "catppuccin");

  const configPath = path.join(TEST_DIR, ".agent", "tui.json");
  assert.ok(fs.existsSync(configPath));
  const saved = JSON.parse(fs.readFileSync(configPath, "utf8"));
  assert.equal(saved.theme, "catppuccin");

  // Load preference back
  const loaded = loadThemePreference(TEST_DIR);
  assert.equal(loaded, "catppuccin");

  // Switch back to tokyonight
  setTheme("tokyonight", TEST_DIR);
  assert.equal(getCurrentTheme().name, "tokyonight");
});
