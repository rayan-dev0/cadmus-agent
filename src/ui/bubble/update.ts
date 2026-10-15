import { Msg, Cmd, Quit, KeyPressMsg, WindowSizeMsg } from "@oakoliver/bubbletea";
import { OpenCodeModel } from "./model.js";
import {
  TokenChunkMsg,
  TurnStartMsg,
  TurnFinishedMsg,
  TurnErrorMsg,
  ToolStartMsg,
  ToolCompleteMsg,
  DiffApprovalRequestMsg,
  ConfirmationRequestMsg,
  ToastMsg,
  ClearToastMsg,
} from "./messages.js";
import { filterSuggestions, SLASH_COMMANDS } from "../commandCatalog.js";
import { THEMES, setTheme } from "../themes.js";

function updateAutocomplete(model: OpenCodeModel): void {
  const suggestions = filterSuggestions(model.inputBuffer, model.workspaceRoot, model.dbPath);
  if (suggestions.length > 0) {
    model.suggestions = suggestions;
    model.isAutocompleteOpen = true;
    model.selectedSuggestionIndex = 0;
  } else {
    model.suggestions = [];
    model.isAutocompleteOpen = false;
    model.selectedSuggestionIndex = 0;
  }
}

export interface UpdateHandlers {
  onSubmitPrompt?: (prompt: string) => Cmd;
  onSlashCommand?: (cmd: string) => Cmd;
}

/**
 * Pure Elm update function for OpenCode Bubble Tea TUI
 */
