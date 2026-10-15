import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import { rgPath } from "@vscode/ripgrep";

export interface PrereqStatus {
  ripgrep: {
    available: boolean;
    path: string;
    version: string;
    source: "system" | "bundled";
  };
  git: {
    available: boolean;
    version: string;
  };
}

let cachedPrereqs: PrereqStatus | null = null;

/**
 * Resolves the path to the ripgrep binary (system rg or bundled @vscode/ripgrep)
 */
export function resolveRipgrepPath(): { path: string; source: "system" | "bundled" } {
  // 1. Try system ripgrep first
  try {
    const res = spawnSync("rg", ["--version"], { encoding: "utf8", stdio: "pipe" });
    if (res.status === 0 && res.stdout.includes("ripgrep")) {
      return { path: "rg", source: "system" };
    }
  } catch {
    // System rg not found in PATH
  }

  // 2. Fall back to @vscode/ripgrep bundled binary
  if (rgPath && fs.existsSync(rgPath)) {
    return { path: rgPath, source: "bundled" };
  }

  throw new Error("No ripgrep executable found. Neither system 'rg' nor '@vscode/ripgrep' binary is available.");
}

/**
 * Inspects system prerequisites (ripgrep, git)
 */
export function checkPrerequisites(): PrereqStatus {
  if (cachedPrereqs) return cachedPrereqs;

  let rgInfo: PrereqStatus["ripgrep"] = {
    available: false,
    path: "",
    version: "unknown",
    source: "bundled",
  };

  try {
    const resolved = resolveRipgrepPath();
    const verRes = spawnSync(resolved.path, ["--version"], { encoding: "utf8", stdio: "pipe" });
    const versionLine = verRes.stdout ? verRes.stdout.split("\n")[0].trim() : "unknown";
    rgInfo = {
      available: true,
      path: resolved.path,
      version: versionLine,
      source: resolved.source,
    };
  } catch {
    rgInfo.available = false;
  }

  let gitInfo: PrereqStatus["git"] = {
    available: false,
    version: "unknown",
  };

  try {
    const gitRes = spawnSync("git", ["--version"], { encoding: "utf8", stdio: "pipe" });
    if (gitRes.status === 0 && gitRes.stdout) {
      gitInfo = {
        available: true,
        version: gitRes.stdout.trim(),
      };
    }
  } catch {
    gitInfo.available = false;
  }

  cachedPrereqs = {
    ripgrep: rgInfo,
    git: gitInfo,
  };

  return cachedPrereqs;
}
