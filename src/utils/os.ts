import os from "node:os";
import path from "node:path";
import fs from "node:fs";

export type PlatformType = "windows" | "macos" | "linux";

export interface ShellInfo {
  shell: string;
  args: string[];
  isWindows: boolean;
}

/**
 * Returns normalized platform identifier
 */
export function getPlatform(): PlatformType {
  const p = process.platform;
  if (p === "win32") return "windows";
  if (p === "darwin") return "macos";
  return "linux";
}

/**
 * Resolves the optimal shell command and arguments for the current OS
 */
export function getSystemShell(): ShellInfo {
  const isWin = process.platform === "win32";

  if (isWin) {
    // Check if PowerShell 7+ (pwsh) exists, otherwise default to powershell.exe
    const pwshCandidate = "pwsh.exe";
    const powershellCandidate = "powershell.exe";

    // Default to powershell.exe with UTF-8 encoding support
    return {
      shell: powershellCandidate,
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command"],
      isWindows: true,
    };
  }

  // Unix platforms: macOS & Linux
  const userShell = process.env.SHELL || "/bin/bash";
  return {
    shell: userShell,
    args: ["-c"],
    isWindows: false,
  };
}

/**
 * Normalizes file path to forward slashes for cross-platform prompt consistency
 */
export function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

/**
 * Resolves a path relative to workspace root and returns an absolute system path
 */
export function resolveWorkspacePath(workspaceRoot: string, relativeOrAbsPath: string): string {
  if (path.isAbsolute(relativeOrAbsPath)) {
    return path.normalize(relativeOrAbsPath);
  }
  return path.normalize(path.join(workspaceRoot, relativeOrAbsPath));
}

/**
 * Detects whether a file uses CRLF (\r\n) or LF (\n) line endings
 */
export function detectLineEnding(content: string): "\r\n" | "\n" {
  const crlfIndex = content.indexOf("\r\n");
  if (crlfIndex !== -1) {
    return "\r\n";
  }
  return "\n";
}
