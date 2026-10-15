import readline from "node:readline";
import chalk from "chalk";
import boxen from "boxen";
import { filterSuggestions, CommandItem } from "./commandCatalog.js";
import { LeaderKeyManager, runCommandPalette } from "./leaderKey.js";
import { getCurrentTheme } from "./themes.js";

export interface AutocompletePromptOptions {
  promptLabel: string;
  fallbackReadline?: { question: (query: string) => Promise<string> };
  maxDropdownItems?: number;
  workspaceRoot?: string;
  dbPath?: string;
}

const stripAnsi = (str: string): string =>
  str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");

/**
 * Interactive prompt with real-time slash-command and attachment autocomplete popover
 * plus Leader Key (Ctrl+X) and Command Palette (Ctrl+P) support
 */
export async function promptWithAutocomplete(
  options: AutocompletePromptOptions
): Promise<string> {
  const { promptLabel, fallbackReadline, maxDropdownItems = 7, workspaceRoot, dbPath } = options;

  // Fallback for non-interactive / CI / piped stdin environments
  if (!process.stdin.isTTY) {
    if (fallbackReadline) {
      return fallbackReadline.question(promptLabel);
    }
    return new Promise<string>((resolve) => {
      let buf = "";
      const onData = (chunk: Buffer) => {
        buf += chunk.toString("utf8");
        if (buf.includes("\n")) {
          process.stdin.off("data", onData);
          resolve(buf.split("\n")[0].trim());
        }
      };
      process.stdin.on("data", onData);
    });
  }

  return new Promise<string>((resolve) => {
    let inputBuffer = "";
    let cursorPos = 0;
    let selectedIndex = 0;
    let isDropdownOpen = false;
    let renderedLines = 0; // Tracks lines rendered below prompt for clearing
    let leaderStatusText: string | null = null;

    const leaderManager = new LeaderKeyManager();
    const promptWidth = stripAnsi(promptLabel).length;
    const theme = getCurrentTheme();

    // Enable raw mode and keypress events
    process.stdin.setRawMode(true);
    process.stdin.resume();
    readline.emitKeypressEvents(process.stdin);

    const cleanup = () => {
      leaderManager.cancelLeader();
      if (renderedLines > 0) {
        readline.moveCursor(process.stdout, 0, 1);
        readline.clearScreenDown(process.stdout);
        readline.moveCursor(process.stdout, 0, -1);
      }
      process.stdin.removeListener("keypress", onKeypress);
      try {
        process.stdin.setRawMode(false);
      } catch {
        // Ignore if already reset
      }
    };

    const render = () => {
      // 1. Move cursor back up to the prompt line if previous dropdown was drawn
      if (renderedLines > 0) {
        readline.moveCursor(process.stdout, 0, 1);
        readline.clearScreenDown(process.stdout);
        readline.moveCursor(process.stdout, 0, -1);
        renderedLines = 0;
      }

      // 2. Clear prompt line and print current label + buffer
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);
      process.stdout.write(`${promptLabel}${inputBuffer}`);

      // If Leader Key is active, show hint below prompt
      if (leaderStatusText) {
        process.stdout.write("\n" + leaderStatusText);
        renderedLines = 1;
        readline.moveCursor(process.stdout, 0, -1);
        readline.cursorTo(process.stdout, promptWidth + cursorPos);
        return;
      }

      // 3. Compute suggestions
      const suggestions: CommandItem[] = isDropdownOpen
        ? filterSuggestions(inputBuffer, workspaceRoot, dbPath)
        : [];

      if (suggestions.length === 0) {
        readline.cursorTo(process.stdout, promptWidth + cursorPos);
        return;
      }

      // Bound selectedIndex
      if (selectedIndex >= suggestions.length) {
        selectedIndex = suggestions.length - 1;
      }
      if (selectedIndex < 0) {
        selectedIndex = 0;
      }

      // Sliding window
      const windowStart = Math.max(
        0,
        Math.min(
          selectedIndex - Math.floor(maxDropdownItems / 2),
          suggestions.length - maxDropdownItems
        )
      );
      const visibleItems = suggestions.slice(
        windowStart,
        windowStart + maxDropdownItems
      );

      // 4. Format dropdown box content
      const isAttachment = inputBuffer.includes("@");
      const title = isAttachment
        ? chalk.bold.yellow(" 📎 Context Attachments ")
        : chalk.bold.hex(theme.primary)(" ⚡ Slash Commands ");

      const itemLines = visibleItems.map((item, idx) => {
        const actualIdx = windowStart + idx;
        const isSelected = actualIdx === selectedIndex;

        const nameCol = item.name.padEnd(20, " ");
        if (isSelected) {
          return `${chalk.bgHex(theme.badgeBg).hex(theme.badgeFg).bold(` > ${nameCol} `)} ${chalk.bold.white(item.description)}`;
        }
        return `   ${chalk.hex(theme.primary)(nameCol)} ${chalk.dim(item.description)}`;
      });

      const footer = chalk.dim(
        "[↑/↓: navigate • Tab: complete • Enter: select • Esc: dismiss]"
      );
      const boxBody = `${itemLines.join("\n")}\n\n${footer}`;

      const dropdownBox = boxen(boxBody, {
        title,
        titleAlignment: "left",
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        margin: { top: 0, bottom: 0, left: 2, right: 0 },
        borderStyle: "round",
        borderColor: isAttachment ? "yellow" : (theme.primary as any),
      });

      // 5. Print dropdown below prompt
      const dropdownLines = dropdownBox.split("\n");
      renderedLines = dropdownLines.length;

      process.stdout.write("\n" + dropdownBox);

      // 6. Return cursor back to prompt editing position
      readline.moveCursor(process.stdout, 0, -renderedLines);
      readline.cursorTo(process.stdout, promptWidth + cursorPos);
    };

    const onKeypress = (str: string, key: readline.Key) => {
      if (!key) return;

      // Check Leader Key (Ctrl+X) or Command Palette (Ctrl+P)
      const leaderResult = leaderManager.handleKey(key, () => {
        leaderStatusText = null;
        render();
      });

      if (leaderResult.handled) {
        if (leaderResult.action === "command_palette") {
          cleanup();
          process.stdout.write("\n");
          runCommandPalette().then((cmd) => {
            resolve(cmd || "");
          });
          return;
        }

        if (leaderResult.action) {
          cleanup();
          process.stdout.write("\n");
          const actionMap: Record<string, string> = {
            new_session: "/clear",
            list_sessions: "/sessions",
            switch_model: "/models",
            compact_history: "/compact",
            undo_turn: "/undo",
            toggle_details: "/details",
            switch_theme: "/theme",
            show_help: "/help",
            exit_agent: "/exit",
          };
          resolve(actionMap[leaderResult.action] || "");
          return;
        }

        leaderStatusText = leaderResult.statusText || null;
        render();
        return;
      }

      // Clear any temporary leader prompt if another key handled
      leaderStatusText = null;

      // Handle Ctrl+C
      if (key.ctrl && key.name === "c") {
        cleanup();
        process.stdout.write("\n");
        process.exit(0);
      }

      // Handle Ctrl+D
      if (key.ctrl && key.name === "d") {
        if (inputBuffer.length === 0) {
          cleanup();
          process.stdout.write("\n");
          resolve("/exit");
          return;
        }
      }

      const suggestions = isDropdownOpen
        ? filterSuggestions(inputBuffer, workspaceRoot, dbPath)
        : [];

      // Up arrow
      if (key.name === "up") {
        if (isDropdownOpen && suggestions.length > 0) {
          selectedIndex = (selectedIndex - 1 + suggestions.length) % suggestions.length;
          render();
          return;
        }
      }

      // Down arrow
      if (key.name === "down") {
        if (isDropdownOpen && suggestions.length > 0) {
          selectedIndex = (selectedIndex + 1) % suggestions.length;
          render();
          return;
        }
      }

      // Escape - dismiss popover
      if (key.name === "escape") {
        if (isDropdownOpen) {
          isDropdownOpen = false;
          render();
          return;
        }
      }

      // Tab - autocomplete selected item or toggle mode if empty
      if (key.name === "tab") {
        if (isDropdownOpen && suggestions.length > 0) {
          const selected = suggestions[selectedIndex];
          if (inputBuffer.startsWith("/")) {
            inputBuffer = selected.name + (selected.requiresArgs ? " " : "");
          } else if (inputBuffer.includes("@")) {
            inputBuffer = inputBuffer.replace(/@[a-zA-Z0-9_\-\.\/]*$/, `${selected.name} `);
          }
          cursorPos = inputBuffer.length;
          if (!selected.requiresArgs) {
            isDropdownOpen = false;
          }
          render();
          return;
        } else if (inputBuffer.trim() === "") {
          // Tab on empty input toggles mode
          cleanup();
          process.stdout.write("\n");
          resolve("/mode");
          return;
        }
      }

      // Enter / Return
      if (key.name === "return") {
        if (isDropdownOpen && suggestions.length > 0) {
          const selected = suggestions[selectedIndex];

          if (selected.requiresArgs) {
            if (inputBuffer.startsWith("/")) {
              inputBuffer = `${selected.name} `;
            } else if (inputBuffer.includes("@")) {
              inputBuffer = inputBuffer.replace(/@[a-zA-Z0-9_\-\.\/]*$/, `${selected.name} `);
            }
            cursorPos = inputBuffer.length;
            isDropdownOpen = false;
            render();
            return;
          }

          cleanup();
          process.stdout.write("\n");
          resolve(selected.name);
          return;
        }

        cleanup();
        process.stdout.write("\n");
        resolve(inputBuffer);
        return;
      }

      // Backspace
      if (key.name === "backspace") {
        if (cursorPos > 0) {
          inputBuffer = inputBuffer.slice(0, cursorPos - 1) + inputBuffer.slice(cursorPos);
          cursorPos--;
          if (inputBuffer.startsWith("/") || inputBuffer.includes("@")) {
            isDropdownOpen = true;
          } else {
            isDropdownOpen = false;
          }
          render();
        }
        return;
      }

      // Left arrow
      if (key.name === "left") {
        if (cursorPos > 0) {
          cursorPos--;
          readline.cursorTo(process.stdout, promptWidth + cursorPos);
        }
        return;
      }

      // Right arrow
      if (key.name === "right") {
        if (cursorPos < inputBuffer.length) {
          cursorPos++;
          readline.cursorTo(process.stdout, promptWidth + cursorPos);
        }
        return;
      }

      // Normal printable characters
      if (str && !key.ctrl && !key.meta) {
        inputBuffer = inputBuffer.slice(0, cursorPos) + str + inputBuffer.slice(cursorPos);
        cursorPos += str.length;

        if (inputBuffer.startsWith("/") || inputBuffer.includes("@")) {
          isDropdownOpen = true;
          selectedIndex = 0;
        }

        render();
        return;
      }
    };

    process.stdin.on("keypress", onKeypress);

    render();
  });
}
