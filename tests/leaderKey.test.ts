import test from "node:test";
import assert from "node:assert/strict";
import { LeaderKeyManager } from "../src/ui/leaderKey.js";
import readline from "node:readline";

test("LeaderKeyManager: Ctrl+X activates leader key mode", () => {
  const manager = new LeaderKeyManager();
  assert.equal(manager.isActive, false);

  const ctrlXKey: readline.Key = {
    sequence: "\x18",
    name: "x",
    ctrl: true,
    meta: false,
    shift: false,
  };

  const result = manager.handleKey(ctrlXKey);
  assert.equal(result.handled, true);
  assert.equal(manager.isActive, true);
  assert.ok(result.statusText?.includes("LEADER"));

  manager.cancelLeader();
  assert.equal(manager.isActive, false);
});

test("LeaderKeyManager: Follow-up key maps to correct action", () => {
  const manager = new LeaderKeyManager();

  const ctrlXKey: readline.Key = {
    sequence: "\x18",
    name: "x",
    ctrl: true,
    meta: false,
    shift: false,
  };

  // 1. Test 'u' for undo
  manager.handleKey(ctrlXKey);
  const uKey: readline.Key = {
    sequence: "u",
    name: "u",
    ctrl: false,
    meta: false,
    shift: false,
  };
  const undoResult = manager.handleKey(uKey);
  assert.equal(undoResult.handled, true);
  assert.equal(undoResult.action, "undo_turn");
  assert.equal(manager.isActive, false);

  // 2. Test 'l' for sessions list
  manager.handleKey(ctrlXKey);
  const lKey: readline.Key = {
    sequence: "l",
    name: "l",
    ctrl: false,
    meta: false,
    shift: false,
  };
  const listResult = manager.handleKey(lKey);
  assert.equal(listResult.handled, true);
  assert.equal(listResult.action, "list_sessions");

  // 3. Test 'd' for details toggle
  manager.handleKey(ctrlXKey);
  const dKey: readline.Key = {
    sequence: "d",
    name: "d",
    ctrl: false,
    meta: false,
    shift: false,
  };
  const detailsResult = manager.handleKey(dKey);
  assert.equal(detailsResult.handled, true);
  assert.equal(detailsResult.action, "toggle_details");
});

test("LeaderKeyManager: Escape dismisses leader mode", () => {
  const manager = new LeaderKeyManager();

  manager.handleKey({
    sequence: "\x18",
    name: "x",
    ctrl: true,
    meta: false,
    shift: false,
  });
  assert.equal(manager.isActive, true);

  const escResult = manager.handleKey({
    sequence: "\x1b",
    name: "escape",
    ctrl: false,
    meta: false,
    shift: false,
  });

  assert.equal(escResult.handled, true);
  assert.equal(manager.isActive, false);
});

test("LeaderKeyManager: Ctrl+P opens command palette directly", () => {
  const manager = new LeaderKeyManager();

  const ctrlPKey: readline.Key = {
    sequence: "\x10",
    name: "p",
    ctrl: true,
    meta: false,
    shift: false,
  };

  const result = manager.handleKey(ctrlPKey);
  assert.equal(result.handled, true);
  assert.equal(result.action, "command_palette");
  assert.equal(manager.isActive, false);
});