export function updateOpenCode(
  msg: Msg,
  model: OpenCodeModel,
  handlers: UpdateHandlers = {}
): [OpenCodeModel, Cmd] {
  // 1. Terminal Window Resize
  if (msg instanceof WindowSizeMsg || msg?._tag === "WindowSizeMsg") {
    model.termWidth = msg.width;
    model.termHeight = msg.height;
    return [model, null];
  }

  // 2. LLM Token Streaming
  if (msg instanceof TokenChunkMsg || msg?._tag === "TokenChunkMsg") {
    const lastItem = model.history[model.history.length - 1];
    if (lastItem && lastItem.type === "assistant") {
      lastItem.text += msg.token;
      lastItem.isStreaming = true;
    } else {
      model.history.push({
        type: "assistant",
        text: msg.token,
        isStreaming: true,
      });
    }
    if (model.autoScroll) {
      model.viewportScrollOffset = 0;
    }
    return [model, null];
  }

  // 3. Turn Lifecycle
  if (msg instanceof TurnStartMsg || msg?._tag === "TurnStartMsg") {
    model.isStreaming = true;
    model.history.push({ type: "user", text: msg.prompt });
    model.history.push({ type: "assistant", text: "", isStreaming: true });
    model.viewportScrollOffset = 0;
    model.autoScroll = true;
    return [model, null];
  }

  if (msg instanceof TurnFinishedMsg || msg?._tag === "TurnFinishedMsg") {
    model.isStreaming = false;
    const lastItem = model.history[model.history.length - 1];
    if (lastItem && lastItem.type === "assistant") {
      lastItem.isStreaming = false;
      if (msg.reply) {
        lastItem.text = msg.reply;
      }
    }
    return [model, null];
  }

  if (msg instanceof TurnErrorMsg || msg?._tag === "TurnErrorMsg") {
    model.isStreaming = false;
    model.history.push({
      type: "system",
      text: `✗ Agent Error: ${msg.error}`,
    });
    return [model, null];
  }

  // 4. Tool Execution Events
  if (msg instanceof ToolStartMsg || msg?._tag === "ToolStartMsg") {
    model.history.push({
      type: "tool",
      options: {
        toolName: msg.toolName,
        arguments: msg.args,
        output: "Executing...",
        success: true,
      },
    });
    if (model.autoScroll) {
      model.viewportScrollOffset = 0;
    }
    return [model, null];
  }

  if (msg instanceof ToolCompleteMsg || msg?._tag === "ToolCompleteMsg") {
    // Find the matching tool in history or update last tool
    for (let i = model.history.length - 1; i >= 0; i--) {
      const item = model.history[i];
      if (item.type === "tool" && item.options.toolName === msg.toolName) {
        item.options.output = msg.output;
        item.options.success = msg.success;
        item.options.durationMs = msg.durationMs;
        break;
      }
    }
    return [model, null];
  }

  // 5. Diff Approval & Confirmations
  if (msg instanceof DiffApprovalRequestMsg || msg?._tag === "DiffApprovalRequestMsg") {
    model.activeModal = "DIFF_APPROVAL";
    model.modalState = msg.options;
    model.pendingDiffResolver = msg.resolve;
    return [model, null];
  }

  if (msg instanceof ConfirmationRequestMsg || msg?._tag === "ConfirmationRequestMsg") {
    model.activeModal = "CONFIRMATION";
    model.modalState = { prompt: msg.prompt };
    model.pendingConfirmResolver = msg.resolve;
    return [model, null];
  }

  // 6. Toasts
  if (msg instanceof ToastMsg || msg?._tag === "ToastMsg") {
    model.toast = {
      type: msg.type,
      title: msg.title,
      message: msg.message,
      createdAt: Date.now(),
    };
    return [model, null];
  }

  if (msg instanceof ClearToastMsg || msg?._tag === "ClearToastMsg") {
    model.toast = null;
    return [model, null];
  }

  // 7. Keyboard Input Events
  if (msg instanceof KeyPressMsg || msg?._tag === "KeyPressMsg" || msg?.key) {
    const keyStr = msg.toString ? msg.toString() : String(msg.text || "");

    // Global Quit: Ctrl+C
    if (keyStr === "ctrl+c") {
      if (model.activeModal) {
        model.activeModal = null;
        return [model, null];
      }
      return [model, Quit];
    }

    // Modal Routing
    if (model.activeModal) {
      return handleModalKey(keyStr, model);
    }

    // Command Palette & Leader Key triggers
    if (keyStr === "ctrl+p") {
      model.activeModal = "COMMAND_PALETTE";
      model.modalState = { query: "", selectedIndex: 0 };
      return [model, null];
    }

    if (keyStr === "ctrl+x") {
      model.activeModal = "LEADER_KEY";
      return [model, null];
    }

    // Viewport Scroll: PageUp / PageDown / Shift+Up / Shift+Down
    if (keyStr === "pgup" || keyStr === "shift+up") {
      model.viewportScrollOffset += 6;
      model.autoScroll = false;
      return [model, null];
    }

    if (keyStr === "pgdown" || keyStr === "shift+down") {
      model.viewportScrollOffset = Math.max(0, model.viewportScrollOffset - 6);
      if (model.viewportScrollOffset === 0) {
        model.autoScroll = true;
      }
      return [model, null];
    }

    // Autocomplete Navigation
    if (model.isAutocompleteOpen) {
      if (keyStr === "up") {
        model.selectedSuggestionIndex = Math.max(0, model.selectedSuggestionIndex - 1);
        return [model, null];
      }
      if (keyStr === "down") {
        model.selectedSuggestionIndex = Math.min(
          model.suggestions.length - 1,
          model.selectedSuggestionIndex + 1
        );
        return [model, null];
      }
      if (keyStr === "tab" || keyStr === "enter") {
        const selected = model.suggestions[model.selectedSuggestionIndex];
        if (selected) {
          applySuggestion(selected.name, model);
        }
        return [model, null];
      }
      if (keyStr === "esc") {
        model.isAutocompleteOpen = false;
        return [model, null];
      }
    }

    // Mode Toggle via Tab if buffer is empty
    if (keyStr === "tab" && !model.inputBuffer) {
      model.mode = model.mode === "BUILD" ? "PLAN" : "BUILD";
      model.toast = {
        type: "info",
        title: "Mode Switched",
        message: `Active mode: [${model.mode}]`,
        createdAt: Date.now(),
      };
      return [model, null];
    }

    // Prompt History Navigation via Up / Down
    if (keyStr === "up") {
      if (model.inputHistory.length > 0) {
        if (model.historyIndex === -1) {
          model.historyIndex = model.inputHistory.length - 1;
        } else if (model.historyIndex > 0) {
          model.historyIndex--;
        }
        model.inputBuffer = model.inputHistory[model.historyIndex] || "";
        model.cursorPos = model.inputBuffer.length;
        updateAutocomplete(model);
      }
      return [model, null];
    }

    if (keyStr === "down") {
      if (model.historyIndex >= 0) {
        if (model.historyIndex < model.inputHistory.length - 1) {
          model.historyIndex++;
          model.inputBuffer = model.inputHistory[model.historyIndex] || "";
        } else {
          model.historyIndex = -1;
          model.inputBuffer = "";
        }
        model.cursorPos = model.inputBuffer.length;
        updateAutocomplete(model);
      }
      return [model, null];
    }

    // Cursor Movement
    if (keyStr === "left") {
      model.cursorPos = Math.max(0, model.cursorPos - 1);
      return [model, null];
    }
    if (keyStr === "right") {
      model.cursorPos = Math.min(model.inputBuffer.length, model.cursorPos + 1);
      return [model, null];
    }
    if (keyStr === "home") {
      model.cursorPos = 0;
      return [model, null];
    }
    if (keyStr === "end") {
      model.cursorPos = model.inputBuffer.length;
      return [model, null];
    }

    // Character Deletion
    if (keyStr === "backspace") {
      if (model.cursorPos > 0) {
        model.inputBuffer =
          model.inputBuffer.slice(0, model.cursorPos - 1) +
          model.inputBuffer.slice(model.cursorPos);
        model.cursorPos--;
        updateAutocomplete(model);
      }
      return [model, null];
    }

    // Submission: Enter
    if (keyStr === "enter") {
      const submitted = model.inputBuffer.trim();
      model.inputBuffer = "";
      model.cursorPos = 0;
      model.isAutocompleteOpen = false;
      model.historyIndex = -1;

      if (!submitted) {
        return [model, null];
      }

      model.inputHistory.push(submitted);

      // Slash command check
      if (submitted.startsWith("/")) {
        if (submitted === "/exit" || submitted === "/quit") {
          return [model, Quit];
        }
        if (submitted === "/theme") {
          model.activeModal = "THEME_PICKER";
          model.modalState = { selectedIndex: 0 };
          return [model, null];
        }
        if (submitted === "/sessions") {
          model.activeModal = "SESSION_SWITCHER";
          model.modalState = { selectedIndex: 0 };
          return [model, null];
        }
        if (submitted === "/mode") {
          model.mode = model.mode === "BUILD" ? "PLAN" : "BUILD";
          return [model, null];
        }
        if (handlers.onSlashCommand) {
          const cmd = handlers.onSlashCommand(submitted);
          return [model, cmd];
        }
        return [model, null];
      }

      // Normal prompt submission
      if (handlers.onSubmitPrompt) {
        const cmd = handlers.onSubmitPrompt(submitted);
        return [model, cmd];
      }

      return [model, null];
    }

    // Printable character insertion
    if (keyStr.length === 1 && !keyStr.startsWith("ctrl+")) {
      model.inputBuffer =
        model.inputBuffer.slice(0, model.cursorPos) +
        keyStr +
        model.inputBuffer.slice(model.cursorPos);
      model.cursorPos++;
      updateAutocomplete(model);
      return [model, null];
    }
  }

  return [model, null];
}

