export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface LLMStreamCallbacks {
  onToken?: (token: string) => void;
  onToolCallStart?: (toolName: string) => void;
}

export interface LLMResponse {
  content: string;
  toolCalls: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}
