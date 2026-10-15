import { ThemeColors, getCurrentTheme } from "../themes.js";
import { CommandItem } from "../commandCatalog.js";
import { ToolCardOptions } from "../toolCards.js";
import { SessionTabInfo } from "../sessionTabs.js";

export type ModalType =
  | null
  | "DIFF_APPROVAL"
  | "CONFIRMATION"
  | "COMMAND_PALETTE"
  | "LEADER_KEY"
  | "THEME_PICKER"
  | "SESSION_SWITCHER";

export type HistoryItem =
  | { type: "user"; text: string }
  | { type: "assistant"; text: string; isStreaming?: boolean }
  | { type: "tool"; options: ToolCardOptions }
  | { type: "system"; text: string };

export interface OpenCodeModel {
  // Dimensions
  termWidth: number;
  termHeight: number;

  // Workspace & Git context
  workspaceName: string;
  workspaceRoot: string;
  dbPath: string;
  modelName: string;
  gitBranch: string;
  gitDirty: boolean;
  tokenCount: number;
  maxTokens: number;
  totalChunks: number;

  // Mode & configuration
  mode: "BUILD" | "PLAN";
  showDetails: boolean;
  theme: ThemeColors;

  // Tabs & Sessions
  sessions: SessionTabInfo[];
  activeSessionId: string;

  // Viewport & Conversation
  history: HistoryItem[];
  viewportScrollOffset: number; // lines from bottom
  autoScroll: boolean;
  isStreaming: boolean;

  // Input Box & Autocomplete
  inputBuffer: string;
  cursorPos: number;
  inputHistory: string[];
  historyIndex: number;
  isAutocompleteOpen: boolean;
  suggestions: CommandItem[];
  selectedSuggestionIndex: number;

  // Modals & Overlays
  activeModal: ModalType;
  modalState?: any;

  // Active Toast Notification
  toast: {
    type: "info" | "success" | "warning" | "error";
    title: string;
    message: string;
    createdAt: number;
  } | null;

  // Pending approval callbacks
  pendingDiffResolver?: (action: "accept" | "reject" | "always") => void;
  pendingConfirmResolver?: (allow: boolean) => void;
}

export function createInitialModel(params: {
  workspaceName: string;
  workspaceRoot: string;
  dbPath: string;
  modelName: string;
  gitBranch: string;
  gitDirty: boolean;
  totalChunks: number;
  sessionId: string;
  mode?: "BUILD" | "PLAN";
}): OpenCodeModel {
  const width = process.stdout.columns || 100;
  const height = process.stdout.rows || 30;

  return {
    termWidth: width,
    termHeight: height,
    workspaceName: params.workspaceName,
    workspaceRoot: params.workspaceRoot,
    dbPath: params.dbPath,
    modelName: params.modelName,
    gitBranch: params.gitBranch,
    gitDirty: params.gitDirty,
    tokenCount: 800,
    maxTokens: 128000,
    totalChunks: params.totalChunks,
    mode: params.mode || "BUILD",
    showDetails: false,
    theme: getCurrentTheme(),
    sessions: [{ id: params.sessionId, title: "Main", isActive: true }],
    activeSessionId: params.sessionId,
    history: [
      {
        type: "system",
        text: "⚡ Cadmus TUI initialized. Type / for commands, @ for attachments, or press Ctrl+P for Command Palette.",
      },
    ],
    viewportScrollOffset: 0,
    autoScroll: true,
    isStreaming: false,
    inputBuffer: "",
    cursorPos: 0,
    inputHistory: [],
    historyIndex: -1,
    isAutocompleteOpen: false,
    suggestions: [],
    selectedSuggestionIndex: 0,
    activeModal: null,
    toast: null,
  };
}
