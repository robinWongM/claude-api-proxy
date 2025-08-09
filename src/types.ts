// Re-export types from schemas for backward compatibility
export type {
  AnthropicMessage,
  AnthropicMessagesRequest,
  AnthropicMessagesResponse,
  AnthropicModelsResponse,
  AnthropicContentBlock,
  AnthropicStreamEvent,
  AnthropicError,
  CacheControl,
  AnthropicTool,
} from './schemas/index.ts';
export type {
  OpenAIMessage,
  OpenAIChatCompletionRequest,
  OpenAITool,
  OpenAIFunction,
  OpenAIToolCall,
} from './schemas/openai.ts';

// Import for use in type definitions
import type { OpenAIToolCall } from './schemas/openai.ts';

// Streaming-specific tool call type that includes index
export interface OpenAIStreamToolCall extends Partial<OpenAIToolCall> {
  index?: number;
}

// Additional types not covered by Zod schemas
export interface OpenAIChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls';
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  system_fingerprint?: string;
}

export interface OpenAIModel {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

export interface OpenAIModelsResponse {
  object: 'list';
  data: OpenAIModel[];
}

// Streaming Types
export interface OpenAIStreamChoice {
  index: number;
  delta: {
    role?: 'assistant';
    content?: string;
    tool_calls?: OpenAIStreamToolCall[];
  };
  finish_reason?: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null;
}

export interface OpenAIStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: OpenAIStreamChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Re-expose OpenAIContentPart shape derived from schema for convenience
export type OpenAIContentPart = NonNullable<
  Extract<import('./schemas/openai.ts').OpenAIMessage['content'], any[]>
>[number];
