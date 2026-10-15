import fs from "node:fs";
import { resolveWorkspacePath, toPosixPath } from "../utils/os.js";
import { resolveGitContext } from "./gitResolver.js";
import { resolveWebContent } from "./webResolver.js";
import { readFileTool } from "../tools/readFile.js";
import { listDirTool } from "../tools/listDir.js";
import { codebaseSearchTool } from "../tools/codebaseSearch.js";
import { runTerminalCommandTool } from "../tools/runTerminalCommand.js";
import { ToolContext } from "../tools/types.js";

export interface ResolvedAttachment {
  type: "file" | "folder" | "git" | "web" | "search" | "terminal";
  target: string;
  content: string;
}

export interface ExpandedPrompt {
  cleanedPrompt: string;
  attachments: ResolvedAttachment[];
  formattedContext: string;
  isInlineCommand?: boolean;
  inlineCommandOutput?: string;
}

/**
 * Parses @file, @folder, @git, @web, and @search tokens from a user prompt
 */
export async function parseAndResolveAttachments(
  rawPrompt: string,
  context: ToolContext
): Promise<ExpandedPrompt> {
  const attachments: ResolvedAttachment[] = [];
  let cleaned = rawPrompt;

  // 1. OpenCode Inline Shell Execution: !<command>
  if (rawPrompt.trim().startsWith("!")) {
    const shellCmd = rawPrompt.trim().slice(1).trim();
    let cmdOutput = "";
    try {
      const inlineContext: ToolContext = {
        ...context,
        onAskConfirmation: undefined,
        autoApproveReadOnly: true,
      };
      cmdOutput = await runTerminalCommandTool.execute({ command: shellCmd }, inlineContext);
    } catch (err: any) {
      cmdOutput = `Execution Error: ${err.message}`;
    }

    attachments.push({
      type: "terminal",
      target: `!${shellCmd}`,
      content: cmdOutput,
    });

    return {
      cleanedPrompt: `Command executed: !${shellCmd}`,
      attachments,
      formattedContext: `\n\n<inline_command command="${shellCmd}">\n${cmdOutput}\n</inline_command>`,
      isInlineCommand: true,
      inlineCommandOutput: cmdOutput,
    };
  }

  // 2. Resolve @git
  if (/@git\b/i.test(cleaned)) {
    cleaned = cleaned.replace(/@git\b/gi, "").trim();
    const gitInfo = resolveGitContext(context.workspaceRoot);
    attachments.push({
      type: "git",
      target: "workspace-git",
      content: `Branch: ${gitInfo.branch}\nStatus:\n${gitInfo.status}\nDiff:\n${gitInfo.diff}`,
    });
  }

  // 3. Resolve @web <url>
  const webMatches = [...cleaned.matchAll(/@web\s+(https?:\/\/[^\s]+)/gi)];
  for (const m of webMatches) {
    const url = m[1];
    cleaned = cleaned.replace(m[0], "").trim();
    const webContent = await resolveWebContent(url);
    attachments.push({
      type: "web",
      target: url,
      content: webContent,
    });
  }

  // 4. Resolve @file <path> with optional line ranges (#10-30 or :10-30)
  const fileRegex = /@file\s+([^\s#:]+)(?:[#:](?:L)?(\d+)(?:-(?:L)?(\d+))?)?|@([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)(?:[#:](?:L)?(\d+)(?:-(?:L)?(\d+))?)?/gi;
  const fileMatches = [...cleaned.matchAll(fileRegex)];

  for (const m of fileMatches) {
    const matchedToken = m[0];
    const filePath = m[1] || m[4];
    if (!filePath || filePath.startsWith("git") || filePath.startsWith("web") || filePath.startsWith("folder") || filePath.startsWith("search")) {
      continue;
    }

    const startLineRaw = m[2] || m[5];
    const endLineRaw = m[3] || m[6];
    const startLine = startLineRaw ? parseInt(startLineRaw, 10) : undefined;
    const endLine = endLineRaw ? parseInt(endLineRaw, 10) : startLine ? startLine + 30 : undefined;

    cleaned = cleaned.replace(matchedToken, "").trim();
    const lineLabel = startLine && endLine ? `#${startLine}-${endLine}` : startLine ? `#${startLine}` : "";

    try {
      const fileText = await readFileTool.execute(
        { path: filePath, start_line: startLine, end_line: endLine },
        context
      );
      attachments.push({
        type: "file",
        target: `${filePath}${lineLabel}`,
        content: fileText,
      });
    } catch (err: any) {
      attachments.push({
        type: "file",
        target: `${filePath}${lineLabel}`,
        content: `[Error loading file ${filePath}: ${err.message}]`,
      });
    }
  }

  // 4. Resolve @folder <path>
  const folderMatches = [...cleaned.matchAll(/@folder\s+([^\s]+)/gi)];
  for (const m of folderMatches) {
    const folderPath = m[1];
    cleaned = cleaned.replace(m[0], "").trim();
    try {
      const folderTree = await listDirTool.execute({ path: folderPath, depth: 3 }, context);
      attachments.push({
        type: "folder",
        target: folderPath,
        content: folderTree,
      });
    } catch (err: any) {
      attachments.push({
        type: "folder",
        target: folderPath,
        content: `[Error reading folder ${folderPath}: ${err.message}]`,
      });
    }
  }

  // 5. Resolve @search <query>
  const searchMatches = [...cleaned.matchAll(/@search\s+"([^"]+)"|@search\s+([^\s]+)/gi)];
  for (const m of searchMatches) {
    const query = m[1] || m[2];
    cleaned = cleaned.replace(m[0], "").trim();
    try {
      const searchRes = await codebaseSearchTool.execute({ query, limit: 5 }, context);
      attachments.push({
        type: "search",
        target: query,
        content: searchRes,
      });
    } catch (err: any) {
      attachments.push({
        type: "search",
        target: query,
        content: `[Codebase search error: ${err.message}]`,
      });
    }
  }

  // Format attachment blocks for LLM system/user context
  let formattedContext = "";
  if (attachments.length > 0) {
    const blocks = attachments.map((att) => {
      const title = `=== ATTACHMENT [${att.type.toUpperCase()}]: ${att.target} ===`;
      return `${title}\n${att.content}\n${"=".repeat(title.length)}`;
    });
    formattedContext = `\n\n<context_attachments>\n${blocks.join("\n\n")}\n</context_attachments>`;
  }

  return {
    cleanedPrompt: cleaned,
    attachments,
    formattedContext,
  };
}
