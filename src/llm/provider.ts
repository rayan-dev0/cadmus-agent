import { ChatMessage, LLMResponse, LLMStreamCallbacks, ToolCall } from "./types.js";
import { AgentConfig } from "../config.js";

export class LLMProvider {
  constructor(private config: AgentConfig) {}

  /**
   * Sends conversation to selected model with streaming and tool calling
   */
  async chat(
    messages: ChatMessage[],
    tools: any[],
    callbacks?: LLMStreamCallbacks
  ): Promise<LLMResponse> {
    const model = this.config.defaultModel;

    // Check for local LLM routing
    if (model.startsWith("airllm/") || model.startsWith("airllm:")) {
      const localModel = model.replace(/^airllm[/:]/, "");
      return this.chatLocalOpenAI(messages, tools, "http://localhost:8001/v1", localModel, callbacks);
    } else if (model.startsWith("ollama/") || model.startsWith("ollama:")) {
      const localModel = model.replace(/^ollama[/:]/, "");
      return this.chatLocalOpenAI(messages, tools, "http://localhost:11434/v1", localModel, callbacks);
    } else if (model.startsWith("lmstudio/") || model.startsWith("lmstudio:")) {
      const localModel = model.replace(/^lmstudio[/:]/, "");
      return this.chatLocalOpenAI(messages, tools, "http://localhost:1234/v1", localModel, callbacks);
    } else if (model.startsWith("local/")) {
      const localModel = model.replace(/^local\//, "");
      // Default local port check: AirLLM (8001) or Ollama (11434)
      return this.chatLocalOpenAI(messages, tools, "http://localhost:8001/v1", localModel, callbacks);
    }

    // OpenRouter routing
    if (model.startsWith("openrouter/") || (model.includes("/") && this.config.openrouterApiKey)) {
      const orModel = model.replace(/^openrouter\//, "");
      return this.chatOpenRouter(messages, tools, orModel, callbacks);
    }

    if (model.startsWith("claude") || this.config.anthropicApiKey) {
      return this.chatAnthropic(messages, tools, callbacks);
    } else if (model.startsWith("gpt") || this.config.openaiApiKey) {
      return this.chatOpenAI(messages, tools, callbacks);
    } else if (model.startsWith("gemini") || this.config.geminiApiKey) {
      return this.chatGemini(messages, tools, callbacks);
    }

    throw new Error(
      "No valid LLM detected. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY, or run a local model with DEFAULT_MODEL=ollama/<model> or DEFAULT_MODEL=airllm/<model>."
    );
  }

  /**
   * Anthropic Claude Messages API implementation
   */
  private async chatAnthropic(
    messages: ChatMessage[],
    tools: any[],
    callbacks?: LLMStreamCallbacks
  ): Promise<LLMResponse> {
    const apiKey = this.config.anthropicApiKey;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const systemMessage = messages.find((m) => m.role === "system")?.content || "";
    const conversation = messages
      .filter((m) => m.role !== "system")
      .map((m) => {
        if (m.role === "tool") {
          return {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: m.toolCallId,
                content: m.content,
              },
            ],
          };
        }
        if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
          const contentBlocks: any[] = [];
          if (m.content) {
            contentBlocks.push({ type: "text", text: m.content });
          }
          for (const tc of m.toolCalls) {
            contentBlocks.push({
              type: "tool_use",
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            });
          }
          return { role: "assistant", content: contentBlocks };
        }
        return { role: m.role, content: m.content };
      });

