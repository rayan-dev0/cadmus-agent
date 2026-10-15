import crypto from "node:crypto";

export interface CodeChunk {
  id: string;
  filePath: string;
  symbolName: string | null;
  symbolType: string | null;
  startLine: number;
  endLine: number;
  content: string;
}

// Regex patterns to detect declaration boundaries across JS/TS/Python/Go/Rust/C#
const SYMBOL_PATTERNS = [
  // JS/TS: export (async) function name, class name, interface name, type name, const/let name = ...
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/,
  /^(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/,
  /^(?:export\s+)?interface\s+([A-Za-z0-9_$]+)/,
  /^(?:export\s+)?type\s+([A-Za-z0-9_$]+)\s*=/,
  /^(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/,
  // Python: def name, class name
  /^(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(/,
  /^class\s+([A-Za-z0-9_]+)(?:\s*\([^)]*\))?:/,
  // Go: func name, type name struct/interface
  /^func\s+(?:\([^)]*\)\s+)?([A-Za-z0-9_]+)\s*\(/,
  /^type\s+([A-Za-z0-9_]+)\s+(?:struct|interface)/,
  // Rust: fn name, struct name, enum name, impl name
  /^(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)/,
  /^(?:pub\s+)?(?:struct|enum|trait)\s+([A-Za-z0-9_]+)/,
];

/**
 * Splits source file text into logical code chunks
 */
export function chunkCodeFile(filePath: string, content: string): CodeChunk[] {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === "")) {
    return [];
  }

  // Small files under 50 lines are kept as a single chunk
  if (lines.length <= 50) {
    const chunkId = crypto.createHash("sha256").update(`${filePath}:1:${lines.length}`).digest("hex").slice(0, 16);
    return [
      {
        id: chunkId,
        filePath,
        symbolName: null,
        symbolType: "module",
        startLine: 1,
        endLine: lines.length,
        content: lines.map((l, i) => `${i + 1} | ${l}`).join("\n"),
      },
    ];
  }

  const chunks: CodeChunk[] = [];
  let currentChunkLines: string[] = [];
  let currentStartLine = 1;
  let currentSymbolName: string | null = null;
  let currentSymbolType: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const trimmed = line.trimStart();

    // Check if line matches a new symbol definition
    let detectedSymbol: string | null = null;
    let detectedType: string | null = null;

    for (const pattern of SYMBOL_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match && match[1]) {
        detectedSymbol = match[1];
        if (pattern.source.includes("function") || pattern.source.includes("def") || pattern.source.includes("fn")) {
          detectedType = "function";
        } else if (pattern.source.includes("class")) {
          detectedType = "class";
        } else if (pattern.source.includes("interface") || pattern.source.includes("trait")) {
          detectedType = "interface";
        } else {
          detectedType = "symbol";
        }
        break;
      }
    }

    // If new symbol found and chunk has accumulated enough lines (or chunk is too big)
    const shouldFlush =
      (detectedSymbol && currentChunkLines.length >= 25) || currentChunkLines.length >= 75;

    if (shouldFlush && currentChunkLines.length > 0) {
      const endLine = lineNum - 1;
      const chunkId = crypto
        .createHash("sha256")
        .update(`${filePath}:${currentStartLine}:${endLine}`)
        .digest("hex")
        .slice(0, 16);

      chunks.push({
        id: chunkId,
        filePath,
        symbolName: currentSymbolName,
        symbolType: currentSymbolType,
        startLine: currentStartLine,
        endLine,
        content: currentChunkLines.map((l, idx) => `${currentStartLine + idx} | ${l}`).join("\n"),
      });

      // Reset for next chunk with a 3-line overlap for context continuity
      const overlap = currentChunkLines.slice(-3);
      currentChunkLines = [...overlap, line];
      currentStartLine = endLine - overlap.length + 1;
      currentSymbolName = detectedSymbol;
      currentSymbolType = detectedType;
    } else {
      if (!currentSymbolName && detectedSymbol) {
        currentSymbolName = detectedSymbol;
        currentSymbolType = detectedType;
      }
      currentChunkLines.push(line);
    }
  }

  // Flush remaining lines
  if (currentChunkLines.length > 0) {
    const endLine = lines.length;
    const chunkId = crypto
      .createHash("sha256")
      .update(`${filePath}:${currentStartLine}:${endLine}`)
      .digest("hex")
      .slice(0, 16);

    chunks.push({
      id: chunkId,
      filePath,
      symbolName: currentSymbolName,
      symbolType: currentSymbolType,
      startLine: currentStartLine,
      endLine,
      content: currentChunkLines.map((l, idx) => `${currentStartLine + idx} | ${l}`).join("\n"),
    });
  }

  return chunks;
}