/**
 * Applies completed suggestion into the input buffer
 */
function applySuggestion(suggestion: string, model: OpenCodeModel): void {
  const atMatch = model.inputBuffer.match(/@([a-zA-Z0-9_\-\.\/]*)$/);
  if (atMatch) {
    const startIdx = model.inputBuffer.lastIndexOf("@");
    model.inputBuffer = model.inputBuffer.slice(0, startIdx) + `${suggestion} `;
  } else if (model.inputBuffer.startsWith("/")) {
    model.inputBuffer = `${suggestion} `;
  } else {
    model.inputBuffer = `${suggestion} `;
  }
  model.cursorPos = model.inputBuffer.length;
  model.isAutocompleteOpen = false;
}

/**
 * Handles keystrokes for active OpenCode modals
 */
function handleModalKey(keyStr: string, model: OpenCodeModel): [OpenCodeModel, Cmd] {
  if (keyStr === "esc") {
    if (model.activeModal === "DIFF_APPROVAL") {
      model.pendingDiffResolver?.("reject");
    } else if (model.activeModal === "CONFIRMATION") {
      model.pendingConfirmResolver?.(false);
    }
    model.activeModal = null;
    return [model, null];
  }

  // 1. Diff Approval Modal
  if (model.activeModal === "DIFF_APPROVAL") {
    if (keyStr === "a" || keyStr === "enter") {
      model.pendingDiffResolver?.("accept");
      model.activeModal = null;
      return [model, null];
    }
    if (keyStr === "r") {
      model.pendingDiffResolver?.("reject");
      model.activeModal = null;
      return [model, null];
    }
    if (keyStr === "y") {
      model.pendingDiffResolver?.("always");
      model.activeModal = null;
      return [model, null];
    }
    return [model, null];
  }

  // 2. Confirmation Modal
  if (model.activeModal === "CONFIRMATION") {
    if (keyStr === "y" || keyStr === "enter") {
      model.pendingConfirmResolver?.(true);
      model.activeModal = null;
      return [model, null];
    }
    if (keyStr === "n") {
      model.pendingConfirmResolver?.(false);
      model.activeModal = null;
      return [model, null];
    }
    return [model, null];
  }

  // 3. Command Palette (Ctrl+P)
  if (model.activeModal === "COMMAND_PALETTE") {
    const state = model.modalState || { query: "", selectedIndex: 0 };
    const filtered = SLASH_COMMANDS.filter((cmd) =>
      cmd.name.toLowerCase().includes(state.query.toLowerCase()) ||
      cmd.description.toLowerCase().includes(state.query.toLowerCase())
    ).slice(0, 7);

    if (keyStr === "up") {
      state.selectedIndex = Math.max(0, state.selectedIndex - 1);
      return [model, null];
    }
    if (keyStr === "down") {
      state.selectedIndex = Math.min(filtered.length - 1, state.selectedIndex + 1);
      return [model, null];
    }
    if (keyStr === "enter") {
      const selected = filtered[state.selectedIndex];
      model.activeModal = null;
      if (selected) {
        model.inputBuffer = `${selected.name} `;
        model.cursorPos = model.inputBuffer.length;
      }
      return [model, null];
    }
    if (keyStr === "backspace") {
      state.query = state.query.slice(0, -1);
      state.selectedIndex = 0;
      return [model, null];
    }
    if (keyStr.length === 1 && !keyStr.startsWith("ctrl+")) {
      state.query += keyStr;
      state.selectedIndex = 0;
      return [model, null];
    }
    return [model, null];
  }

  // 4. Leader Key (Ctrl+X)
  if (model.activeModal === "LEADER_KEY") {
    model.activeModal = null;
    if (keyStr === "n") {
      model.history = [
        { type: "system", text: "✓ Started fresh conversation session (/clear)" },
      ];
      return [model, null];
    }
    if (keyStr === "l") {
      model.activeModal = "SESSION_SWITCHER";
      model.modalState = { selectedIndex: 0 };
      return [model, null];
    }
    if (keyStr === "t") {
      model.activeModal = "THEME_PICKER";
      model.modalState = { selectedIndex: 0 };
      return [model, null];
    }
    if (keyStr === "d") {
      model.showDetails = !model.showDetails;
      model.toast = {
        type: "info",
        title: "Details View",
        message: model.showDetails ? "Expanded tool details enabled" : "Compact tool details enabled",
        createdAt: Date.now(),
      };
      return [model, null];
    }
    if (keyStr === "q") {
      return [model, Quit];
    }
    return [model, null];
  }

  // 5. Theme Picker (Ctrl+X t / /theme)
  if (model.activeModal === "THEME_PICKER") {
    const themeKeys = Object.keys(THEMES);
    const state = model.modalState || { selectedIndex: 0 };

    if (keyStr === "up") {
      state.selectedIndex = Math.max(0, state.selectedIndex - 1);
      return [model, null];
    }
    if (keyStr === "down") {
      state.selectedIndex = Math.min(themeKeys.length - 1, state.selectedIndex + 1);
      return [model, null];
    }
    if (keyStr === "enter") {
      const selectedKey = themeKeys[state.selectedIndex];
      if (selectedKey && THEMES[selectedKey]) {
        model.theme = THEMES[selectedKey];
        setTheme(selectedKey, model.workspaceRoot);
        model.toast = {
          type: "success",
          title: "Theme Applied",
          message: `Switched theme to ${THEMES[selectedKey].displayName}`,
          createdAt: Date.now(),
        };
      }
      model.activeModal = null;
      return [model, null];
    }
    return [model, null];
  }

  // 6. Session Switcher (Ctrl+X l / /sessions)
  if (model.activeModal === "SESSION_SWITCHER") {
    const state = model.modalState || { selectedIndex: 0 };
    const maxIndex = model.sessions.length;

    if (keyStr === "up") {
      state.selectedIndex = Math.max(0, state.selectedIndex - 1);
      return [model, null];
    }
    if (keyStr === "down") {
      state.selectedIndex = Math.min(maxIndex, state.selectedIndex + 1);
      return [model, null];
    }
    if (keyStr === "n") {
      // New session
      const newId = `session-${Date.now().toString(36)}`;
      model.sessions.push({
        id: newId,
        title: `Session ${model.sessions.length + 1}`,
        isActive: true,
      });
      model.sessions.forEach((s) => (s.isActive = s.id === newId));
      model.activeSessionId = newId;
      model.history = [
        { type: "system", text: `✓ Switched to fresh Session ${model.sessions.length}` },
      ];
      model.activeModal = null;
      return [model, null];
    }
    if (keyStr === "enter") {
      if (state.selectedIndex === maxIndex) {
        // "+ Start New" selected
        const newId = `session-${Date.now().toString(36)}`;
        model.sessions.push({
          id: newId,
          title: `Session ${model.sessions.length + 1}`,
          isActive: true,
        });
        model.sessions.forEach((s) => (s.isActive = s.id === newId));
        model.activeSessionId = newId;
        model.history = [
          { type: "system", text: `✓ Switched to fresh Session ${model.sessions.length}` },
        ];
      } else {
        const target = model.sessions[state.selectedIndex];
        if (target) {
          model.sessions.forEach((s) => (s.isActive = s.id === target.id));
          model.activeSessionId = target.id;
        }
      }
      model.activeModal = null;
      return [model, null];
    }
    return [model, null];
  }

  return [model, null];
}