    const anthropicTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.defaultModel || "claude-3-7-sonnet-latest",
        max_tokens: 4096,
        system: systemMessage,
        messages: conversation,
        tools: anthropicTools,
        stream: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic API Error (${res.status}): ${errText}`);
    }

    let fullText = "";
    const toolCallsMap = new Map<number, { id: string; name: string; inputJson: string }>();

    const reader = res.body?.getReader();
    const decoder = new TextDecoder("utf8");

    if (!reader) throw new Error("Anthropic response body is not readable");

    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const dataStr = line.slice(6).trim();
        if (dataStr === "[DONE]") break;

        try {
          const event = JSON.parse(dataStr);
          if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
            const idx = event.index;
            toolCallsMap.set(idx, {
              id: event.content_block.id,
              name: event.content_block.name,
              inputJson: "",
            });
            callbacks?.onToolCallStart?.(event.content_block.name);
          } else if (event.type === "content_block_delta") {
            if (event.delta?.type === "text_delta") {
              const text = event.delta.text;
              fullText += text;
              callbacks?.onToken?.(text);
            } else if (event.delta?.type === "input_json_delta") {
              const item = toolCallsMap.get(event.index);
              if (item) {
                item.inputJson += event.delta.partial_json;
              }
            }
          }
        } catch {
          // ignore malformed SSE line
        }
      }
    }

    const toolCalls: ToolCall[] = Array.from(toolCallsMap.values()).map((item) => {
      let args = {};
      try {
        args = item.inputJson ? JSON.parse(item.inputJson) : {};
      } catch {
        args = {};
      }
      return {
        id: item.id,
        name: item.name,
        arguments: args,
      };
    });

    return {
      content: fullText,
      toolCalls,
    };
  }

  /**
   * OpenAI / Compatible API implementation
   */
  private async chatOpenAI(
    messages: ChatMessage[],
    tools: any[],
    callbacks?: LLMStreamCallbacks
  ): Promise<LLMResponse> {
    const apiKey = this.config.openaiApiKey;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

    const formattedMessages = messages.map((m) => {
      if (m.role === "tool") {
        return {
          role: "tool",
          tool_call_id: m.toolCallId,
          content: m.content,
        };
      }
      if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: "assistant",
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }
      return { role: m.role, content: m.content };
    });

    const openAITools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.defaultModel.startsWith("gpt") ? this.config.defaultModel : "gpt-4o",
        messages: formattedMessages,
        tools: openAITools,
        stream: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API Error (${res.status}): ${errText}`);
    }

    let fullText = "";
    const toolCallsMap = new Map<number, { id: string; name: string; argsStr: string }>();

    const reader = res.body?.getReader();
    const decoder = new TextDecoder("utf8");

    if (!reader) throw new Error("OpenAI response body is not readable");

    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const dataStr = line.slice(6).trim();
        if (dataStr === "[DONE]") break;

        try {
          const chunk = JSON.parse(dataStr);
          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            fullText += delta.content;
            callbacks?.onToken?.(delta.content);
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCallsMap.has(idx)) {
                toolCallsMap.set(idx, {
                  id: tc.id || `call_${idx}`,
                  name: tc.function?.name || "",
                  argsStr: "",
                });
                if (tc.function?.name) {
                  callbacks?.onToolCallStart?.(tc.function.name);
                }
              }
              const item = toolCallsMap.get(idx)!;
              if (tc.id) item.id = tc.id;
              if (tc.function?.name) item.name = tc.function.name;
              if (tc.function?.arguments) item.argsStr += tc.function.arguments;
            }
          }
        } catch {
          // ignore malformed SSE
        }
      }
    }

    const toolCalls: ToolCall[] = Array.from(toolCallsMap.values()).map((item) => {
      let args = {};
      try {
        args = item.argsStr ? JSON.parse(item.argsStr) : {};
      } catch {
        args = {};
      }
      return {
        id: item.id,
        name: item.name,
        arguments: args,
      };
    });

    return {
      content: fullText,
      toolCalls,
    };
  }

  /**
   * Google Gemini API implementation
   */
  private async chatGemini(
    messages: ChatMessage[],
    tools: any[],
    callbacks?: LLMStreamCallbacks
  ): Promise<LLMResponse> {
    const apiKey = this.config.geminiApiKey;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    const geminiModel = this.config.defaultModel.startsWith("gemini")
      ? this.config.defaultModel
      : "gemini-2.0-flash";

    // Format Gemini contents
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API Error (${res.status}): ${errText}`);
    }

    const data: any = await res.json();
    const candidate = data.candidates?.[0];
    const textPart = candidate?.content?.parts?.find((p: any) => p.text);
    const text = textPart?.text || "";

    callbacks?.onToken?.(text);

    return {
      content: text,
      toolCalls: [],
    };
  }

  /**
   * Local OpenAI-compatible provider (AirLLM bridge, Ollama, LM Studio)
   */
  private async chatLocalOpenAI(
    messages: ChatMessage[],
    tools: any[],
    endpointUrl: string,
    modelName: string,
    callbacks?: LLMStreamCallbacks
  ): Promise<LLMResponse> {
    const formattedMessages = messages.map((m) => {
      if (m.role === "tool") {
        return {
          role: "tool",
          tool_call_id: m.toolCallId,
          content: m.content,
        };
      }
      if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: "assistant",
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }
      return { role: m.role, content: m.content };
    });

    const openAITools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));

    let res: Response;
    try {
      res = await fetch(`${endpointUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer local",
        },
        body: JSON.stringify({
          model: modelName,
          messages: formattedMessages,
          tools: openAITools.length > 0 ? openAITools : undefined,
          stream: true,
        }),
      });
    } catch (err: any) {
      throw new Error(
        `Failed to connect to local LLM at ${endpointUrl}: ${err.message}. Ensure the local model runner (AirLLM/Ollama/LM Studio) is running.`
      );
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Local LLM Error from ${endpointUrl} (${res.status}): ${errText}`);
    }

    let fullText = "";
    const toolCallsMap = new Map<number, { id: string; name: string; argsStr: string }>();

    const reader = res.body?.getReader();
    const decoder = new TextDecoder("utf8");

    if (!reader) throw new Error("Local LLM response body is not readable");

    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const dataStr = line.slice(6).trim();
        if (dataStr === "[DONE]") break;

        try {
          const chunk = JSON.parse(dataStr);
          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            fullText += delta.content;
            callbacks?.onToken?.(delta.content);
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCallsMap.has(idx)) {
                toolCallsMap.set(idx, {
                  id: tc.id || `call_${idx}`,
                  name: tc.function?.name || "",
                  argsStr: "",
                });
                if (tc.function?.name) {
                  callbacks?.onToolCallStart?.(tc.function.name);
                }
              }
              const item = toolCallsMap.get(idx)!;
              if (tc.id) item.id = tc.id;
              if (tc.function?.name) item.name = tc.function.name;
              if (tc.function?.arguments) item.argsStr += tc.function.arguments;
            }
          }
        } catch {
          // ignore malformed SSE
        }
      }
    }

    const toolCalls: ToolCall[] = Array.from(toolCallsMap.values()).map((item) => {
      let args = {};
      try {
        args = item.argsStr ? JSON.parse(item.argsStr) : {};
      } catch {
        args = {};
      }
      return {
        id: item.id,
        name: item.name,
        arguments: args,
      };
    });

    return {
      content: fullText,
      toolCalls,
    };
  }

  /**
   * OpenRouter API implementation (Unified gateway for 200+ models)
   */
  private async chatOpenRouter(
    messages: ChatMessage[],
    tools: any[],
    modelName: string,
    callbacks?: LLMStreamCallbacks
  ): Promise<LLMResponse> {
    const apiKey = this.config.openrouterApiKey;
    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is not configured. Add OPENROUTER_API_KEY=your_key to your .env file."
      );
    }

    const formattedMessages = messages.map((m) => {
      if (m.role === "tool") {
        return {
          role: "tool",
          tool_call_id: m.toolCallId,
          content: m.content,
        };
      }
      if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: "assistant",
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }
      return { role: m.role, content: m.content };
    });

    const openAITools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));

    let res: Response;
    try {
      res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/perCodingAgent",
          "X-Title": "Personal Coding Agent",
        },
        body: JSON.stringify({
          model: modelName,
          messages: formattedMessages,
          tools: openAITools.length > 0 ? openAITools : undefined,
          stream: true,
        }),
      });
    } catch (err: any) {
      throw new Error(`Failed to connect to OpenRouter: ${err.message}`);
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter API Error (${res.status}): ${errText}`);
    }

    let fullText = "";
    const toolCallsMap = new Map<number, { id: string; name: string; argsStr: string }>();

    const reader = res.body?.getReader();
    const decoder = new TextDecoder("utf8");

    if (!reader) throw new Error("OpenRouter response body is not readable");

    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const dataStr = line.slice(6).trim();
        if (dataStr === "[DONE]") break;

        try {
          const chunk = JSON.parse(dataStr);
          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            fullText += delta.content;
            callbacks?.onToken?.(delta.content);
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCallsMap.has(idx)) {
                toolCallsMap.set(idx, {
                  id: tc.id || `call_${idx}`,
                  name: tc.function?.name || "",
                  argsStr: "",
                });
                if (tc.function?.name) {
                  callbacks?.onToolCallStart?.(tc.function.name);
                }
              }
              const item = toolCallsMap.get(idx)!;
              if (tc.id) item.id = tc.id;
              if (tc.function?.name) item.name = tc.function.name;
              if (tc.function?.arguments) item.argsStr += tc.function.arguments;
            }
          }
        } catch {
          // ignore malformed SSE
        }
      }
    }

    const toolCalls: ToolCall[] = Array.from(toolCallsMap.values()).map((item) => {
      let args = {};
      try {
        args = item.argsStr ? JSON.parse(item.argsStr) : {};
      } catch {
        args = {};
      }
      return {
        id: item.id,
        name: item.name,
        arguments: args,
      };
    });

    return {
      content: fullText,
      toolCalls,
    };
  }
}

