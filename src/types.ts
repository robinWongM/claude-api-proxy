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
  OpenAIContentPart,
  OpenAITool,
  OpenAIFunction,
  OpenAIToolCall,
} from './schemas/openai.ts';

// Import for use in type definitions
import type { OpenAIToolCall } from './schemas/openai.ts';

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
    tool_calls?: Partial<OpenAIToolCall>[];
  };
  finish_reason?: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null;
}

export interface OpenAIStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: OpenAIStreamChoice[];
}

// Re-expose OpenAIContentPart shape derived from schema for convenience
export type OpenAIContentPart = NonNullable<
  Extract<import('./schemas/openai.ts').OpenAIMessage['content'], any[]>
>[number];
