import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ToolDefinition, ToolContext } from "./types.js";
import { resolveWorkspacePath, detectLineEnding, toPosixPath } from "../utils/os.js";
import { generateDiff, formatTerminalDiff } from "./diffViewer.js";
import { snapshotFileForUndo } from "../agent/undoManager.js";

export const EditFileSchema = z.object({
  path: z.string().describe("Path to the file to edit"),
  target_content: z.string().describe("The exact text snippet in the file to replace. Must be unique."),
  replacement_content: z.string().describe("The new replacement content"),
  allow_create: z.boolean().optional().describe("If true, creates the file if it does not exist"),
});

export type EditFileParams = z.infer<typeof EditFileSchema>;

export const editFileTool: ToolDefinition<EditFileParams, string> = {
  name: "edit_file",
  description: "Applies targeted edits, modifications, or search-and-replace updates to existing files. Shows a unified diff before applying.",
  parameters: EditFileSchema,
  jsonSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file to edit" },
      target_content: { type: "string", description: "The exact text snippet in the file to replace" },
      replacement_content: { type: "string", description: "The new replacement content" },
      allow_create: { type: "boolean", description: "If true, creates the file if it does not exist" },
    },
    required: ["path", "target_content", "replacement_content"],
  },
  requiresConfirmation: true,
  execute: async (params, context: ToolContext) => {
    const fullPath = resolveWorkspacePath(context.workspaceRoot, params.path);
    const fileExists = fs.existsSync(fullPath);

    if (!fileExists) {
      if (!params.allow_create) {
        throw new Error(`File does not exist: ${params.path}. Set allow_create: true to create new files.`);
      }

      // New file creation
      const diff = generateDiff(params.path, "", params.replacement_content);
      if (!context.autoApproveEdits) {
        if (context.onAskDiffApproval) {
          const decision = await context.onAskDiffApproval({
            filePath: params.path,
            patch: diff.patch,
            additions: diff.additions,
            deletions: 0,
          });
          if (decision === "reject") {
            throw new Error(`User rejected creation of file: ${params.path}`);
          }
          if (decision === "always") {
            context.autoApproveEdits = true;
          }
        } else if (context.onAskConfirmation) {
          const prompt = `Create new file ${params.path} (+${diff.additions} lines)?\n${formatTerminalDiff(diff.patch)}`;
          const approved = await context.onAskConfirmation(prompt);
          if (!approved) {
            throw new Error(`User rejected creation of file: ${params.path}`);
          }
        }
      }

      if (context.sessionId && context.turnId) {
        snapshotFileForUndo(context.dbPath, context.sessionId, context.turnId, params.path, context.workspaceRoot);
      }

      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, params.replacement_content, "utf8");
      return `Successfully created ${toPosixPath(params.path)} (+${diff.additions} lines)`;
    }

    const currentContent = fs.readFileSync(fullPath, "utf8");
    const eol = detectLineEnding(currentContent);

    // Normalize line endings for replacement comparison
    const normCurrent = currentContent.replace(/\r\n/g, "\n");
    const normTarget = params.target_content.replace(/\r\n/g, "\n");
    const normReplacement = params.replacement_content.replace(/\r\n/g, "\n");

    const matchCount = normCurrent.split(normTarget).length - 1;

    if (matchCount === 0) {
      throw new Error(`Target content not found in ${params.path}. Ensure the target_content matches the existing file exactly.`);
    }

    if (matchCount > 1) {
      throw new Error(`Target content occurs ${matchCount} times in ${params.path}. Please provide more surrounding context to make target_content unique.`);
    }

    const updatedNorm = normCurrent.replace(normTarget, normReplacement);
    const finalContent = eol === "\r\n" ? updatedNorm.replace(/\n/g, "\r\n") : updatedNorm;

    const diff = generateDiff(params.path, currentContent, finalContent);

    if (!context.autoApproveEdits) {
      if (context.onAskDiffApproval) {
        const decision = await context.onAskDiffApproval({
          filePath: params.path,
          patch: diff.patch,
          additions: diff.additions,
          deletions: diff.deletions,
        });
        if (decision === "reject") {
          throw new Error(`User rejected changes to ${params.path}`);
        }
        if (decision === "always") {
          context.autoApproveEdits = true;
        }
      } else if (context.onAskConfirmation) {
        const prompt = `Apply edit to ${params.path} (+${diff.additions}, -${diff.deletions})?\n${formatTerminalDiff(diff.patch)}`;
        const approved = await context.onAskConfirmation(prompt);
        if (!approved) {
          throw new Error(`User rejected changes to ${params.path}`);
        }
      }
    }

    if (context.sessionId && context.turnId) {
      snapshotFileForUndo(context.dbPath, context.sessionId, context.turnId, params.path, context.workspaceRoot);
    }

    fs.writeFileSync(fullPath, finalContent, "utf8");
    return `Successfully updated ${toPosixPath(params.path)} (+${diff.additions}, -${diff.deletions})\n${formatTerminalDiff(diff.patch)}`;
  },
};
