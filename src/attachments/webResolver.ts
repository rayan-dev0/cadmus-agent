/**
 * Fetches content from a web URL and converts it to readable markdown/text
 */
export async function resolveWebContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "perCodingAgent/1.0 (Developer Coding Assistant)",
      },
    });

    if (!res.ok) {
      return `[Error fetching URL ${url}: HTTP ${res.status} ${res.statusText}]`;
    }

    const html = await res.text();

    // Clean HTML: strip scripts, styles, svg, and tags
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "")
      .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, "")
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "");

    // Convert common block elements to markdown
    text = text
      .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "\n### $1\n")
      .replace(/<p[^>]*>(.*?)<\/p>/gi, "\n$1\n")
      .replace(/<li[^>]*>(.*?)<\/li>/gi, "\n- $1")
      .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, "\n```\n$1\n```\n")
      .replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""); // Strip all remaining tags

    // Decode HTML entities
    text = text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");

    // Normalize whitespace
    const cleanLines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const result = cleanLines.join("\n\n");
    // Limit to 15000 characters
    if (result.length > 15000) {
      return result.slice(0, 15000) + "\n... [Web content truncated]";
    }

    return result || "(No readable text extracted from page)";
  } catch (err: any) {
    return `[Failed to fetch ${url}: ${err.message}]`;
  }
}
