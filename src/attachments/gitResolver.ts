import { spawnSync } from "node:child_process";

export interface GitContextResult {
  branch: string;
  status: string;
  diff: string;
}

/**
 * Gathers active git repository context (branch, status, working diff)
 */
export function resolveGitContext(workspaceRoot: string): GitContextResult {
  function runGit(args: string[]): string {
    const res = spawnSync("git", args, { cwd: workspaceRoot, encoding: "utf8" });
    return res.status === 0 && res.stdout ? res.stdout.trim() : "";
  }

  const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"]) || "unknown";
  const status = runGit(["status", "--short"]) || "(clean working tree)";
  let diff = runGit(["diff", "HEAD"]);

  if (!diff) {
    diff = runGit(["diff"]);
  }

  // Truncate gigantic diffs if necessary
  if (diff.length > 15000) {
    diff = diff.slice(0, 15000) + "\n... [Git diff truncated]";
  }

  return {
    branch,
    status,
    diff: diff || "(no uncommitted changes)",
  };
}
